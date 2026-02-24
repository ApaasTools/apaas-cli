# @apaas/cli

`@apaas/cli` 是一款面向 APaaS 项目的命令行工具，提供：

- 项目初始化
- 自定义模块构建
- 本地开发调试
- 模板仓库配置管理
- 环境诊断

帮助你快速搭建和管理 APaaS 应用及其自定义模块。

---

## 安装

### 全局安装（推荐）

```bash
npm install -g @apaas/cli
# 或
yarn global add @apaas/cli
# 或
pnpm add -g @apaas/cli
```

安装完成后，即可使用命令：

```bash
apaas -h
```

你会看到类似输出：

```bash
Usage: apaas <command> [option]

Apaas CLI

Options:
  -V, --version                output the version number
  -h, --help                   display help for command

Commands:
  init [options] <name>        初始化项目
  build [options] <moduleDir>  根据模块目录与 apaas.json 构建自定义模块
  run [options] <moduleDir>    开发模式运行自定义模块，启动本地静态服务器并监听构建变更
  install [options]            安装依赖（基础版）
  set                          配置模板仓库地址（monorepo集合 / 普通项目）
  config                       查看当前模板仓库配置
  doctor                       环境诊断（基础版）
  help [command]               display help for command
```

### 项目内安装（可选）

```bash
npm install @apaas/cli --save-dev
```

在 `package.json` 中添加脚本：

```jsonc
{
  "scripts": {
    "apaas": "apaas"
  }
}
```

使用方式：

```bash
npm run apaas -- -h
```

---

## 快速开始

### 1. 初始化项目

```bash
# 在当前目录下初始化一个名为 my-module 的自定义模块工程
apaas init my-module
```

基于源码 `src/commands/init.ts`，`init` 命令的实际行为为：

- **交互选择项目类型**：
  - `monorepo集合`
  - `普通项目`
- **读取 CLI 配置**：通过 `apaas config` 事先配置好的模板仓库地址，按项目类型选择对应的 git 仓库。
- **校验环境**：
  - 若未配置对应类型的模板仓库地址，提示执行 `apaas set` 进行配置并退出。
  - 若本机未安装 `git`，会提示错误并退出。
- **拉取模板仓库**：
  - 默认从配置的模板仓库 clone 最新代码。
  - 可通过 `-v, --version` 指定模板 git 分支或 Tag，例如：
    ```bash
    apaas init my-module -v v1.0.0
    ```
  - 模板仓库会被 clone 到缓存目录：`<userhome>/.apaasCliRepo`（会在每次 init 前清空重建）。
- **创建工程目录**：
  - 工程目录命名规则：`apaas-custom-<name>`。
  - 在当前工作目录下生成：
    ```bash
    apaas-custom-my-module/
    ```
  - 若目录已存在，则提示错误并退出，避免覆盖已有工程。
- **复制模板内容**：
  - 将缓存仓库中的所有文件复制到新创建的 `apaas-custom-<name>` 目录中。
  - 会删除模板仓库内的 `.git` 目录，避免与实际项目仓库冲突。
- **示例自定义模块重命名与占位符替换**：
  - 假设模板中包含示例模块：`src/custom/apaas-custom-hello` 与 `public/custom/apaas-custom-hello`。
  - CLI 会：
    - 在示例模块代码中，将 `{{moduleName}}` 替换为你输入的 `name`（如 `my-module`）。
    - 将 `{{ModuleName}}` 替换为首字母大写形式（如 `My-module`）。
    - 将目录 `apaas-custom-hello` 重命名为 `apaas-custom-<name>`。
- **完成提示**：
  - 输出成功信息：
    ```bash
    success 已创建项目：<绝对路径>/apaas-custom-<name>
    ```

#### Init 命令参数

- **`<name>`（必填）**  
  自定义模块名称，用于：
  - 工程目录命名：`apaas-custom-<name>`
  - 模块相关代码和静态资源目录命名
  - 模板内占位符 `{{moduleName}}` / `{{ModuleName}}` 的替换

- **`-v, --version <version>`（可选）**  
  指定模板仓库的 git 分支或 Tag，例如：
  ```bash
  apaas init my-module -v feature/new-template
  apaas init my-module -v v1.0.0
  ```

- **`-u, --userhome <userhome>`（可选）**  
  自定义缓存目录（用于存放模板仓库缓存）。
  - 默认使用当前用户 home 目录：`os.homedir()`。
  - 实际缓存路径为：`<userhome>/.apaasCliRepo`。
  - 示例：
    ```bash
    # 使用自定义缓存目录
    apaas init my-module -u /data/cli-cache
    ```

> 注意：在使用 `init` 之前，建议先通过 `apaas set` 配置好模板仓库地址，并通过 `apaas config` 确认配置无误。

### 2. 构建自定义模块

```bash
# 假设你的自定义模块目录为 ./modules/custom-module
apaas build ./modules/custom-module
```

