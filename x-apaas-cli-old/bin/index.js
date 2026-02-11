#!/usr/bin/env node
/*
 * @Author: Devin Shi
 * @Email: yutian.shi@definesys.com
 * @Date: 2018-11-24 01:49:46
 * @LastEditTime: 2019-11-06 09:14:18
 * @LastEditors: Devin Shi
 * @Description:
 */
const program = require("commander");
const shelljs = require("shelljs");
const package = require("../package.json");
const userHome = require("user-home");
const fs = require("fs");
const path = require("path");
const colors = require("colors");
const inquirer = require("inquirer")

const outputWarning = () => {
  console.warn(colors.yellow('--------------------------------- WARNING ----------------------------------------'))
  console.warn(colors.yellow('注意：此脚手架即将废弃，请移步至更快更好的 df-apaas-cli，详情请访问：https://docs.definesys.cn/docs/openapi/04-%E5%B9%B3%E5%8F%B0%E5%BC%80%E5%8F%91%E6%89%A9%E5%B1%95%E8%83%BD%E5%8A%9B/05-%E5%89%8D%E7%AB%AF%E6%89%A9%E5%B1%95%E5%BC%80%E5%8F%91.html'))
  console.warn(colors.yellow('----------------------------------------------------------------------------------'))
}

program.version(package.version).usage("<command> [option]");

program
  .command("init <name>")
  .option(
    "-v, --version <version>",
    "template starter version with x-apaas-cli"
  )
  .option("-u, --userhome <userhome>", "set a local path with custom user home")
  .description("init project with x-apaas-cli")
  .action((name, cmd) => {
    outputWarning()

    const promptList = [
      {
        type: "list",
        message: "请选择将要创建的项目类型：",
        name: "projectType",
        choices: [
          "Web",
          "Mobile"
        ]
      }
    ]
    inquirer.prompt(promptList).then((answers) => {
            const projectType = answers.projectType
      require(`./lib/${cmd._name}`)(name, projectType, cmd, program);
      outputWarning()
    })
  });

program
  .command("build <name>")
  .description("build custom module with x-apaas-cli")
  .action((name, cmd) => {
    outputWarning()
    require(`./lib/${cmd._name}`)(name, cmd, program);
    outputWarning()
  });

program
  .command("install")
  .description("install the all dependencies")
  .action((name, cmd) => {
    outputWarning()
    require(`./lib/${name._name}`)(name, cmd, program);
    outputWarning()
  });

  program
  .command("build-plugins <name>")
  .description("build custom plugin with x-apaas-cli")
  .action((name, cmd) => {
    outputWarning()
    require(`./lib/${cmd._name}`)(name, cmd, program);
    outputWarning()
  });

program.parse(process.argv);

if (!program.args || !program.args.length) {
  outputWarning()
  program.help();
}
