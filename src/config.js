/**
 * 配置加载。
 *
 * 优先顺序（后面的覆盖前面的）：
 *   1. 内置默认值
 *   2. ~/.dsh/.credentials.yaml  （顶层 KEY: value）
 *   3. ./.env                    （KEY=VALUE）
 *   4. process.env
 *   5. ./myal.config.json        （结构化配置，最高优先）
 *
 * 设计原则：**没有 key 也要能跑**（降级到系统语音）。
 */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const DEFAULTS = {
  tts: {
    provider: 'auto', // auto | mimo | minimax | local | system
    tempo: 1.0,
    voiceFile: null,
    design: '',
    presetVoice: 'mimo_default',
  },
  asr: {
    provider: 'auto', // auto | minimax | deepseek | mimo | local
    language: 'zh',
  },
  qq: {
    httpUrl: 'http://127.0.0.1:3000',
    accessToken: '',
  },
};

function parseEnvFile(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/** 只取顶层 `KEY: value`，跳过缩进的嵌套记录（credentials.yaml 里有 records）。 */
function parseFlatYaml(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (/^\s/.test(raw)) continue; // 缩进行属于嵌套结构，跳过
    const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*['"]?([^'"#\r\n]*?)['"]?\s*$/.exec(raw);
    if (m && m[2]) out[m[1]] = m[2];
  }
  return out;
}

function deepMerge(base, extra) {
  const out = { ...base };
  for (const [k, v] of Object.entries(extra ?? {})) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) ? deepMerge(base[k] ?? {}, v) : v;
  }
  return out;
}

let cached = null;

export function loadConfig({ cwd = process.cwd(), reload = false } = {}) {
  if (cached && !reload) return cached;

  const env = {
    ...parseFlatYaml(join(homedir(), '.dsh', '.credentials.yaml')),
    ...parseEnvFile(join(cwd, '.env')),
    ...process.env,
  };

  let config = structuredClone(DEFAULTS);

  // 环境变量 → 配置
  if (env.XIAOMI_API_KEY) env.XIAOMI_API_KEY = env.XIAOMI_API_KEY.trim();
  config.env = env;

  config.tts.mimo = {
    apiKey: env.XIAOMI_API_KEY ?? '',
    base: env.MIMO_TTS_BASE ?? 'https://api.xiaomimimo.com/v1',
  };
  config.tts.minimax = {
    apiKey: env.MINIMAX_API_KEY ?? '',
    groupId: env.MINIMAX_GROUP_ID ?? '',
    base: env.MINIMAX_TTS_BASE ?? 'https://api.minimax.chat/v1',
  };
  config.tts.local = {
    endpoint: env.LOCAL_TTS_ENDPOINT ?? '',
  };
  config.asr.minimax = {
    apiKey: env.MINIMAX_API_KEY ?? '',
    base: env.MINIMAX_API_BASE ?? 'https://api.minimax.chat/v1',
  };
  config.asr.deepseek = {
    apiKey: env.DEEPSEEK_API_KEY ?? '',
    base: env.DEEPSEEK_ASR_BASE ?? 'https://api.deepseek.com/v1',
  };
  config.asr.mimo = {
    apiKey: env.XIAOMI_API_KEY ?? '',
    base: env.MIMO_ASR_BASE ?? 'https://api.xiaomimimo.com/v1',
  };
  config.asr.local = {
    endpoint: env.LOCAL_ASR_ENDPOINT ?? '',
  };
  config.qq.httpUrl = env.ONEBOT_HTTP_URL ?? config.qq.httpUrl;
  config.qq.accessToken = env.ONEBOT_ACCESS_TOKEN ?? config.qq.accessToken;

  // 结构化配置覆盖
  const jsonPath = resolve(cwd, 'myal.config.json');
  if (existsSync(jsonPath)) {
    try {
      config = deepMerge(config, JSON.parse(readFileSync(jsonPath, 'utf8')));
    } catch (err) {
      throw new Error(`myal.config.json 解析失败：${err.message}`);
    }
  }

  // voiceFile 相对 cwd 解析
  if (config.tts.voiceFile && !/^([A-Za-z]:|\\|\/|\/\/)/.test(config.tts.voiceFile)) {
    config.tts.voiceFile = resolve(cwd, config.tts.voiceFile);
  }

  cached = config;
  return config;
}

/** 某个 provider 是否具备运行条件。 */
export function isReady(config, kind, provider) {
  const c = config[kind]?.[provider];
  if (!c) return false;
  switch (`${kind}:${provider}`) {
    case 'tts:mimo':
      return Boolean(c.apiKey);
    case 'tts:minimax':
      return Boolean(c.apiKey);
    case 'tts:local':
      return Boolean(c.endpoint);
    case 'tts:system':
      return process.platform === 'win32' || process.platform === 'darwin';
    case 'asr:minimax':
      return Boolean(c.apiKey);
    case 'asr:deepseek':
      return Boolean(c.apiKey);
    case 'asr:mimo':
      return Boolean(c.apiKey);
    case 'asr:local':
      return Boolean(c.endpoint);
    default:
      return false;
  }
}

/** 按优先级列出候选 provider。 */
export function candidates(config, kind) {
  const chain = {
    tts: ['mimo', 'minimax', 'local', 'system'],
    asr: ['minimax', 'deepseek', 'mimo', 'local'],
  }[kind];
  const want = config[kind]?.provider ?? 'auto';
  const ordered = want === 'auto' ? chain : [want, ...chain.filter((p) => p !== want)];
  return ordered.filter((p) => isReady(config, kind, p));
}
