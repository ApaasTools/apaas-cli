import fs from 'node:fs';
import path from 'node:path';
import type { Command } from 'commander';
import shelljs from 'shelljs';
import zipper from 'zip-local';

import { spawnSync } from '../utils/spawn';
import { outputWarning } from '../utils/warning';
import { log } from '../utils/log';

type ApaasJson = {
  entry: string;
  copyAssets: string[];
  outputName: string;
  customWidgetList?: Array<{ code: string; text: string }>;
  [k: string]: unknown;
};

function resolveAbs(p: string) {
  return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
}

function exitWithError(message: string): never {
  log.error(message);
  process.exitCode = 1;
  throw new Error(message);
}

function ensureDirExists(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    exitWithError(`模块目录不存在：${dirPath}`);
  }
  if (!fs.lstatSync(dirPath).isDirectory()) {
    exitWithError(`模块路径不是目录：${dirPath}`);
  }
}

function readJsonFile<T>(filePath: string): T {
  if (!fs.existsSync(filePath)) {
    exitWithError(`找不到配置文件：${filePath}`);
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch (e) {
    exitWithError(`配置文件解析失败：${filePath}`);
  }
}

function validateEntry(moduleDir: string, entry: string) {
  const entryPath = path.isAbsolute(entry)
    ? entry
    : path.resolve(moduleDir, entry);

  if (!fs.existsSync(entryPath)) {
    exitWithError(
      `apaas.json 指定的 entry: ${entry} 的路径错误\nerror path is ${entryPath}`
    );
  }

  return entryPath;
}

function checkRsbuildConfig(moduleDir: string) {
  const candidates = [
    'rslib.config.js',
    'rslib.config.ts',
    'rslib.config.cjs',
    'rslib.config.mjs',
  ];
  const has = candidates.some((name) => fs.existsSync(path.resolve(moduleDir, name)));
  if (!has) {
    // 这里的配置文件仅用于辅助构建参数；缺失不应阻断构建。
    log.warn(
      `模块目录下未找到 rslib.config.(js|ts|cjs|mjs)，将继续构建\n当前目录: ${moduleDir}`
    );
  }
}

function findRslibConfig(startDir: string) {
  const candidates = [
    'rslib.config.ts',
    'rslib.config.js',
    'rslib.config.cjs',
    'rslib.config.mjs',
  ];

  // 从模块目录开始，最多向上查找 3 层
  let current = startDir;
  for (let depth = 0; depth < 4; depth++) {
    for (const name of candidates) {
      const p = path.resolve(current, name);
      if (fs.existsSync(p)) {
        if (depth > 0) {
          log.info(
            `在上级目录找到 rslib 配置文件: ${p} (向上 ${depth} 层)`
          );
        }
        return p;
      }
    }

    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return null;
}

function buildRslibArgs(moduleDir: string) {
  const args = ['rslib', 'build'];
  const configPath = findRslibConfig(moduleDir);

  // 对于非 monorepo/依赖在根目录的场景：
  // rslib 可能不会按预期从 cwd 自动搜到配置，导致报 rslib.config not found。
  // 这里如果模块目录下存在任意 rslib.config.*，则显式传 -c，避免 rslib 自行探测失败。
  if (configPath) {
    console.log("buildRslibArgs", args)
    args.push('-c', configPath);
  }

  return args;
}

function statOutputSizes(outputPath: string) {
  if (!fs.existsSync(outputPath)) return;

  log.info('构建产物大小统计:');
  const walk = (dir: string, prefix = '') => {
    const names = fs.readdirSync(dir);
    for (const name of names) {
      const p = path.join(dir, name);
      const rel = prefix ? `${prefix}/${name}` : name;
      const st = fs.lstatSync(p);
      if (st.isDirectory()) {
        walk(p, rel);
      } else if (st.isFile()) {
        const size = (st.size / 1024).toFixed(2);
        log.info(`  ${rel}: ${size} KB`);
      }
    }
  };
  walk(outputPath);
}

export function registerBuildCommand(program: Command) {
  program
    .command('build <moduleDir>')
    .description('根据模块目录与 apaas.json 构建自定义模块')
    .option('-n, --name <name>', '配置文件名（默认 apaas.json）')
    .action((moduleDir: string, options: { name?: string }) => {
      outputWarning();

      try {
        const absModuleDir = resolveAbs(moduleDir);
        ensureDirExists(absModuleDir);
        checkRsbuildConfig(absModuleDir);

        const configName = options.name ?? 'apaas.json';
        if (!configName.endsWith('.json')) {
          exitWithError(`--name 必须是 .json 文件名：${configName}`);
        }

        const configPath = path.resolve(absModuleDir, configName);
        const apaasConfig = readJsonFile<ApaasJson>(configPath);

        if (!apaasConfig.entry || typeof apaasConfig.entry !== 'string') {
          exitWithError(`配置文件缺少有效的 entry 字段：${configPath}`);
        }
        if (!apaasConfig.outputName || typeof apaasConfig.outputName !== 'string') {
          exitWithError(`配置文件缺少有效的 outputName 字段：${configPath}`);
        }
        if (!Array.isArray(apaasConfig.copyAssets)) {
          exitWithError(`配置文件 copyAssets 必须是数组：${configPath}`);
        }

        const entryAbsPath = validateEntry(absModuleDir, apaasConfig.entry);

        const outputName = apaasConfig.outputName;
        const zipRoot = path.resolve(process.cwd(), 'zip');
        const outputPath = path.resolve(zipRoot, outputName);
        const outputZipPath = path.resolve(zipRoot, `${outputName}.zip`);

        // rslib 默认会在 cwd 下生成 dist/（或其默认输出目录）。这里记录一下用于构建完成后的清理。
        const rslibDefaultOutputPath = path.resolve(absModuleDir, outputName);

        // 清理目标路径
        if (fs.existsSync(outputPath)) {
          fs.lstatSync(outputPath).isDirectory()
            ? shelljs.rm('-rf', outputPath)
            : shelljs.rm(outputPath);
        }

        // 设置环境变量并执行构建
        process.env.PUBLIC_ENTRY = entryAbsPath;
        process.env.PUBLIC_OUTPUT_NAME = outputName;

        // 执行构建（参考 scripts/build.cjs：npx rslib build ...）
        const args = buildRslibArgs(absModuleDir);
        log.info(`构建命令: npx ${args.join(' ')}`);
        // 非 monorepo 场景下，rslib 安装在项目根目录 node_modules 中，
        // 这里仍使用 npx 调用，但通过 env 继承让其在整项目范围内解析依赖。
        // 如果后续需要进一步兼容全局安装或自定义路径，可以在此扩展。
        spawnSync('npx', args, { cwd: absModuleDir });
        log.success(`构建 ${outputName} 模块成功！`);

        // 统计构建产物大小
        statOutputSizes(outputPath);

        // 拷贝配置文件
        shelljs.mkdir('-p', outputPath);
        shelljs.cp('-R', configPath, `${outputPath}/`);

        // 拷贝资源文件
        for (const copyAsset of apaasConfig.copyAssets) {
          const assetPath = path.resolve(process.cwd(), copyAsset);
          const outputAsset = path.resolve(
            outputPath,
            copyAsset.replace(/^public\//, 'static/'),
          );
          shelljs.mkdir('-p', outputAsset);
          shelljs.cp('-R', `${assetPath}/*`, `${outputAsset}/`);
        }

        // 清理已有压缩包
        fs.existsSync(outputZipPath) && shelljs.rm(outputZipPath);

        // 生成并压缩
        zipper.zip(outputPath, (error: unknown, zipped: any) => {
          if (error) {
            shelljs.rm('-r', outputPath);
            exitWithError(`生成压缩包失败: ${String(error)}`);
          }

          zipped.compress();
          const size = (zipped.memory().length / 1024 / 1024).toFixed(2);

          zipped.save(outputZipPath, (error: unknown) => {
            if (error) {
              shelljs.rm('-r', outputPath);
              exitWithError(`保存压缩包失败: ${String(error)}`);
            }

            log.success(`构建 ${outputName} 成功！压缩包大小: ${size} MB`);

            // 清理临时目录：
            // 1) 删除 zip 内部使用的临时输出目录
            shelljs.rm('-r', outputPath);
            // 2) 删除 rslib 在模块目录下产出的 dist（或默认输出），
            //    避免在自定义模块目录下残留构建产物目录
            if (fs.existsSync(rslibDefaultOutputPath)) {
              shelljs.rm('-r', rslibDefaultOutputPath);
            }
          });
        });
      } catch {
        // 错误已输出
      }

      outputWarning();
    });
}
