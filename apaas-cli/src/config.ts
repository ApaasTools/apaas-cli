import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

export type TemplateKind = 'monorepo' | 'normal';

export type ApaasConfig = {
  templates: {
    monorepo: string;
    normal: string;
  };
};

const DEFAULT_CONFIG: ApaasConfig = {
  templates: {
    monorepo:
      process.env.APAAS_MONOREPO_TEMPLATE_GIT ||
      'https://example.com/your-default-monorepo-template.git',
    normal:
      process.env.APAAS_NORMAL_TEMPLATE_GIT ||
      'https://example.com/your-default-normal-template.git',
  },
};

const CONFIG_FILE_NAME = '.apaas-cli.json';

function getConfigFilePath() {
  return path.resolve(os.homedir(), CONFIG_FILE_NAME);
}

export function loadConfig(): ApaasConfig {
  const filePath = getConfigFilePath();
  if (!fs.existsSync(filePath)) {
    return DEFAULT_CONFIG;
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<ApaasConfig>;
    return {
      templates: {
        monorepo: parsed.templates?.monorepo || DEFAULT_CONFIG.templates.monorepo,
        normal: parsed.templates?.normal || DEFAULT_CONFIG.templates.normal,
      },
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveTemplate(kind: TemplateKind, url: string) {
  const filePath = getConfigFilePath();
  const current = loadConfig();
  const next: ApaasConfig = {
    ...current,
    templates: {
      ...current.templates,
      [kind]: url,
    },
  } as ApaasConfig;

  fs.writeFileSync(filePath, JSON.stringify(next, null, 2), 'utf-8');
}

