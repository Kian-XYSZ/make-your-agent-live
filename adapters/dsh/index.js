/**
 * DSH 适配器 —— 把 myal 的两个能力注册成 DSH 的工具。
 *
 * 装了之后 agent 可以直接调：
 *   tts(text)  → 生成语音文件，返回路径
 *   asr(path)  → 把语音文件转成文字
 *
 * 不装 DSH 也能用：CLI 和库都走同一套 src/。
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { loadConfig } from '../../src/config.js';
import { speak } from '../../src/tts/index.js';
import { transcribe } from '../../src/asr/index.js';

export const name = 'make-your-agent-live';
export const inject = ['tools'];

/**
 * 输出目录。
 *
 * 关键设计：**如果 QQ 网关的 outbox 存在，就写进那里**。
 * 因为网关的 fileSendPolicy 只允许发 outbox 里的文件，
 * 写别处的话 agent 还得手动拷一次。
 */
function outputDir() {
  if (process.env.MYAL_OUT_DIR) return process.env.MYAL_OUT_DIR;
  const outbox = join(homedir(), '.dsh', 'storages', 'qq-gateway-outbox');
  if (existsSync(outbox)) return outbox;
  return join(homedir(), '.dsh', 'storages', 'myal-out');
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function buildTtsTool() {
  return {
    name: 'tts',
    description:
      '把文字合成为语音文件，返回本地路径。可以用克隆音色（自己的声音）、音色设计（文字描述造音色）或内置音色。'
      + '生成的文件写在 QQ 网关的 outbox 目录（如果存在），可以直接用 qq_send 的 record 段发出去。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        text: { type: 'string', description: '要朗读的文字（必填）' },
        voiceFile: { type: 'string', description: '克隆用的音色样本路径；不填则用配置里的 tts.voiceFile' },
        design: { type: 'string', description: '音色描述（没有样本时用它凭空造音色，会走 voicedesign）' },
        style: { type: 'string', description: '朗读风格提示。慎用：可能连发声方式一起改掉，音色会漂' },
        tempo: { type: 'number', description: '语速倍数 1.0–2.0，纯音频变速、不改音色；1.5 以上开始有机械感' },
        format: { type: 'string', enum: ['wav', 'mp3'], description: '音频格式，默认 wav' },
      },
      required: ['text'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          path: { type: 'string', description: '音频文件绝对路径' },
          bytes: { type: 'number' },
          format: { type: 'string' },
          provider: { type: 'string' },
          tempo: { type: 'number' },
        },
        required: ['path', 'bytes', 'format', 'provider'],
      },
      render(_args, value) {
        return [{
          type: 'text',
          text: `已生成语音：${value.path}（${value.format}，${(value.bytes / 1024).toFixed(1)} KB，provider=${value.provider}）`,
        }];
      },
    },
    timeoutMs: 180_000,
    async execute(args) {
      const text = String(args?.text ?? '').trim();
      if (!text) throw new Error('tts: text 不能为空');

      const config = loadConfig();
      const result = await speak(text, {
        voiceFile: args?.voiceFile,
        design: args?.design,
        style: args?.style,
        tempo: args?.tempo,
        format: args?.format,
      }, config);

      const dir = outputDir();
      await mkdir(dir, { recursive: true });
      const path = join(dir, `myal-${stamp()}.${result.format}`);
      await writeFile(path, result.data);

      return {
        path,
        bytes: result.data.length,
        format: result.format,
        provider: result.provider,
        tempo: result.tempo,
      };
    },
  };
}

function buildAsrTool() {
  return {
    name: 'asr',
    description:
      '把语音文件转成文字。用于听懂用户发来的语音消息（QQ 网关会把语音文件路径给你，或者用 qq_action 的 get_record 取）。'
      + '多个引擎会自动降级，不会因为一个 key 过期就听不见。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        path: { type: 'string', description: '音频文件绝对路径（必填）' },
        language: { type: 'string', description: '语种，默认 zh' },
      },
      required: ['path'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          text: { type: 'string' },
          provider: { type: 'string' },
        },
        required: ['text', 'provider'],
      },
      render(_args, value) {
        return [{ type: 'text', text: `转写（${value.provider}）：${value.text}` }];
      },
    },
    timeoutMs: 180_000,
    async execute(args) {
      const path = String(args?.path ?? '').trim();
      if (!path) throw new Error('asr: path 不能为空');
      const config = loadConfig();
      const result = await transcribe(path, { language: args?.language }, config);
      return { text: result.text, provider: result.provider };
    },
  };
}

/**
 * @param {any} ctx
 */
export function apply(ctx) {
  ctx.tools.register(buildTtsTool());
  ctx.tools.register(buildAsrTool());
}
