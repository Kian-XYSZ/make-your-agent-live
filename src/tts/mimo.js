/**
 * 小米 MiMo TTS —— 三种模式共用 chat/completions 端点。
 *
 *   clone   用一段录音复刻音色（audio.voice = data URL）
 *   design  用文字描述凭空造音色（messages[0] = 描述，不传 voice）
 *   preset  用内置音色（audio.voice = 音色名）
 *
 * 关键：**模式不同，messages[0] 的含义也不同**。
 *   design 的 user 消息是「音色描述」；
 *   clone / preset 的 user 消息是「朗读风格」。
 */

import { readFileSync } from 'node:fs';
import { postJson } from '../http.js';

const MODEL_CLONE = 'mimo-v2.5-tts-voiceclone';
const MODEL_DESIGN = 'mimo-v2.5-tts-voicedesign';
const MODEL_PRESET = 'mimo-v2.5-tts';

const MAX_SAMPLE_BYTES = 10 * 1024 * 1024;
export const PRESET_VOICES = [
  'mimo_default', '冰糖', '茉莉', '苏打', '白桦', 'Mia', 'Chloe', 'Milo', 'Dean',
];

function dataUrl(path) {
  const bytes = readFileSync(path);
  if (bytes.length > MAX_SAMPLE_BYTES) {
    throw new Error(`音色样本超过 10MB：${bytes.length} 字节`);
  }
  const mime = path.toLowerCase().endsWith('.mp3') ? 'audio/mpeg' : 'audio/wav';
  return `data:${mime};base64,${bytes.toString('base64')}`;
}

export async function synthesize(text, opts, config) {
  const { apiKey, base } = config.tts.mimo;
  if (!apiKey) throw new Error('缺少 XIAOMI_API_KEY');

  const format = opts.format === 'mp3' ? 'mp3' : 'wav';
  const style = (opts.style ?? '').trim();
  const audio = { format };
  let model;
  let messages;

  if (opts.voiceFile) {
    model = MODEL_CLONE;
    audio.voice = dataUrl(opts.voiceFile);
    messages = [
      { role: 'user', content: style },
      { role: 'assistant', content: text },
    ];
  } else if ((opts.design ?? '').trim()) {
    model = MODEL_DESIGN;
    messages = [
      { role: 'user', content: opts.design.trim() },
      { role: 'assistant', content: text },
    ];
  } else {
    model = MODEL_PRESET;
    const voice = PRESET_VOICES.includes(opts.presetVoice) ? opts.presetVoice : 'mimo_default';
    audio.voice = voice;
    messages = [
      { role: 'user', content: style || '请用自然、清晰、亲切的语气朗读下面这段文字。' },
      { role: 'assistant', content: text },
    ];
  }

  const payload = await postJson(
    `${base}/chat/completions`,
    { model, messages, audio, stream: false },
    { 'api-key': apiKey },
  );

  const b64 = payload?.choices?.[0]?.message?.audio?.data;
  if (typeof b64 !== 'string' || !b64) {
    throw new Error(`MiMo 响应里没有音频：${JSON.stringify(payload).slice(0, 200)}`);
  }
  return { data: Buffer.from(b64, 'base64'), format, model };
}
