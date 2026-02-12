import fs from "node:fs";
import path from "node:path";
import type { Command } from "commander";
import express from "express";
import cors from "cors";
import { spawn } from "node:child_process";

import { outputWarning } from "../utils/warning";
import { log } from "../utils/log";
import {
  type ApaasJson,
  resolveAbs,
  ensureDirExists,
  readJsonFile,
  validateEntry,
  buildRslibArgs,
  // resolveDistRoot,
} from "../utils/apaasModule";

function extractForwardedArgs(rawArgv: string[], extracted: { name?: string }) {
  const forwarded: string[] = [];

  for (let i = 0; i < rawArgv.length; i++) {
    const arg = rawArgv[i];

    const eqMatch = arg.match(/^--?name=(.+)$/);
    if (eqMatch) {
      extracted.name = eqMatch[1];
      continue;
    }

    if (arg === "--name" || arg === "-n") {
      const next = rawArgv[i + 1];
      if (next && !next.startsWith("-")) {
        extracted.name = next;
        i++;
      } else {
        extracted.name = "";
      }
      continue;
    }

    forwarded.push(arg);
  }

  return forwarded;
}

export function registerRunCommand(program: Command) {
  program
    .command("run <moduleDir>")
    .description("开发模式运行自定义模块，启动本地静态服务器并监听构建变更")
    .option("-n, --name <name>", "配置文件名（默认 apaas.json）")
    .allowUnknownOption(true)
    .action(async (moduleDir: string, options: { name?: string }) => {
      outputWarning();

      try {
        const absModuleDir = resolveAbs(moduleDir);
        ensureDirExists(absModuleDir);

        // 透传额外参数给 rslib，但需要排除自定义参数 --name
        const extracted: { name?: string } = { name: options.name };
        const rawArgv = process.argv.slice(4);
        const forwardedArgs = extractForwardedArgs(rawArgv, extracted);

        const configName = extracted.name ?? "apaas.json";
        if (!configName.endsWith(".json")) {
          throw new Error(`--name 必须是 .json 文件名：${configName}`);
        }

        const configPath = path.resolve(absModuleDir, configName);
        const apaasConfig = readJsonFile<ApaasJson>(configPath);

        if (!apaasConfig.entry || typeof apaasConfig.entry !== "string") {
          throw new Error(`配置文件缺少有效的 entry 字段：${configPath}`);
        }
        if (
          !apaasConfig.outputName ||
          typeof apaasConfig.outputName !== "string"
        ) {
          throw new Error(`配置文件缺少有效的 outputName 字段：${configPath}`);
        }

        const entryAbsPath = validateEntry(absModuleDir, apaasConfig.entry);

        // const { distRoot: staticDir } = await resolveDistRoot(
        //   absModuleDir,
        //   apaasConfig.outputName
        // );

        const staticDir = path.resolve(
          process.cwd(),
          `zip/${apaasConfig.outputName}`
        );
        process.env.PUBLIC_OUTPUT_DIR = staticDir;

        if (!fs.existsSync(staticDir)) {
          fs.mkdirSync(staticDir, { recursive: true });
        }

        await startServer({
          absModuleDir,
          apaasConfig,
          staticDir,
          entryAbsPath,
          forwardedArgs,
        });
      } catch (e) {
        log.error(
          `run 命令执行失败: ${String(e instanceof Error ? e.message : e)}`
        );
      }

      outputWarning();
    });
}

