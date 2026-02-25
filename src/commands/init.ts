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
            { name: 'monorepo集合（目前只提供此模版）', value: 'monorepo' },
            // { name: '普通项目', value: 'normal' },
          ],
          default: 'monorepo',
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

      const result = shelljs.exec(cloneCmd, { silent: true });
      if (result.code !== 0) {
        log.error('error 模板仓库克隆失败。');
        log.error(`error 项目类型：${projectType}`);
        log.error(`error 模板仓库：${gitProjectUrl}`);
        if (options.version) {
          log.error(`error 模板版本（分支/Tag）：${options.version}`);
        }
        log.error(`error 缓存目录：${gitTemplateRepo}`);
        log.error('');
        log.error('可能原因（常见）：');
        log.error('1) 当前网络到 github.com 不稳定，导致 TLS/HTTP2 读取超时（curl 28 / errno 60）。');
        log.error('2) 公司网络/网关/安全软件对 git 的长连接下载存在限制或丢包。');
        log.error('3) git 配置了不可用的代理（http.proxy/https.proxy）。');
        log.error('');
        log.error('你可以尝试：');
        log.error('A) 换网络（例如手机热点）后重试。');
        log.error('B) 强制 git 使用 HTTP/1.1：git config --global http.version HTTP/1.1');
        log.error('C) 检查/取消 git 代理：git config --global --get http.proxy && git config --global --get https.proxy');
        log.error('D) 将模板仓库地址改为 SSH（推荐更稳定）：git@github.com:<org>/<repo>.git');
        log.error('');
        log.error('调试命令（可复制执行）：');
        log.error(`GIT_CURL_VERBOSE=1 GIT_TRACE=1 git ls-remote ${gitProjectUrl} | cat`);
        log.error('');
        if (result.stderr) {
          log.error('git 输出：');
          log.error(result.stderr.trim());
        }
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
