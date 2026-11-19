/**
 * 小米 MiMo ASR（mimo-v2.5-asr）。
 *
 * 端点：POST {base}/chat/completions
 * 形态：messages[0].content = [{ type: 'input_audio', input_audio: { data: dataURL } }]
 * 返回：choices[0].message.content
 *
 * 只收 wav / mp3，≤10 MB。
 */

import { readAudio, toDataUrl } from '../audio.js';
import { postJson } from '../http.js';

export async function transcribe(path, opts, config) {
  const { apiKey, base } = config.asr.mimo;
  if (!apiKey) throw new Error('缺少 XIAOMI_API_KEY');

  const audio = readAudio(path, { maxBytes: 10 * 1024 * 1024 });
  if (!['wav', 'mp3'].includes(audio.format)) {
    throw new Error(`MiMo ASR 只收 wav / mp3，当前是 ${audio.format}`);
  }

  const payload = await postJson(
    `${base}/chat/completions`,
    {
      model: 'mimo-v2.5-asr',
      messages: [{
        role: 'user',
        content: [{ type: 'input_audio', input_audio: { data: toDataUrl(audio) } }],
      }],
      asr_options: { language: opts.language ?? 'zh' },
    },
    { 'api-key': apiKey },
  );

  const content = payload?.choices?.[0]?.message?.content;
  const text = (Array.isArray(content)
    ? content.map((p) => (typeof p === 'string' ? p : p?.text ?? '')).join('')
    : String(content ?? '')).trim();
  if (!text) throw new Error(`MiMo ASR 返回空文本：${JSON.stringify(payload).slice(0, 200)}`);
  return { text, provider: 'mimo' };
}
