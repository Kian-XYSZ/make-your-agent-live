/**
 * DeepSeek ASR。
 *
 * 端点：POST {base}/tools/asr，multipart/form-data
 * 字段：file=<音频>
 * 限制：16 位 PCM WAV 或 Ogg Opus，≤8 MiB，≤120 秒
 * 价格：0.39 元/小时（限时 5 折后的价格）
 * 返回：{ text, duration_ms, request_id }
 *
 * 文档：https://api-docs.deepseek.com/zh-cn/guides/asr
 */

import { readAudio } from '../audio.js';
import { postForm } from '../http.js';

const MAX_BYTES = 8 * 1024 * 1024;

export async function transcribe(path, opts, config) {
  const { apiKey, base } = config.asr.deepseek;
  if (!apiKey) throw new Error('缺少 DEEPSEEK_API_KEY');

  const audio = readAudio(path, { maxBytes: MAX_BYTES });
  if (!['wav', 'ogg'].includes(audio.format)) {
    throw new Error(`DeepSeek ASR 只收 wav / ogg opus，当前是 ${audio.format}`);
  }

  const form = new FormData();
  form.append('file', new Blob([audio.data], { type: audio.mime }), audio.name);

  const payload = await postForm(
    `${base}/tools/asr`,
    form,
    { Authorization: `Bearer ${apiKey}` },
  );
  const text = String(payload?.text ?? '').trim();
  if (!text) throw new Error(`DeepSeek ASR 返回空文本：${JSON.stringify(payload).slice(0, 200)}`);
  return { text, provider: 'deepseek' };
}
