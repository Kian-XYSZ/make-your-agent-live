/**
 * 本地 ASR：把音频 POST 给自建服务。
 *
 * 约定接口：
 *   POST <endpoint>   multipart/form-data，字段名 file
 *   → 200，JSON { "text": "..." }（也认 transcript / result）
 *
 * whisper.cpp、faster-whisper、SenseVoice、FunASR 都能一层薄封装接上。
 */

import { readAudio } from '../audio.js';
import { fetchWithTimeout, readError } from '../http.js';

export async function transcribe(path, opts, config) {
  const { endpoint } = config.asr.local;
  if (!endpoint) throw new Error('缺少 LOCAL_ASR_ENDPOINT');

  const audio = readAudio(path);
  const form = new FormData();
  form.append('file', new Blob([audio.data], { type: audio.mime }), audio.name);
  if (opts.language) form.append('language', opts.language);

  const res = await fetchWithTimeout(endpoint, { method: 'POST', body: form }, 180_000);
  if (!res.ok) throw new Error(await readError(res));

  const payload = await res.json();
  const text = String(payload.text ?? payload.transcript ?? payload.result ?? '').trim();
  if (!text) throw new Error(`本地 ASR 返回空文本：${JSON.stringify(payload).slice(0, 200)}`);
  return { text, provider: 'local' };
}
