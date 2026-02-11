import type { Command } from 'commander';
import { spawnSync } from '../utils/spawn';
import { outputWarning } from '../utils/warning';

export function registerBuildCommand(program: Command) {
  program
    .command('build <name>')
    .description('构建自定义模块（基础版：调用项目内 build 脚本）')
    .action((name: string) => {
      outputWarning();
      // 旧版行为依赖模板工程，这里先做“可用”的基础实现：
      // 若模板工程定义了 build，则直接执行。
      spawnSync('pnpm', ['run', 'build']);
      outputWarning();
    });
}

