import type { Command } from 'commander';
import inquirer from 'inquirer';

import { log } from '../utils/log';
import { saveTemplate, type TemplateKind } from '../config';

export function registerSetCommand(program: Command) {
  program
    .command('set')
    .description('配置模板仓库地址（monorepo集合 / 普通项目）')
    .action(async () => {
      const answers = await inquirer.prompt([
        {
          type: 'list',
          name: 'kind',
          message: '请选择要配置的模板类型：',
          choices: [
            { name: 'monorepo集合', value: 'monorepo' },
            { name: '普通项目', value: 'normal' },
          ],
        },
        {
          type: 'input',
          name: 'url',
          message: '请输入模板仓库的 git 地址：',
          validate(input: string) {
            if (!input.trim()) return '地址不能为空';
            return true;
          },
        },
      ]);

      const kind = answers.kind as TemplateKind;
      const url = answers.url as string;

      saveTemplate(kind, url.trim());
      log.success(`已更新 ${kind} 模板仓库地址为：${url}`);
    });
}

