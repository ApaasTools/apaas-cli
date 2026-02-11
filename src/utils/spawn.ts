import spawn from 'cross-spawn';
import type { SpawnSyncOptions } from 'node:child_process';

export function spawnSync(
  command: string,
  args: string[],
  options: SpawnSyncOptions = {}
) {
  const result = spawn.sync(command, args, {
    stdio: 'inherit',
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if (typeof result.status === 'number' && result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with code ${result.status}`);
  }
}

