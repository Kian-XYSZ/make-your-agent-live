/**
 * 音频文件小工具。
 */

import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

export const MAX_ASR_BYTES = 10 * 1024 * 1024;

export function readAudio(path, { maxBytes = MAX_ASR_BYTES } = {}) {
  const data = readFileSync(path);
  if (data.length === 0) throw new Error(`音频是空文件：${path}`);
  if (data.length > maxBytes) {
    throw new Error(`音频过大：${data.length} 字节（上限 ${maxBytes}）`);
  }
  const lower = path.toLowerCase();
  const format = lower.endsWith('.mp3') ? 'mp3'
    : lower.endsWith('.wav') ? 'wav'
      : lower.endsWith('.ogg') || lower.endsWith('.opus') ? 'ogg'
        : lower.endsWith('.m4a') ? 'm4a'
          : 'wav';
  const mime = {
    mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4',
  }[format];
  return { data, format, mime, name: basename(path), path };
}

/** 拼 data URL（MiMo ASR 要这个形态）。 */
export function toDataUrl({ data, mime }) {
  return `data:${mime};base64,${data.toString('base64')}`;
}
