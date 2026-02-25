#!/usr/bin/env node

import { Command } from 'commander';

import { registerInitCommand } from './commands/init';
import { registerInstallCommand } from './commands/install';
import { registerBuildCommand } from './commands/build';
import { registerSetCommand } from './commands/set';
import { registerConfigCommand } from './commands/config';
import { registerRunCommand } from './commands/run';
import { outputWarning } from './utils/warning';
import pkg from '../package.json'

const program = new Command();

program
  .name('apaas')
  .description('Apaas CLI')
  .version(pkg.version)
  .usage('<command> [option]');

registerInitCommand(program);
registerBuildCommand(program);
registerRunCommand(program);
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
