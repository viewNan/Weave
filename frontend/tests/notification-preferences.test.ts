import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { D1NotificationPreferences } from '../features/push/infrastructure/d1-notification-preferences.ts';
import { defaultNotificationPreferences, notificationActivities } from '../features/push/preferences.ts';
import { NotificationService } from '../features/push/services/notification-service.ts';

test('each activity persists independently and only enabled notifications reach devices', async () => {
  const sql = new DatabaseSync(':memory:');
  try {
    sql.exec(readFileSync(new URL('../migrations/0012_notification_preferences.sql', import.meta.url), 'utf8'));
    const db = { prepare(query: string) { return { bind(...values: string[]) {
      const statement = sql.prepare(query);
      return {
        async run() { statement.run(...values); },
        async first<T>() { return (statement.get(...values) as T) ?? null; },
        async all<T>() { return { results: statement.all(...values) as T[] }; },
      };
    } }; } };
    const preferences = new D1NotificationPreferences(db);
    assert.deepEqual(await preferences.read(), defaultNotificationPreferences);
    let sent = 0;
    const service = new NotificationService({
      upsert: async () => {}, findByEndpoint: async () => null, deleteByEndpoint: async () => {},
      listActive: async () => [{ endpoint: 'https://push.example/device', p256dh: 'key', auth: 'auth' }],
    }, { send: async () => { sent++; return { accepted: true, providerStatus: 201, providerBody: null }; } }, preferences);
    for (const { id } of notificationActivities) {
      await preferences.set(id, false);
      const reread = new D1NotificationPreferences(db);
      assert.equal((await reread.read())[id], false);
      const before = sent;
      assert.equal((await service.send({ title: 'Test', body: 'Disabled', type: id })).skipped, true);
      assert.equal(sent, before);
      for (const other of notificationActivities) if (other.id !== id) assert.equal((await reread.read())[other.id], true);
      await reread.set(id, true);
      assert.equal((await service.send({ title: 'Test', body: 'Enabled', type: id })).accepted, 1);
      assert.equal(sent, before + 1);
    }
  } finally { sql.close(); }
});
