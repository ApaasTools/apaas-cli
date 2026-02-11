const spawn = require('cross-spawn');
const shelljs = require('shelljs');
const path = require('path');
const fs = require('fs');

const install = (name, cmd, program) => {
  spawn.sync('npm', ['install'], { stdio: 'inherit' });
  // const apaasInstallArgsStr = 'install --save @x-ui/x-dcloud-ui @x-apaas/x-dcloud-bpm@rc @x-apaas/x-dcloud-business-event@rc @x-apaas/x-dcloud-low-code-engine@rc @x-apaas/x-dcloud-page-engine@rc @x-apaas/x-dcloud-page-web@rc @x-apaas/x-lib-rule-engine@rc @x-apaas/x-dcloud-business-object@rc @x-apaas/x-apaas-frontend-i18n@rc'
  const apaasInstallArgsStr = 'install --save @x-ui/x-dcloud-ui'
  spawn.sync('npm', apaasInstallArgsStr.split(' '), { stdio: 'inherit' });

  // node:12 安装完依赖后，遍历node_modules/@x-apaas目录下的所有包，删除其下的node_modules目录，避免重复依赖
  const apaasNodeModulesPath = path.resolve(
    process.cwd(),
    'node_modules/@x-apaas'
  );

  if (fs.existsSync(apaasNodeModulesPath)) {
    const dirs = fs.readdirSync(apaasNodeModulesPath);
    dirs.forEach((dir) => {
      const moduleNodeModulesPath = path.resolve(
        apaasNodeModulesPath,
        dir,
        'node_modules'
      );
      if (fs.existsSync(moduleNodeModulesPath)) {
        shelljs.rm('-rf', moduleNodeModulesPath);
      }
    });
  }
}

module.exports = install;
