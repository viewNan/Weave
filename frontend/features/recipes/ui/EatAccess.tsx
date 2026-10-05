'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { recipeRequest } from './client';
export default function EatAccess({ children, label = '食谱' }: { children: ReactNode; label?: string }) {
  const [allowed, setAllowed] = useState(false), [checking, setChecking] = useState(true);
  const [development, setDevelopment] = useState(false);
  const [token, setToken] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => {
    const lock = () => { setAllowed(false); setError('访问已过期，请重新解锁。'); };
    window.addEventListener('eat-locked', lock);
    recipeRequest<{ development?: boolean }>('/session').then(data => { setDevelopment(data.development === true); setAllowed(true); }).catch(e => setError(e.message)).finally(() => setChecking(false));
    return () => window.removeEventListener('eat-locked', lock);
  }, []);
  if (checking) return <p className="p-8 text-sm text-muted-foreground">正在打开{label}…</p>;
  if (allowed) return <>{!development && <div className="flex justify-end px-6 pt-3"><Button size="sm" variant="ghost" onClick={async () => {
    try { await recipeRequest('/session', 'DELETE'); setAllowed(false); } catch (e) { setError((e as Error).message); }
  }}>锁定{label}</Button></div>}{error && <p role="alert" className="px-6 text-sm text-destructive">{error}</p>}{children}</>;
  return <Card className="mx-auto mt-12 max-w-md"><CardHeader><CardTitle>解锁{label}</CardTitle></CardHeader><CardContent>
    <form className="space-y-4" onSubmit={async event => {
      event.preventDefault(); if (busy) return; setBusy(true); setError('');
      try { await recipeRequest('/session', 'POST', { token }); setToken(''); setAllowed(true); }
      catch (e) { setError((e as Error).message); } finally { setBusy(false); }
    }}>
      <label className="block text-sm" htmlFor="eat-token">访问密钥</label>
      <Input id="eat-token" type="password" autoComplete="current-password" value={token} onChange={e => setToken(e.target.value)} required />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button disabled={busy || !token}>{busy ? '正在验证…' : '解锁'}</Button>
    </form>
  </CardContent></Card>;
}