async function startServer(params: {
  absModuleDir: string;
  apaasConfig: Pick<ApaasJson, "outputName">;
  staticDir: string;
  entryAbsPath: string;
  forwardedArgs: string[];
}) {
  const { absModuleDir, apaasConfig, staticDir, entryAbsPath, forwardedArgs } =
    params;

  const app = express();
  const clients = new Set<express.Response>();

  app.use(cors());
  console.info("staticDir", staticDir);
  // 旧写法，为了兼容旧插件
  app.use(express.static(staticDir));
  // 新写法
  app.use(`/app/${apaasConfig.outputName}/`, express.static(staticDir));
  app.use(`/m/${apaasConfig.outputName}/`, express.static(staticDir));

  app.get("/sse", (req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    req.on("close", () => {
      clients.delete(res);
      log.info("客户端断开SSE连接");
    });

    clients.add(res);
    log.info("新的SSE客户端连接");
  });

  const DEFAULT_PORT = 3000;

  const getPortMod = await eval("import('get-port')");
  const getPort = (getPortMod as any).default ?? getPortMod;

  const availablePort = await getPort({
    port: Array.from({ length: 101 }, (_, i) => 3000 + i),
    host: "127.0.0.1",
  });

  app.listen(availablePort, "127.0.0.1", async () => {
    log.success(`静态资源服务器启动: http://127.0.0.1:${availablePort}/`);

    if (availablePort !== DEFAULT_PORT) {
      log.warn(
        `端口 ${DEFAULT_PORT} 被占用，已自动切换到端口 ${availablePort}`
      );
    }

    log.info(`静态资源目录: ${staticDir}`);

    const rslibArgs = buildRslibArgs({
      moduleDir: absModuleDir,
      watch: true,
      forwardedArgs,
    });
    log.info(`构建命令: npx ${rslibArgs.join(" ")}`);

    const buildProcess = startBuild({
      absModuleDir,
      entryAbsPath,
      apaasConfig,
      rslibArgs,
    });

    const watcher = await watchBuildOutput({ staticDir, clients });

    const cleanup = () => {
      log.warn("接收到终止信号，正在关闭服务...");

      watcher.close();

      if (buildProcess && !buildProcess.killed) {
        const pid = buildProcess.pid;
        if (typeof pid === "number") {
          try {
            process.kill(-pid, "SIGTERM");
          } catch {
            buildProcess.kill("SIGTERM");
          }
        } else {
          buildProcess.kill("SIGTERM");
        }
      }

      try {
        if (fs.existsSync(staticDir)) {
          fs.rmSync(staticDir, { recursive: true, force: true });
        }
      } catch (e) {
        log.warn(
          `清理临时目录失败: ${String(e instanceof Error ? e.message : e)}`
        );
      }

      process.exit(0);
    };

    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);
  });
}

function startBuild(params: {
  absModuleDir: string;
  entryAbsPath: string;
  apaasConfig: Pick<ApaasJson, "outputName">;
  rslibArgs: string[];
}) {
  const { absModuleDir, entryAbsPath, apaasConfig, rslibArgs } = params;

  const env = {
    ...process.env,
    RSBUILD_ENV_HOT: "true",
    PUBLIC_OUTPUT_NAME: apaasConfig.outputName,
    PUBLIC_ENTRY: entryAbsPath,
  };

  const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
  const buildProcess = spawn(npxCmd, rslibArgs, {
    env,
    cwd: absModuleDir,
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });

  buildProcess.stdout.on("data", (data) => {
    const result = data.toString().trim();
    if (result) {
      log.success(`源代码更新: ${result}`);
    }
  });

  buildProcess.stderr.on("data", (data) => {
    const msg = data.toString().trim();
    if (msg) {
      log.error(`构建错误: ${msg}`);
    }
  });

  buildProcess.on("close", (code) => {
    log.warn(`构建进程退出，退出码: ${code}`);
  });

  return buildProcess;
}

async function watchBuildOutput(params: {
  staticDir: string;
  clients: Set<express.Response>;
}) {
  const { staticDir, clients } = params;

  const chokidarMod = await eval("import('chokidar')");
  const chokidar = (chokidarMod as any).default ?? chokidarMod;

  const watcher = chokidar.watch(staticDir, {
    ignored: /(^|[/\\])\../,
    persistent: true,
    ignoreInitial: true,
  });

  log.info(`正在监听构建产物目录: ${staticDir}`);

  watcher.on("all", (event: string, filePath: string) => {
    const relativePath = path.relative(process.cwd(), filePath);
    if (event === "change") {
      log.info(`构建产物变化: ${relativePath}`);

      clients.forEach((client) => {
        log.info("发送SSE刷新通知");
        client.write(
          `data: ${JSON.stringify({
            event,
            filePath: path.basename(relativePath),
          })}\n\n`
        );
      });
    }
  });

  watcher.on("error", (error: unknown) => {
    log.error(`文件监听错误: ${String(error)}`);
  });

  return watcher;
}
