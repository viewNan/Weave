import type { PushSubscriptionRecord, PushSubscriptionRepository } from '../repositories/push-subscription-repository';

type VapidConfig = { publicKey: string; privateKey: string; subject: string };
type Bytes = Uint8Array<ArrayBuffer>;
export type PushMessage = { title: string; body: string; url?: string; type?: string; metadata?: Record<string, unknown> };
export type PushProviderResult = { accepted: boolean; providerStatus: number; providerBody: string | null };

const encoder = new TextEncoder();
const base64Url = (value: ArrayBuffer | Uint8Array) => {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
};
const fromBase64Url = (value: string): Bytes => Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(value.length / 4) * 4, '=')), (char) => char.charCodeAt(0));
const concat = (...values: Bytes[]): Bytes => {
  const output = new Uint8Array(values.reduce((size, value) => size + value.length, 0));
  let offset = 0;
  for (const value of values) { output.set(value, offset); offset += value.length; }
  return output;
};
const hmac = async (key: Bytes, value: Bytes): Promise<Bytes> => new Uint8Array(await crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), value));
const hkdfExpand = async (prk: Bytes, info: Bytes, length: number): Promise<Bytes> => (await hmac(prk, concat(info, new Uint8Array([1])))).slice(0, length);
const recordSize = 4096;

export async function derivePushKeys(sharedSecret: Bytes, auth: Bytes, receiver: Bytes, sender: Bytes, salt: Bytes) {
  const keyInfo = concat(encoder.encode('WebPush: info\0'), receiver, sender);
  const ikm = await hkdfExpand(await hmac(auth, sharedSecret), keyInfo, 32);
  const contentPrk = await hmac(salt, ikm);
  return {
    ikm,
    cek: await hkdfExpand(contentPrk, encoder.encode('Content-Encoding: aes128gcm\0'), 16),
    nonce: await hkdfExpand(contentPrk, encoder.encode('Content-Encoding: nonce\0'), 12),
  };
}

export async function encryptRecord(cek: Bytes, nonce: Bytes, payload: string) {
  const plaintext = concat(encoder.encode(payload), new Uint8Array([2]));
  if (plaintext.length + 16 >= recordSize) throw new Error('Push payload exceeds the RFC 8291 single-record limit.');
  return new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']), plaintext));
}

export const buildRecord = (salt: Bytes, senderPublic: Bytes, ciphertext: Bytes) => concat(salt, new Uint8Array([0, 0, 16, 0]), new Uint8Array([senderPublic.length]), senderPublic, ciphertext);

async function encrypt(subscription: PushSubscriptionRecord, payload: string) {
  const receiver = fromBase64Url(subscription.p256dh);
  const auth = fromBase64Url(subscription.auth);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const sender = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const receiverKey = await crypto.subtle.importKey('raw', receiver, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: receiverKey }, sender.privateKey, 256));
  const senderPublic = new Uint8Array(await crypto.subtle.exportKey('raw', sender.publicKey));
  const { cek, nonce } = await derivePushKeys(sharedSecret, auth, receiver, senderPublic, salt);
  return buildRecord(salt, senderPublic, await encryptRecord(cek, nonce, payload));
}

async function vapidAuthorization(endpoint: string, config: VapidConfig) {
  const publicKey = fromBase64Url(config.publicKey);
  const privateKey = fromBase64Url(config.privateKey);
  if (publicKey.length !== 65 || privateKey.length !== 32) throw new Error('VAPID keys are invalid.');
  const header = base64Url(encoder.encode(JSON.stringify({ alg: 'ES256', typ: 'JWT' })));
  const claims = base64Url(encoder.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, sub: config.subject })));
  const key = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', d: base64Url(privateKey), x: base64Url(publicKey.slice(1, 33)), y: base64Url(publicKey.slice(33)) }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, encoder.encode(`${header}.${claims}`));
  return `vapid t=${header}.${claims}.${base64Url(signature)}, k=${config.publicKey}`;
}

export class PushService {
  private readonly subscriptions: PushSubscriptionRepository;
  private readonly vapid: VapidConfig;

  constructor(
    subscriptions: PushSubscriptionRepository,
    vapid: VapidConfig,
  ) {
    this.subscriptions = subscriptions;
    this.vapid = vapid;
  }

  async subscribe(subscription: PushSubscriptionRecord) {
    if (!subscription.endpoint || !subscription.p256dh || !subscription.auth) throw new Error('Invalid PushSubscription.');
    await this.subscriptions.upsert(subscription);
  }

  async send(subscription: PushSubscriptionRecord, message: PushMessage): Promise<PushProviderResult> {
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        Authorization: await vapidAuthorization(subscription.endpoint, this.vapid),
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: '60',
        Urgency: 'high',
      },
      body: await encrypt(subscription, JSON.stringify(message)),
    });
    const providerBody = (await response.text()).slice(0, 1_000) || null;
    return { accepted: response.status >= 200 && response.status < 300, providerStatus: response.status, providerBody };
  }

  async sendTest(endpoint: string) {
    const subscription = await this.subscriptions.findByEndpoint(endpoint);
    if (!subscription) throw new Error('No saved PushSubscription for this device.');
    const result = await this.send(subscription, { title: 'Weave', body: '测试通知已送达。', url: '/push', type: 'test' });
    if (result.providerStatus === 404 || result.providerStatus === 410) await this.subscriptions.deleteByEndpoint(endpoint);
    return result;
  }
}
