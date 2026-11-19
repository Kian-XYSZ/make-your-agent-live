/**
 * MiniMax ASR（asr-1.0）。
 *
 * 端点：POST {base}/speech_to_text，multipart/form-data
 * 字段：model=asr-1.0, file=<音频>, language 可选
 * 返回：{ text, duration, trace_id }
 *
 * 有 MiniMax M Plan 的话这个基本是零边际成本，所以放降级链第一位。
 */

import { readAudio } from '../audio.js';
import { postForm } from '../http.js';

export async function transcribe(path, opts, config) {
  const { apiKey, base } = config.asr.minimax;
  if (!apiKey) throw new Error('缺少 MINIMAX_API_KEY');

  const audio = readAudio(path);
  const form = new FormData();
  form.append('model', opts.model ?? 'asr-1.0');
  if (opts.language) form.append('language', opts.language);
  form.append('file', new Blob([audio.data], { type: audio.mime }), audio.name);

  const payload = await postForm(
    `${base}/speech_to_text`,
    form,
    { Authorization: `Bearer ${apiKey}` },
  );
  const text = String(payload?.text ?? '').trim();
  if (!text) throw new Error(`MiniMax ASR 返回空文本：${JSON.stringify(payload).slice(0, 200)}`);
  return { text, provider: 'minimax' };
}
