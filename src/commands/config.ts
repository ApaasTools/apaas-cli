import type { Command } from 'commander';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

import { loadConfig } from '../config';
import { log } from '../utils/log';

const CONFIG_FILE_NAME = '.apaas-cli.json';

function getConfigFilePath() {
  return path.resolve(os.homedir(), CONFIG_FILE_NAME);
}

function getConfigSource(kind: 'monorepo' | 'normal'): string {
  const filePath = getConfigFilePath();
  const hasFile = fs.existsSync(filePath);
  if (hasFile) return `配置文件(${filePath})`;

  const envName =
    kind === 'monorepo'
      ? 'APAAS_MONOREPO_TEMPLATE_GIT'
      : 'APAAS_NORMAL_TEMPLATE_GIT';

  if (process.env[envName]) return `环境变量(${envName})`;
  return '内置默认值';
}

export function registerConfigCommand(program: Command) {
  program
    .command('config')
    .description('查看当前模板仓库配置')
    .action(() => {
      const cfg = loadConfig();
      const filePath = getConfigFilePath();

      log.info('当前模板仓库配置如下：');
      log.info('');
      log.info(`monorepo集合: ${cfg.templates.monorepo}`);
      log.info(`  来源: ${getConfigSource('monorepo')}`);
      log.info('');
      log.info(`普通项目   : ${cfg.templates.normal}`);
      log.info(`  来源: ${getConfigSource('normal')}`);
      log.info('');
      log.info(`配置文件路径（如存在）: ${filePath}`);
    });
}

