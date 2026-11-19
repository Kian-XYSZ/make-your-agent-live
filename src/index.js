/**
 * 库入口 —— 别的项目 import 这个就能用。
 *
 *   import { speak, transcribe } from 'make-your-agent-live';
 *   const { data } = await speak('你好');
 *   const { text } = await transcribe('/tmp/x.wav');
 */

export { loadConfig, candidates, isReady } from './config.js';
export { speak } from './tts/index.js';
export { transcribe } from './asr/index.js';
export { OneBot, onebotFromConfig } from './qq/onebot.js';
export { ffmpegAvailable, applyTempo } from './ffmpeg.js';
export { PRESET_VOICES } from './tts/mimo.js';
