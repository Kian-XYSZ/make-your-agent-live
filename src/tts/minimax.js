/**
 * MiniMax TTS（T2A v2）。
 *
 * 需要 GroupId：控制台 → 账户信息。没有 GroupId 就用不了这个 provider。
 * 返回的 data.audio 是十六进制字符串（也可能是 base64，两种都兼容）。
 */

import { postJson } from '../http.js';

export async function synthesize(text, opts, config) {
  const { apiKey, groupId, base } = config.tts.minimax;
  if (!apiKey) throw new Error('缺少 MINIMAX_API_KEY');
  if (!groupId) throw new Error('缺少 MINIMAX_GROUP_ID（T2A 必填，控制台 → 账户信息）');

  const format = opts.format === 'mp3' ? 'mp3' : 'wav';
  const payload = await postJson(
    `${base}/t2a_v2?GroupId=${encodeURIComponent(groupId)}`,
    {
      model: opts.minimaxModel ?? 'speech-02-hd',
      text,
      stream: false,
      voice_setting: {
        voice_id: opts.voiceId ?? 'female-shaonv',
        speed: opts.speed ?? 1.0,
        vol: 1.0,
        pitch: 0,
      },
      audio_setting: { sample_rate: 32000, bitrate: 128000, format },
    },
    { Authorization: `Bearer ${apiKey}` },
  );

  const hex = payload?.data?.audio;
  if (typeof hex !== 'string' || !hex) {
    throw new Error(`MiniMax 响应里没有音频：${JSON.stringify(payload).slice(0, 200)}`);
  }
  // 纯十六进制 → Buffer；否则按 base64 试
  const data = /^[0-9a-fA-F]+$/.test(hex) && hex.length % 2 === 0
    ? Buffer.from(hex, 'hex')
    : Buffer.from(hex, 'base64');
  return { data, format, model: 'minimax-t2a' };
}
