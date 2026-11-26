'use client';
import { useLanguage } from '../../../shared/i18n/LanguageProvider';

import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { notificationActivities, type NotificationActivity, type NotificationPreferences } from '../preferences';

export default function ActivityNotificationSettings() {
  const { t } = useLanguage();

  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const load = async () => {
    try {
      setMessage('');
      const response = await fetch('/api/notification-preferences', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t("无法加载功能设置。"));
      setPreferences(data);
    } catch (error) { setMessage(error instanceof Error ? error.message : t("无法加载功能设置。")); }
  };
  useEffect(() => { void load(); }, []);
  const toggle = async (activity: NotificationActivity) => {
    if (!preferences || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/notification-preferences', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity, enabled: !preferences[activity] }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t("保存失败。"));
      setPreferences(data);
      setMessage(t("功能设置已保存。"));
    } catch (error) { setMessage(error instanceof Error ? error.message : t("保存失败。")); }
    finally { setBusy(false); }
  };
  return <Card>
    <CardHeader><CardTitle>{t("每日功能")}</CardTitle><CardDescription>{t("停止功能后暂停自动生成、手动生成及通知，不再发起新的 AI API 请求。已有内容仍可查看，重新开启后恢复正常运行。已发出的请求无法通过此开关撤回。")}</CardDescription></CardHeader>
    <CardContent><ul className="divide-y">{notificationActivities.map(activity => <li key={activity.id} className="flex items-center justify-between gap-4 py-4">
      <div><p className="font-medium">{t(activity.label)}</p><p className="mt-1 text-sm text-muted-foreground">{t(activity.description)}</p><p className="mt-1 text-xs text-muted-foreground">{preferences ? preferences[activity.id] ? t("功能运行中") : t("功能已停止 · AI API 已暂停") : t("等待加载设置")}</p></div>
      <Button variant={preferences?.[activity.id] ? 'outline' : 'default'} disabled={!preferences || busy} aria-label={t("{0}{1}功能", preferences?.[activity.id] ? t("停止") : t("开启"), t(activity.label))} onClick={() => void toggle(activity.id)}>{preferences?.[activity.id] ? t("停止功能") : t("开启功能")}</Button>
    </li>)}</ul>{!preferences && <Button variant="outline" onClick={() => void load()}>{t("重新加载")}</Button>}{message && <p className="mt-3 text-sm" role="status">{t(message)}</p>}</CardContent>
  </Card>;
}
