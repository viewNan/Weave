export const notificationActivities = [
  { id: 'morning_brief', label: '每日晨报', description: '控制晨报生成、AI API 调用和通知。' },
  { id: 'daily_recipe', label: '每日食谱', description: '控制每日推荐生成、AI API 调用和通知。' },
] as const;

export type NotificationActivity = typeof notificationActivities[number]['id'];
export type NotificationPreferences = Record<NotificationActivity, boolean>;
export const defaultNotificationPreferences: NotificationPreferences = {
  morning_brief: true, daily_recipe: true,
};
export type FeaturePreferences = { read(): Promise<NotificationPreferences> };
export function isNotificationActivity(value: unknown): value is NotificationActivity {
  return notificationActivities.some(activity => activity.id === value);
}
