import fs from 'node:fs';
import path from 'node:path';

import { log } from './log';

export type ApaasJson = {
  entry: string;
  copyAssets: string[];
  outputName: string;
  customWidgetList?: Array<{ code: string; text: string }>;
  [k: string]: unknown;
};

export function resolveAbs(p: string) {
  return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
}

export function ensureDirExists(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    throw new Error(`模块目录不存在：${dirPath}`);
  }
  if (!fs.lstatSync(dirPath).isDirectory()) {
    throw new Error(`模块路径不是目录：${dirPath}`);
  }
}

export function readJsonFile<T>(filePath: string): T {
  if (!fs.existsSync(filePath)) {
    throw new Error(`找不到配置文件：${filePath}`);
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    throw new Error(`配置文件解析失败：${filePath}`);
  }
}

export function validateEntry(moduleDir: string, entry: string) {
  const entryPath = path.isAbsolute(entry) ? entry : path.resolve(moduleDir, entry);

  if (!fs.existsSync(entryPath)) {
    throw new Error(
      `apaas.json 指定的 entry: ${entry} 的路径错误\nerror path is ${entryPath}`,
    );
  }

  return entryPath;
}

export function findRslibConfig(startDir: string) {
  const candidates = [
    'rslib.config.ts',
    'rslib.config.js',
    'rslib.config.cjs',
    'rslib.config.mjs',
  ];

  let current = startDir;
  for (let depth = 0; depth < 4; depth++) {
    for (const name of candidates) {
      const p = path.resolve(current, name);
      if (fs.existsSync(p)) {
        if (depth > 0) {
          log.info(`在上级目录找到 rslib 配置文件: ${p} (向上 ${depth} 层)`);
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

export type ResolvedDistRootResult = {
  distRoot: string;
  configPath: string | null;
  from: 'rslibConfig' | 'moduleOutputNameDir' | 'cwdZipDir';
};

function fallbackDistRoot(moduleDir: string, outputName: string): ResolvedDistRootResult {
  const candidate = path.resolve(moduleDir, outputName);
  if (fs.existsSync(candidate)) {
    return {
      distRoot: candidate,
      configPath: null,
      from: 'moduleOutputNameDir',
    };
  }
  return {
    distRoot: path.resolve(process.cwd(), 'zip', outputName),
    configPath: null,
    from: 'cwdZipDir',
  };
}

export async function resolveDistRoot(
  moduleDir: string,
  outputName: string,
): Promise<ResolvedDistRootResult> {
  const configPath = findRslibConfig(moduleDir);
  if (!configPath) {
    log.warn('未找到 rslib.config.*，将回退到默认输出目录推导策略');
    return fallbackDistRoot(moduleDir, outputName);
  }

  try {
    // 兼容 CJS 产物：避免 tsc 将 import() 降级为 require()
    const mod = await eval(`import(${JSON.stringify(configPath)})`);
    const cfg = (mod as any).default ?? mod;
    const root = cfg?.output?.distPath?.root;

    if (typeof root === 'string' && root.trim()) {
      return {
        distRoot: path.resolve(moduleDir, root),
        configPath,
        from: 'rslibConfig',
      };
    }

    log.warn(
      `rslib.config 中未找到 output.distPath.root（或不是字符串），将回退到默认输出目录推导策略\nconfig: ${configPath}`,
    );
    return fallbackDistRoot(moduleDir, outputName);
  } catch (e) {
    log.warn(
      `读取 rslib.config 失败，将回退到默认输出目录推导策略\nconfig: ${configPath}\nerror: ${String(
        e instanceof Error ? e.message : e,
      )}`,
    );
    return fallbackDistRoot(moduleDir, outputName);
  }
}

export function buildRslibArgs(params: {
  moduleDir: string;
  watch?: boolean;
  forwardedArgs?: string[];
}) {
  const { moduleDir, watch = false, forwardedArgs = [] } = params;
  const args = ['rslib', 'build'];

  const configPath = findRslibConfig(moduleDir);
  if (configPath) {
    args.push('-c', configPath);
  }

  if (watch) {
    args.push('-w');
  }

  if (forwardedArgs.length > 0) {
    args.push(...forwardedArgs);
  }

  return args;
}

