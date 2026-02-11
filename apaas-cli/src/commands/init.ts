import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { Command } from 'commander';
import shelljs from 'shelljs';
import inquirer from 'inquirer';

import { log } from '../utils/log';
import { outputWarning } from '../utils/warning';
import { loadConfig, type TemplateKind } from '../config';

type InitOptions = {
  version?: string;
  userhome?: string;
};

function resolveUserHome(custom?: string) {
  if (typeof custom === 'string' && custom.trim().length > 0) {
    return path.resolve(custom);
  }
  return os.homedir();
}

function replaceInDirSync(dirPath: string, replacements: Array<[RegExp, string]>) {
  const stat = fs.lstatSync(dirPath);
  if (stat.isDirectory()) {
    const names = fs.readdirSync(dirPath);
    for (const name of names) {
      replaceInDirSync(path.join(dirPath, name), replacements);
    }
    return;
  }

  let content = fs.readFileSync(dirPath, 'utf-8');
  for (const [re, val] of replacements) {
    content = content.replace(re, val);
  }
  fs.writeFileSync(dirPath, content);
}

export function registerInitCommand(program: Command) {
  program
    .command('init <name>')
    .description('初始化项目')
    .option('-v, --version <version>', '模板 git 分支/Tag（可选）')
    .option('-u, --userhome <userhome>', '自定义缓存目录（用于存放模板仓库缓存）')
    .action(async (name: string, options: InitOptions) => {
      outputWarning();

      const answers = await inquirer.prompt([
        {
          type: 'list',
          message: '请选择将要创建的项目类型：',
          name: 'projectType',
          choices: [
            { name: 'monorepo集合', value: 'monorepo' },
            { name: '普通项目', value: 'normal' },
          ],
          default: 'normal',
        },
      ]);

      const projectType = answers.projectType as TemplateKind;
      const config = loadConfig();
      const gitProjectUrl = config.templates[projectType];

      if (!gitProjectUrl || !gitProjectUrl.trim()) {
        log.error(
          `error 未配置模板仓库地址：${projectType}。请先执行 apaas set 进行配置。`
        );
        shelljs.exit(1);
      }

      if (!shelljs.which('git')) {
        log.error('error 本机上没有git，请检查git是否安装或相关环境变量是否正确');
        shelljs.exit(1);
      }

      const moduleName = name;
      const projectPath = path.resolve(process.cwd(), `apaas-custom-${moduleName}`);
      const customPath = path.resolve(projectPath, 'src/custom');
      const staticPath = path.resolve(projectPath, 'public/custom');

      const userHome = resolveUserHome(options.userhome);
      const gitTemplateRepo = path.resolve(userHome, '.apaasCliRepo');

      shelljs.rm('-rf', gitTemplateRepo);
      shelljs.mkdir('-p', gitTemplateRepo);

      const cloneCmd = options.version
        ? `git clone --branch ${options.version} ${gitProjectUrl} --depth=1 ${gitTemplateRepo}`
        : `git clone ${gitProjectUrl} --depth=1 ${gitTemplateRepo}`;

      const result = shelljs.exec(cloneCmd);
      if (result.code !== 0) {
        shelljs.exit(result.code);
      }

      shelljs.rm('-rf', path.resolve(gitTemplateRepo, '.git'));

      if (fs.existsSync(projectPath)) {
        log.error('error 当前路径已经存在工程，请检查相关目录设置');
        shelljs.exit(1);
      }

      shelljs.cp('-R', `${gitTemplateRepo}/.`, projectPath);

      const demoCustomModuleName = 'hello';
      const demoCustomModulePath = path.resolve(
        customPath,
        `apaas-custom-${demoCustomModuleName}`
      );

      if (fs.existsSync(demoCustomModulePath)) {
        replaceInDirSync(demoCustomModulePath, [
          [/\{\{moduleName\}\}/g, moduleName],
          [
            /\{\{ModuleName\}\}/g,
            moduleName.charAt(0).toUpperCase() + moduleName.slice(1),
          ],
        ]);

        fs.renameSync(
          demoCustomModulePath,
          path.resolve(customPath, `apaas-custom-${moduleName}`)
        );
      }

      const demoStaticPath = path.resolve(
        staticPath,
        `apaas-custom-${demoCustomModuleName}`
      );
      if (fs.existsSync(demoStaticPath)) {
        fs.renameSync(
          demoStaticPath,
          path.resolve(staticPath, `apaas-custom-${moduleName}`)
        );
      }

      log.success(`success 已创建项目：${projectPath}`);
      outputWarning();
    });
}
