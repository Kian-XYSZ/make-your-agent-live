/**
 * ASR 入口：按配置选 provider，失败自动降级。
 *
 * 降级链（provider: auto 时）：
 *   minimax → deepseek → mimo → local
 *
 * 为什么要链：她「听不见」比「听错」严重得多。
 * 一个 key 过期、一个服务抽风，都不该让她突然聋掉。
 */

import { candidates } from '../config.js';
import * as minimax from './minimax.js';
import * as deepseek from './deepseek.js';
import * as mimo from './mimo.js';
import * as local from './local.js';

const PROVIDERS = { minimax, deepseek, mimo, local };

/**
 * @param {string} audioPath
 * @param {object} [options] { language }
 * @param {object} [config]
 * @returns {Promise<{text:string, provider:string}>}
 */
export async function transcribe(audioPath, options = {}, config) {
  const cfg = config ?? (await import('../config.js')).loadConfig();
  const chain = candidates(cfg, 'asr');
  if (chain.length === 0) {
    throw new Error(
      '没有可用的 ASR。至少配一个：MINIMAX_API_KEY（有 M Plan 就含）、'
      + 'DEEPSEEK_API_KEY（0.39 元/小时）、XIAOMI_API_KEY（按量付费，不是免费），'
      + '或者 LOCAL_ASR_ENDPOINT 跑本地模型（本地才是免费的）。',
    );
  }

  const opts = { language: options.language ?? cfg.asr.language ?? 'zh' };
  const failures = [];
  for (const name of chain) {
    try {
      return await PROVIDERS[name].transcribe(audioPath, opts, cfg);
    } catch (err) {
      failures.push(`${name}: ${err.message}`);
    }
  }
  throw new Error(`所有 ASR provider 都失败了：\n  ${failures.join('\n  ')}`);
}
