/**
 * TTS 入口：按配置选 provider，失败自动降级。
 *
 * 降级链（provider: auto 时）：
 *   mimo → minimax → local → system
 *
 * 任何一步成功就返回；全失败才抛错——**保证不会突然哑掉**。
 */

import { candidates } from '../config.js';
import { applyTempo } from '../ffmpeg.js';
import * as mimo from './mimo.js';
import * as minimax from './minimax.js';
import * as local from './local.js';
import * as system from './system.js';

const PROVIDERS = { mimo, minimax, local, system };

/**
 * @param {string} text
 * @param {object} options
 * @param {string} [options.voiceFile] 克隆样本路径
 * @param {string} [options.design]    音色描述（没有样本时用）
 * @param {string} [options.style]     朗读风格
 * @param {string} [options.presetVoice]
 * @param {number} [options.tempo]     1.0–2.0
 * @param {'wav'|'mp3'} [options.format]
 * @param {object} [config]
 */
export async function speak(text, options = {}, config) {
  const cfg = config ?? (await import('../config.js')).loadConfig();
  const trimmed = String(text ?? '').trim();
  if (!trimmed) throw new Error('要朗读的文字不能为空');

  const chain = candidates(cfg, 'tts');
  if (chain.length === 0) {
    throw new Error(
      '没有可用的 TTS。至少配一个：XIAOMI_API_KEY（MiMo，TTS 限时免费）、'
      + 'MINIMAX_API_KEY + MINIMAX_GROUP_ID、LOCAL_TTS_ENDPOINT，'
      + '或者用系统语音（Windows/macOS 开箱即用）。',
    );
  }

  const opts = {
    voiceFile: options.voiceFile ?? cfg.tts.voiceFile,
    design: options.design ?? cfg.tts.design,
    style: options.style ?? '',
    presetVoice: options.presetVoice ?? cfg.tts.presetVoice,
    format: options.format === 'mp3' ? 'mp3' : 'wav',
    voiceId: options.voiceId,
    minimaxModel: options.minimaxModel,
    speed: options.speed,
    systemVoice: options.systemVoice,
  };
  const tempo = Number(options.tempo ?? cfg.tts.tempo ?? 1);

  const failures = [];
  for (const name of chain) {
    try {
      const out = await PROVIDERS[name].synthesize(trimmed, opts, cfg);
      let data = out.data;
      let format = out.format ?? opts.format;

      if (Math.abs(tempo - 1) >= 0.01) {
        const faster = await applyTempo(data, format, tempo);
        if (faster) {
          data = faster.data;
          format = faster.format;
        } else {
          failures.push(`${name}: tempo 跳过（没装 ffmpeg）`);
        }
      }

      return { data, format, provider: name, model: out.model ?? name, tempo };
    } catch (err) {
      failures.push(`${name}: ${err.message}`);
    }
  }

  throw new Error(`所有 TTS provider 都失败了：\n  ${failures.join('\n  ')}`);
}
