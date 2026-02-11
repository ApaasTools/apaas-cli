import fs from 'node:fs';
import path from 'node:path';
import type { Command } from 'commander';
import shelljs from 'shelljs';

import { log } from '../utils/log';
import { spawnSync } from '../utils/spawn';
import { outputWarning } from '../utils/warning';

function removeNestedNodeModules() {
  const apaasNodeModulesPath = path.resolve(process.cwd(), 'node_modules/@x-apaas');

  if (!fs.existsSync(apaasNodeModulesPath)) return;

  const dirs = fs.readdirSync(apaasNodeModulesPath);
  for (const dir of dirs) {
    const moduleNodeModulesPath = path.resolve(apaasNodeModulesPath, dir, 'node_modules');
    if (fs.existsSync(moduleNodeModulesPath)) {
      shelljs.rm('-rf', moduleNodeModulesPath);
    }
  }
}

export function registerInstallCommand(program: Command) {
  program
    .command('install')
    .description('安装依赖（基础版）')
    .option('-p, --pkg <name>', '额外安装的包名（可选）')
    .action((options: { pkg?: string }) => {
      outputWarning();

      const usePnpm = fs.existsSync(path.resolve(process.cwd(), 'pnpm-lock.yaml'));
      const pm = usePnpm ? 'pnpm' : 'npm';

      log.info(`info 使用包管理器：${pm}`);

      if (pm === 'pnpm') {
        spawnSync('pnpm', ['install']);
        if (options.pkg) {
          spawnSync('pnpm', ['add', options.pkg]);
        }
      } else {
        spawnSync('npm', ['install']);
        if (options.pkg) {
          spawnSync('npm', ['install', '--save', options.pkg]);
        }
      }

      removeNestedNodeModules();
      outputWarning();
    });
}

