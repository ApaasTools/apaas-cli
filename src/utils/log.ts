import colors from 'colors/safe';

export const log = {
  info(msg: string) {
    process.stdout.write(`${msg}\n`);
  },
  warn(msg: string) {
    process.stdout.write(`${colors.yellow(msg)}\n`);
  },
  error(msg: string) {
    process.stderr.write(`${colors.red(msg)}\n`);
  },
  success(msg: string) {
    process.stdout.write(`${colors.green(msg)}\n`);
  },
};

