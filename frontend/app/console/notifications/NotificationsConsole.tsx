'use client';

import { useEffect, useState } from 'react';
import { Bell, Send } from 'lucide-react';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import ActivityNotificationSettings from '../../../features/push/ui/ActivityNotificationSettings';

type Status = 'Unsupported' | 'Not enabled' | 'Enabled' | 'Denied';
type SendResult = { accepted?: number; rejected?: number; invalidated?: number; skipped?: boolean; error?: string };
const toBytes = (value: string) => Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(value.length / 4) * 4, '=')), char => char.charCodeAt(0));

export default function NotificationsConsole() {
  const [status, setStatus] = useState<Status>('Unsupported');
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [message, setMessage] = useState('');
  const [provider, setProvider] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('/console');
  const [sending, setSending] = useState(false);
  const [sendMessage, setSendMessage] = useState('');

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).then(async registration => {
      const current = await registration.pushManager.getSubscription();
      setSubscription(current);
      setStatus(Notification.permission === 'denied' ? 'Denied' : current ? 'Enabled' : 'Not enabled');
    }).catch(() => setStatus('Unsupported'));
  }, []);

  const enable = async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return setStatus(permission === 'denied' ? 'Denied' : 'Not enabled');
      const { publicKey } = await (await fetch('/api/push/vapid-public-key')).json();
      const registration = await navigator.serviceWorker.ready;
      const current = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(publicKey) });
      const response = await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(current) });
      if (!response.ok) throw new Error((await response.json()).error || '无法保存订阅');
      setSubscription(current);
      setStatus('Enabled');
      setMessage('通知已开启。');
    } catch (error) { setMessage(error instanceof Error ? error.message : '无法开启通知。'); }
  };

  const test = async () => {
    if (!subscription) return;
    const result = await (await fetch('/api/push/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: subscription.endpoint }) })).json();
    setProvider(result.providerStatus ?? null);
    setMessage(result.accepted ? '测试通知已交给 Push provider。' : result.error || result.providerBody || '发送失败。');
  };

  const send = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSending(true);
    setSendMessage('');
    try {
      const path = url.trim() || '/console';
      if (!path.startsWith('/') || path.startsWith('//') || new URL(path, window.location.origin).origin !== window.location.origin) throw new Error('打开页面请填写本站路径，例如 /console。');
      const response = await fetch('/api/internal/recipes/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), url: path }),
      });
      const result = await response.json() as SendResult;
      if (!response.ok) throw new Error(result.error || '发送失败。');
      setSendMessage(result.accepted ? `已交给推送服务：成功 ${result.accepted} 台，失败 ${result.rejected || 0} 台。` : '没有设备收到通知，请检查设备订阅。');
    } catch (error) { setSendMessage(error instanceof Error ? error.message : '发送失败。'); }
    finally { setSending(false); }
  };

  return <div className="mx-auto w-full max-w-4xl space-y-6 p-6 md:p-10">
    <div><h1 className="text-3xl font-semibold tracking-tight">设置</h1><p className="mt-2 text-muted-foreground">管理每日功能、AI API 使用和设备通知。</p></div>
    <ActivityNotificationSettings />
    <Card>
      <CardHeader><CardTitle>自定义推送</CardTitle><CardDescription>输入时下方会实时预览；发送后会推送给所有已订阅的设备。</CardDescription></CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={send}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-medium">标题<Input value={title} onChange={event => setTitle(event.target.value)} placeholder="今天有件有趣的事" maxLength={80} required /></label>
            <label className="space-y-2 text-sm font-medium">点击后打开<Input value={url} onChange={event => setUrl(event.target.value)} placeholder="/console" maxLength={200} /></label>
          </div>
          <label className="block space-y-2 text-sm font-medium">内容<Textarea value={body} onChange={event => setBody(event.target.value)} placeholder="想告诉自己的话写在这里……" maxLength={300} required /></label>
          <div className="space-y-3 rounded-2xl bg-slate-100 p-4 sm:p-6">
            <p className="text-xs font-medium text-slate-500">通知预览 · 实际显示以设备系统为准</p>
            <div className="mx-auto max-w-md rounded-2xl bg-white/95 p-4 shadow-lg ring-1 ring-slate-200" aria-live="polite">
              <div className="mb-3 flex items-center gap-2 text-xs text-slate-500"><span className="grid size-6 place-items-center rounded-md bg-primary text-[11px] font-bold text-primary-foreground">W</span><span className="font-semibold tracking-wide">WEAVE</span><span className="ml-auto">现在</span></div>
              <p className="break-words font-semibold text-slate-900">{title.trim() || '通知标题'}</p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-600">{body.trim() || '你填写的内容会显示在这里。'}</p>
            </div>
          </div>
          <Button type="submit" disabled={sending || !title.trim() || !body.trim()}><Send size={16}/>{sending ? '发送中…' : '发送到所有设备'}</Button>
          {sendMessage && <p className="text-sm" role="status">{sendMessage}</p>}
        </form>
      </CardContent>
    </Card>
    <Card>
      <CardHeader><div className="flex items-center gap-2"><Bell size={20}/><CardTitle>Web Push</CardTitle></div><CardDescription>每天 06:30（日本时间）生成晨报后，自动通知已订阅的设备。</CardDescription></CardHeader>
      <CardContent className="space-y-4"><div className="flex flex-wrap items-center gap-3"><Badge>{status === 'Enabled' ? '已开启' : status === 'Not enabled' ? '未开启' : status}</Badge><Button onClick={enable} disabled={status === 'Unsupported' || status === 'Enabled'}>开启通知</Button><Button variant="outline" onClick={test} disabled={!subscription}><Send size={15}/>发送测试</Button></div><p className="text-sm text-muted-foreground">{status === 'Unsupported' ? '此浏览器不支持 Web Push。iPhone 请从主屏幕打开。' : '浏览器会记住这个设备的订阅。'}</p>{message && <p className="rounded-md bg-muted p-3 text-sm" aria-live="polite">{message}</p>}{provider !== null && <p className="text-xs text-muted-foreground">Provider status: {provider}</p>}</CardContent>
    </Card>
  </div>;
}