- **`moduleDir`**：模块目录路径。
- 根据模块目录下的 `apaas.json` 进行构建。
- 输出可部署或可集成到 APaaS 平台的模块构建产物。

> 详细构建流程请参考对应命令实现（如 `src/commands/build.ts`）。

### 3. 本地开发调试

```bash
# 启动本地静态服务器 + 监听构建变更
apaas run ./modules/custom-module
```

适用于：

- 开发阶段调试和联调
- 本地预览自定义模块效果
- 自动重新构建与刷新

> 具体端口、热更新策略等以 `run` 命令实现为准（例如内部可能使用 `express` + `chokidar` 等）。

---

## 命令总览

> 可通过 `apaas <command> -h` 查看各子命令的详细参数与选项。

- **`apaas init [options] <name>`**  
  初始化自定义模块工程，从模板仓库拉取项目模板，创建 `apaas-custom-<name>` 工程目录，并按模块名替换模板中的占位符。

- **`apaas build [options] <moduleDir>`**  
  根据模块目录与 `apaas.json` 构建自定义模块，生成构建产物。

- **`apaas run [options] <moduleDir>`**  
  开发模式运行自定义模块，启动本地静态服务器并监听构建变更，适合本地联调与预览。

- **`apaas install [options]`**  
  安装依赖（基础版），用于自动安装项目或模块所需的部分依赖，具体行为以实现为准。

- **`apaas set`**  
  配置模板仓库地址，包括：
  - monorepo 模板集合仓库地址
  - 普通项目模板仓库地址

- **`apaas config`**  
  查看当前模板仓库配置详情，例如：
  - 当前使用的模板仓库地址
  - 仓库类型（monorepo / 普通仓库）

- **`apaas doctor`**  
  环境诊断（基础版），检查当前开发环境是否满足 APaaS CLI 运行及构建需求，例如：
  - Node.js 版本
  - 包管理器可用性
  - 必要的系统依赖等

- **`apaas -V` / `apaas --version`**  
  查看当前 CLI 版本号。

- **`apaas -h` / `apaas --help`**  
  查看帮助信息。

---

## 配置文件与目录结构（示例）

使用 `build` / `run` 命令时，需要在模块目录下提供 `apaas.json` 等配置文件。  
一个典型的模块目录结构可能类似：

```bash
apaas-custom-my-module/
  apaas.json
  src/
    custom/
      apaas-custom-my-module/
        # 模块源码（由 init 从 hello 模板复制并替换占位符生成）
  public/
    custom/
      apaas-custom-my-module/
        # 静态资源
```

`apaas.json` 中通常包含：

- 模块名称、ID
- 入口文件路径
- 构建输出目录
- 运行环境要求
- 其他与 APaaS 平台集成相关的配置

> 具体字段请参考本仓库中的示例模块或源码注释。

---

## 开发与调试（面向仓库维护者）

如果你是 `@apaas/cli` 的维护者，或希望本地开发/调试 CLI：

```bash
# 克隆仓库
git clone https://github.com/<your-org-or-name>/apaas-cli.git
cd apaas-cli

# 安装依赖
npm install

# 构建
npm run build

# 本地 link 调试
npm link
# 之后可直接在终端使用：
apaas -h
```

常用 npm 脚本（以实际 `package.json` 为准）：

```bash
# 构建 TS -> JS
npm run build

# 本地开发（直接跑 TS）
npm run dev

# 启动已构建的 CLI
npm start
```

---

## CI/CD 与 npm 发布

本项目已配置 GitHub Actions，用于：

- **自动化检查与测试**：在 push / Pull Request 时运行
- **自动发布到 npm**：当你打 Git 标签或创建 Release 时，将新版本发布到 npm

### 推荐发布流程

1. 更新版本号：修改 `package.json` 中的 `version` 字段
2. 提交并推送代码：
   ```bash
   git commit -am "chore: release vX.Y.Z"
   git push origin main
   ```
3. 创建版本标签并推送：
   ```bash
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```
4. GitHub Actions 会在工作流通过后，将新版本发布到 npm 包：`@apaas/cli`

> **注意**：  
> - 在 GitHub 仓库中需要提前配置好 `NPM_TOKEN`，且拥有发布 `@apaas/cli` 的权限。  
> - CI 工作流文件位于 `.github/workflows/*.yml`，具体触发条件和发布逻辑请以其中配置为准。

---

## 示例

```bash
# 1. 配置模板仓库地址
apaas set

# 2. 初始化工程
apaas init my-module
cd apaas-custom-my-module

# 3. （可选）安装依赖
apaas install

# 4. 本地开发自定义模块
apaas run ./modules/custom-module   # 具体路径根据模板实际结构调整

# 5. 构建自定义模块
apaas build ./modules/custom-module

# 6. 查看模板仓库配置
apaas config

# 7. 环境诊断
apaas doctor
```

---

## License

MIT License

Copyright (c) 2024 [Your Name or Organization]

