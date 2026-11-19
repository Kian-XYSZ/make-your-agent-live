/**
 * ffmpeg 辅助：只用来做「纯音频变速」和「转格式」。
 *
 * 没装 ffmpeg 也不影响主流程——调用方会得到 null，然后用原音频。
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let cached = null;

export async function ffmpegAvailable() {
  if (cached !== null) return cached;
  cached = await new Promise((resolve) => {
    const child = spawn('ffmpeg', ['-version'], { windowsHide: true });
    child.on('error', () => resolve(false));
    child.on('close', (code) => resolve(code === 0));
  });
  return cached;
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { windowsHide: true });
    let err = '';
    child.stderr.on('data', (d) => { err += d.toString(); });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg 失败(${code})：${err.slice(-300)}`))));
  });
}

/**
 * 变速不变调。
 * @param {Buffer} data 输入音频
 * @param {'wav'|'mp3'|string} ext 输入扩展名
 * @param {number} tempo 1.0–2.0；1.5 以上开始有机械感
 * @returns {Promise<{data:Buffer, format:string}|null>} 没有 ffmpeg 时返回 null
 */
export async function applyTempo(data, ext, tempo) {
  if (Math.abs(tempo - 1) < 0.01) return { data, format: ext };
  if (!(await ffmpegAvailable())) return null;

  const dir = mkdtempSync(join(tmpdir(), 'myal-tempo-'));
  const input = join(dir, `in.${ext === 'mp3' ? 'mp3' : 'wav'}`);
  const output = join(dir, `out.${ext === 'mp3' ? 'mp3' : 'wav'}`);
  try {
    writeFileSync(input, data);
    await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', input, '-filter:a', `atempo=${tempo}`, output]);
    return { data: readFileSync(output), format: ext === 'mp3' ? 'mp3' : 'wav' };
  } catch {
    return null;
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}
