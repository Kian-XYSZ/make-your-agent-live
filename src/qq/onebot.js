/**
 * OneBot 11 HTTP 客户端 —— 只做「发」和「查」，不做「收」。
 *
 * 收消息交给宿主（DSH 的 qq-gateway 插件，或你自己的监听）。
 * 这里只解决一件事：**没有宿主内置工具时，怎么把消息发出去。**
 *
 * 支持任何 OneBot 11 实现：SnowLuma / NapCat / Lagrange / go-cqhttp。
 */

import { readFileSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { fetchWithTimeout, readError } from '../http.js';

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']);

export class OneBot {
  /**
   * @param {{httpUrl:string, accessToken?:string, timeoutMs?:number}} options
   */
  constructor(options) {
    if (!options?.httpUrl) throw new Error('缺少 OneBot HTTP 地址（ONEBOT_HTTP_URL）');
    this.base = options.httpUrl.replace(/\/+$/, '');
    this.token = options.accessToken || '';
    this.timeoutMs = options.timeoutMs ?? 20_000;
  }

  async call(action, params = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    const res = await fetchWithTimeout(
      `${this.base}/${action}`,
      { method: 'POST', headers, body: JSON.stringify(params) },
      this.timeoutMs,
    );
    if (!res.ok) throw new Error(await readError(res));
    const payload = await res.json();
    if (payload.retcode !== 0 && payload.status !== 'ok') {
      throw new Error(`OneBot ${action} 失败：${JSON.stringify(payload).slice(0, 300)}`);
    }
    return payload.data;
  }

  status() {
    return this.call('get_status');
  }

  loginInfo() {
    return this.call('get_login_info');
  }

  /** 发纯文字。target: {userId} 或 {groupId} */
  sendText(target, text) {
    return this.#send(target, [{ type: 'text', data: { text } }]);
  }

  /** 发语音（record）。默认用 base64，避免跨机器路径问题。 */
  sendRecord(target, filePath, { asPath = false } = {}) {
    const data = readFileSync(filePath);
    const file = asPath
      ? filePath
      : `base64://${data.toString('base64')}`;
    return this.#send(target, [{ type: 'record', data: { file } }]);
  }

  /** 发图片。 */
  sendImage(target, filePath, { asPath = false } = {}) {
    if (!IMAGE_EXT.has(extname(filePath).toLowerCase())) {
      throw new Error(`不是图片扩展名：${basename(filePath)}`);
    }
    const data = readFileSync(filePath);
    const file = asPath ? filePath : `base64://${data.toString('base64')}`;
    return this.#send(target, [{ type: 'image', data: { file } }]);
  }

  #send(target, segments) {
    const isGroup = target.groupId !== undefined && target.groupId !== null;
    const action = isGroup ? 'send_group_msg' : 'send_private_msg';
    const params = { message: segments };
    if (isGroup) params.group_id = String(target.groupId);
    else params.user_id = String(target.userId);
    return this.call(action, params);
  }
}

export function onebotFromConfig(config) {
  return new OneBot({
    httpUrl: config.qq.httpUrl,
    accessToken: config.qq.accessToken,
  });
}
