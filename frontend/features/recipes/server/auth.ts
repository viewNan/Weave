import { RecipeError } from '../domain.ts';
export const SESSION_COOKIE = 'weave_eat_session';
const encoder = new TextEncoder();
const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, '0')).join('');
const key = (secret: string) => crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
export function requireSecret(secret?: string): string {
  if (!secret || secret.length < 32) throw new RecipeError('食谱访问尚未配置，请由管理员配置访问密钥。', 503);
  return secret;
}
export function localDevelopment(request: Request, development: boolean) {
  return development && ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(request.url).hostname);
}
export function requireSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (origin !== new URL(request.url).origin) throw new RecipeError('请求来源无效，请从本站页面操作。', 403);
}
export async function createSession(secret: string, now = Date.now()) {
  const payload = `${Math.floor(now / 1000) + 28800}.${crypto.randomUUID()}`;
  return `${payload}.${hex(await crypto.subtle.sign('HMAC', await key(secret), encoder.encode(payload)))}`;
}
export async function authenticated(request: Request, secret: string, now = Date.now()) {
  const token = request.headers.get('cookie')?.split(';').map(x => x.trim()).find(x => x.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  if (!token || token.length > 200) return false;
  const [expires, nonce, signature, extra] = token.split('.');
  if (extra || !nonce || !/^\d+$/.test(expires) || Number(expires) <= now / 1000 || Number(expires) > now / 1000 + 28801 || !/^[a-f0-9]{64}$/.test(signature || '')) return false;
  return crypto.subtle.verify('HMAC', await key(secret), Uint8Array.from(signature.match(/../g)!, x => parseInt(x, 16)), encoder.encode(`${expires}.${nonce}`));
}
export async function equalSecret(input: unknown, secret: string) {
  if (typeof input !== 'string' || input.length > 1024) return false;
  const k = await key(secret);
  const expected = await crypto.subtle.sign('HMAC', k, encoder.encode(secret));
  return crypto.subtle.verify('HMAC', k, expected, encoder.encode(input));
}
