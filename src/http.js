/**
 * HTTP 小工具。
 *
 * 注意：Node 的 fetch（undici）默认**不读系统代理**，
 * 所以 127.0.0.1 的请求不会被代理劫持——这正是我们要的。
 */

const DEFAULT_TIMEOUT = 120_000;

export async function fetchWithTimeout(url, init = {}, timeoutMs = DEFAULT_TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') throw new Error(`请求超时（${timeoutMs}ms）：${url}`);
    throw new Error(`请求失败：${url} → ${err.message}`);
  } finally {
    clearTimeout(timer);
  }
}

export async function readError(res) {
  let detail = '';
  try {
    detail = (await res.text()).slice(0, 400);
  } catch {
    /* ignore */
  }
  return `HTTP ${res.status}${detail ? `：${detail}` : ''}`;
}

export async function postJson(url, body, headers = {}, timeoutMs = DEFAULT_TIMEOUT) {
  const res = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    },
    timeoutMs,
  );
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function postForm(url, form, headers = {}, timeoutMs = DEFAULT_TIMEOUT) {
  const res = await fetchWithTimeout(
    url,
    { method: 'POST', headers, body: form },
    timeoutMs,
  );
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function getJson(url, headers = {}, timeoutMs = 15_000) {
  const res = await fetchWithTimeout(url, { headers }, timeoutMs);
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}
