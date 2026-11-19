/**
 * 本地 TTS：把文字 POST 给任何自建服务，拿音频回来。
 *
 * 约定的接口（最简单的形态）：
 *   POST <endpoint>
 *   { "text": "...", "voice": "可选" }
 *   → 200，Content-Type: audio/*，响应体就是音频字节
 *   → 或者 200，JSON { "audio": "<base64>", "format": "wav" }
 *
 * GPT-SoVITS、Qwen3-TTS、CosyVoice、ChatTTS 之类都能用一层薄封装接上。
 */

import { fetchWithTimeout, readError } from '../http.js';

export async function synthesize(text, opts, config) {
  const { endpoint } = config.tts.local;
  if (!endpoint) throw new Error('缺少 LOCAL_TTS_ENDPOINT');

  const res = await fetchWithTimeout(
    endpoint,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice: opts.voiceId ?? undefined }),
    },
    180_000,
  );
  if (!res.ok) throw new Error(await readError(res));

  const type = res.headers.get('content-type') ?? '';
  if (type.includes('application/json')) {
    const payload = await res.json();
    const b64 = payload.audio ?? payload.data;
    if (typeof b64 !== 'string' || !b64) {
      throw new Error(`本地 TTS 返回的 JSON 里没有 audio 字段`);
    }
    return { data: Buffer.from(b64, 'base64'), format: payload.format ?? 'wav', model: 'local' };
  }

  const data = Buffer.from(await res.arrayBuffer());
  if (data.length === 0) throw new Error('本地 TTS 返回了空音频');
  return { data, format: type.includes('mpeg') ? 'mp3' : 'wav', model: 'local' };
}
