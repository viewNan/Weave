import { defaultNotificationPreferences, isNotificationActivity, type NotificationActivity, type NotificationPreferences } from '../preferences.ts';

type Database = NonNullable<CloudflareEnv['PUSH_SUBSCRIPTIONS_DB']>;

export class D1NotificationPreferences {
  private readonly db: Database;
  constructor(db: Database) { this.db = db; }

  async read(): Promise<NotificationPreferences> {
    const { results } = await this.db.prepare('SELECT activity, enabled FROM notification_preferences').bind().all<{ activity: string; enabled: number }>();
    const preferences = { ...defaultNotificationPreferences };
    for (const row of results) if (isNotificationActivity(row.activity)) preferences[row.activity] = row.enabled === 1;
    return preferences;
  }

  async set(activity: NotificationActivity, enabled: boolean) {
    await this.db.prepare('INSERT INTO notification_preferences (activity, enabled) VALUES (?, ?) ON CONFLICT(activity) DO UPDATE SET enabled = excluded.enabled')
      .bind(activity, enabled ? '1' : '0').run();
  }
}
