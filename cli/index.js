#!/usr/bin/env node
/**
 * myal —— make-your-agent-live 的命令行。
 *
 * 这个 CLI 存在的理由：**任何 agent 都能跑 shell 命令**。
 * 不需要插件系统，Claude Code / Cursor / Codex / DSH / 脚本 都能用。
 *
 *   myal tts "文字" -o out.wav
 *   myal asr voice.wav
 *   myal qq send --record out.wav --to 123456
 *   myal qq status
 *   myal doctor
 */

import { spawn } from 'node:child_process';
import { existsSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { loadConfig, candidates, isReady } from '../src/config.js';
import { speak } from '../src/tts/index.js';
import { transcribe } from '../src/asr/index.js';
import { onebotFromConfig } from '../src/qq/onebot.js';
import { ffmpegAvailable } from '../src/ffmpeg.js';

const HELP = `myal —— give your agent a voice and ears

用法:
  myal tts "要说的文字" [-o 输出.wav] [选项]
  myal asr <音频文件> [--lang zh]
  myal qq send [--text 文字 | --record 音频 | --image 图片] (--to QQ号 | --group 群号)
  myal qq status
  myal doctor [--full]
  myal config

tts 选项:
  -o, --out <file>      输出路径（默认 ./out.wav）
      --voice <file>    克隆样本（默认取配置 tts.voiceFile）
      --design <文字>   音色描述（没有样本时用，会走 voicedesign）
      --style <文字>    朗读风格（慎用：可能改变音色）
      --tempo <倍数>    1.0–2.0，纯音频变速，不改音色
      --format <wav|mp3>
      --provider <名>   mimo | minimax | local | system

asr 选项:
      --lang <语种>     zh | en | ja ...（默认 zh）
      --provider <名>   minimax | deepseek | mimo | local

qq 选项:
      --to <QQ号>       私聊对象
      --group <群号>    群（需 @ 才回，发的话直接发）
      --as-path         用本机路径而不是 base64（同一台机器上更快）

配置来源（优先级从低到高）:
  ~/.dsh/.credentials.yaml → ./.env → 环境变量 → ./myal.config.json
`;

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) flags[key] = true;
      else { flags[key] = next; i += 1; }
    } else if (arg.startsWith('-') && arg.length === 2) {
      const key = arg.slice(1);
      const next = argv[i + 1];
      if (next === undefined) flags[key] = true;
      else { flags[key] = next; i += 1; }
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

function ok(message) {
  console.log(`✔ ${message}`);
}

function human(bytes) {
  return bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(2)} MB`
    : `${(bytes / 1024).toFixed(1)} KB`;
}

function fmtDuration(sec) {
  return sec >= 60 ? `${Math.floor(sec / 60)}分${(sec % 60).toFixed(1)}秒` : `${sec.toFixed(2)}秒`;
}

// ── tts ──────────────────────────────────────────────────────────────────────
async function cmdTts({ flags }) {
  const text = String(flags.text ?? flags._?.[0] ?? '').trim();
  if (!text) fail('要给文字：myal tts "你好"');

  const out = resolve(String(flags.out ?? flags.o ?? './out.wav'));
  const config = loadConfig();
  if (flags.provider) config.tts.provider = String(flags.provider);

  const result = await speak(text, {
    voiceFile: flags.voice ? resolve(String(flags.voice)) : undefined,
    design: flags.design ? String(flags.design) : undefined,
    style: flags.style ? String(flags.style) : undefined,
    tempo: flags.tempo ? Number(flags.tempo) : undefined,
    format: flags.format === 'mp3' ? 'mp3' : 'wav',
    voiceId: flags['voice-id'],
  }, config);

  writeFileSync(out, result.data);
  ok(`已生成 ${out}  ${human(result.data.length)}  provider=${result.provider}  tempo=${result.tempo}`);
  console.log(JSON.stringify({ ok: true, path: out, provider: result.provider, bytes: result.data.length }));
}

// ── asr ──────────────────────────────────────────────────────────────────────
async function cmdAsr({ positional, flags }) {
  const file = positional[0];
  if (!file) fail('要给音频文件：myal asr voice.wav');
  const path = resolve(file);
  if (!existsSync(path)) fail(`文件不存在：${path}`);

  const config = loadConfig();
  if (flags.provider) config.asr.provider = String(flags.provider);

  const result = await transcribe(path, { language: flags.lang }, config);
  ok(`转写完成  provider=${result.provider}`);
  console.log(JSON.stringify({ ok: true, text: result.text, provider: result.provider }));
}

// ── qq ───────────────────────────────────────────────────────────────────────
async function cmdQq({ positional, flags }) {
  const sub = positional[0];
  const config = loadConfig();
  const bot = onebotFromConfig(config);

  if (sub === 'status') {
    const login = await bot.loginInfo();
    const status = await bot.status();
    ok(`已连接  QQ ${login.user_id} (${login.nickname})`);
    console.log(JSON.stringify({ ok: true, login, status }, null, 2));
    return;
  }

  if (sub !== 'send') fail('用法：myal qq send ... 或 myal qq status');

  const target = flags.to !== undefined ? { userId: flags.to } : flags.group !== undefined ? { groupId: flags.group } : null;
  if (!target) fail('要指定 --to QQ号 或 --group 群号');

  const asPath = Boolean(flags['as-path']);
  let sent;
  if (flags.record) {
    const p = resolve(String(flags.record));
    if (!existsSync(p)) fail(`文件不存在：${p}`);
    sent = await bot.sendRecord(target, p, { asPath });
  } else if (flags.image) {
    const p = resolve(String(flags.image));
    if (!existsSync(p)) fail(`文件不存在：${p}`);
    sent = await bot.sendImage(target, p, { asPath });
  } else if (flags.text) {
    sent = await bot.sendText(target, String(flags.text));
  } else {
    fail('要指定 --text / --record / --image 之一');
  }

  ok(`已发送  message_id=${sent?.message_id ?? '(未知)'}`);
  console.log(JSON.stringify({ ok: true, data: sent }));
}

// ── doctor ───────────────────────────────────────────────────────────────────
async function cmdDoctor({ flags }) {
  const config = loadConfig();
  const lines = [];
  const add = (state, label, detail = '') => lines.push({ state, label, detail });

  const nodeMajor = Number(process.versions.node.split('.')[0]);
  add(nodeMajor >= 18 ? 'ok' : 'bad', `Node ${process.versions.node}`, nodeMajor >= 18 ? '' : '需要 ≥18（用内置 fetch / FormData）');

  add(process.platform === 'win32' || process.platform === 'darwin' ? 'ok' : 'warn',
    `平台 ${process.platform}`,
    process.platform === 'win32' ? '系统语音可用（SAPI）' : process.platform === 'darwin' ? '系统语音可用（say）' : '系统语音不可用，请配本地 TTS');

  add(await ffmpegAvailable() ? 'ok' : 'warn', 'ffmpeg', '缺了只是不能变速（--tempo 会被跳过）');

  for (const [kind, chain] of [['tts', candidates(config, 'tts')], ['asr', candidates(config, 'asr')]]) {
    add(chain.length ? 'ok' : 'bad', `${kind.toUpperCase()} 可用 provider`, chain.length ? chain.join(' → ') : '一个都没配，跑不通');
  }

  add(config.tts.voiceFile ? 'ok' : 'warn', '音色样本',
    config.tts.voiceFile ? config.tts.voiceFile : '没设 tts.voiceFile，会退化到 design / 内置音色');

  // OneBot 连通性
  try {
    const bot = onebotFromConfig(config);
    const login = await bot.loginInfo();
    add('ok', 'OneBot', `${config.qq.httpUrl} → QQ ${login.user_id} (${login.nickname})`);
  } catch (err) {
    add('warn', 'OneBot', `${config.qq.httpUrl} 连不上（如果宿主已内置 QQ 工具，可以忽略）`);
  }

  for (const { state, label, detail } of lines) {
    const mark = state === 'ok' ? '✔' : state === 'warn' ? '!' : '✖';
    console.log(`${mark} ${label}${detail ? `  — ${detail}` : ''}`);
  }

  const bad = lines.filter((l) => l.state === 'bad');
  if (bad.length) {
    console.log(`\n还有 ${bad.length} 个问题要修。`);
    process.exit(1);
  }

  if (flags.full) {
    console.log('\n=== 端到端自检 ===');
    await cmdTts({ flags: { text: '自检，一二三', out: './.myal-selftest.wav' } });
    await cmdAsr({ positional: ['./.myal-selftest.wav'], flags: {} });
  } else {
    console.log('\n加 --full 可以跑一次端到端自检。');
  }
}

// ── config ───────────────────────────────────────────────────────────────────
async function cmdConfig() {
  const config = loadConfig();
  const masked = JSON.parse(JSON.stringify(config, (k, v) => {
    if (typeof v === 'string' && /apiKey|accessToken|token/i.test(k) && v) return `${v.slice(0, 6)}…（已隐藏）`;
    return v;
  }));
  masked.env = Object.fromEntries(
    Object.entries(config.env ?? {}).map(([k, v]) => [k, /KEY|TOKEN/i.test(k) && v ? `${String(v).slice(0, 6)}…` : v]),
  );
  console.log(JSON.stringify(masked, null, 2));
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === 'help' || argv[0] === '--help' || argv[0] === '-h') {
    console.log(HELP);
    return;
  }

  const command = argv[0];
  const parsed = parseArgs(argv.slice(1));
  // 让 tts 的裸文字参数可用：myal tts "你好" -o x.wav
  parsed.flags._ = parsed.positional;

  try {
    switch (command) {
      case 'tts': return await cmdTts(parsed);
      case 'asr': return await cmdAsr(parsed);
      case 'qq': return await cmdQq(parsed);
      case 'doctor': return await cmdDoctor(parsed);
      case 'config': return await cmdConfig();
      default:
        console.error(`未知命令：${command}\n`);
        console.log(HELP);
        process.exit(1);
    }
  } catch (err) {
    fail(err.message);
  }
}

main();
