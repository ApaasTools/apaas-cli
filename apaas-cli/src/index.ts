#!/usr/bin/env node

import { Command } from 'commander';

import { registerInitCommand } from './commands/init';
import { registerInstallCommand } from './commands/install';
import { registerBuildCommand } from './commands/build';
import { registerSetCommand } from './commands/set';
import { registerConfigCommand } from './commands/config';
import { outputWarning } from './utils/warning';

const program = new Command();

program
  .name('apaas')
  .description('APAAS 脚手架 CLI（TypeScript 版本）')
  .version('0.0.1')
  .usage('<command> [option]');

registerInitCommand(program);
registerBuildCommand(program);
registerInstallCommand(program);
registerSetCommand(program);
registerConfigCommand(program);

program
  .command('doctor')
  .description('环境诊断（基础版）')
  .action(() => {
    process.stdout.write('apaas doctor: ok\n');
  });

program.parse(process.argv);

if (!program.args || program.args.length === 0) {
  outputWarning();
  program.help();
}
