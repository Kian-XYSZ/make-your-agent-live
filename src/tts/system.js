/**
 * 系统语音 —— 最后的兜底。
 *
 * 什么 key 都没有的时候，至少还能出声。
 *   Windows：System.Speech（SAPI），中文音色通常是 Microsoft Huihui Desktop
 *   macOS  ：say
 *   Linux  ：espeak-ng（如果能装上）
 *
 * 音色很机械，但「能出声」比「音质好」重要——这是降级链的最后一环。
 */

import { spawn } from 'node:child_process';
import { readFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { windowsHide: true });
    let err = '';
    child.stderr.on('data', (d) => { err += d.toString(); });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} 失败(${code})：${err.slice(0, 200)}`))));
  });
}

async function windowsSynthesize(text, outPath, voice) {
  const ps = `
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
try { $s.SelectVoice('${String(voice || '').replace(/'/g, "''")}') } catch {}
$s.Rate = 0
$s.SetOutputToWaveFile('${outPath.replace(/'/g, "''")}')
$s.Speak('${text.replace(/'/g, "''")}')
$s.Dispose()
`;
  await run('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps]);
}

export async function synthesize(text, opts, config) {
  if (process.platform === 'win32') {
    const out = join(tmpdir(), `myal-sys-${Date.now()}.wav`);
    try {
      await windowsSynthesize(text, out, opts.systemVoice);
      return { data: readFileSync(out), format: 'wav', model: 'system-sapi' };
    } finally {
      try { unlinkSync(out); } catch { /* ignore */ }
    }
  }

  if (process.platform === 'darwin') {
    const out = join(tmpdir(), `myal-sys-${Date.now()}.aiff`);
    try {
      await run('say', ['-o', out, text]);
      return { data: readFileSync(out), format: 'aiff', model: 'system-say' };
    } finally {
      try { unlinkSync(out); } catch { /* ignore */ }
    }
  }

  throw new Error('当前平台没有可用的系统语音（Linux 请装 espeak-ng 或配一个本地 TTS）');
}
