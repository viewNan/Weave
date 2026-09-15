'use client';

import { useEffect, useState } from 'react';

type Status = 'Unsupported' | 'Not enabled' | 'Enabled' | 'Denied';
const base64UrlToBytes = (value: string) => Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(value.length / 4) * 4, '=')), (char) => char.charCodeAt(0));

export default function PushSettings() {
  const [status, setStatus] = useState<Status>('Unsupported');
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).then(async (registration) => {
      const current = await registration.pushManager.getSubscription();
      setSubscription(current);
      setStatus(Notification.permission === 'denied' ? 'Denied' : current ? 'Enabled' : 'Not enabled');
    }).catch(() => setStatus('Unsupported'));
  }, []);

  const enable = async () => {
    try {
      if (Notification.permission === 'denied') return setStatus('Denied');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return setStatus(permission === 'denied' ? 'Denied' : 'Not enabled');
      const { publicKey } = await (await fetch('/api/push/vapid-public-key')).json();
      if (!publicKey) throw new Error('Push is not configured.');
      const registration = await navigator.serviceWorker.ready;
      const current = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(publicKey) });
      const response = await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(current) });
      if (!response.ok) throw new Error((await response.json()).error || 'Unable to save the subscription.');
      setSubscription(current);
      setStatus('Enabled');
      setMessage('通知已开启。');
    } catch (error) { setMessage(error instanceof Error ? error.message : '无法开启通知。'); }
  };

  const test = async () => {
    if (!subscription) return;
    const response = await fetch('/api/push/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: subscription.endpoint }) });
    const result = await response.json();
    setMessage(response.ok ? '测试通知已发送。' : result.error || '发送失败。');
  };

  return <main style={{ maxWidth: 560, margin: '4rem auto', padding: '0 1.5rem', fontFamily: 'system-ui, sans-serif' }}>
    <a href="/">← 返回 Weave</a><h1>通知设置</h1><p>通知状态：<strong>{status}</strong></p>
    {status === 'Unsupported' && <p>此浏览器不支持 Web Push。iPhone 需要 iOS 16.4+，并从主屏幕打开 Weave。</p>}
    <p><button onClick={enable} disabled={status === 'Unsupported' || status === 'Enabled'}>开启通知</button>{' '}<button onClick={test} disabled={!subscription}>发送测试通知</button></p>
    {message && <p aria-live="polite">{message}</p>}
  </main>;
}
