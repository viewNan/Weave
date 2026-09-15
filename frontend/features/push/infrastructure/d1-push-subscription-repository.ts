import type { PushSubscriptionRecord, PushSubscriptionRepository } from '../repositories/push-subscription-repository';

type D1 = {
  prepare(query: string): { bind(...values: string[]): { run(): Promise<unknown>; first<T>(): Promise<T | null> } };
};

export class D1PushSubscriptionRepository implements PushSubscriptionRepository {
  constructor(private readonly db: D1) {}

  async upsert(subscription: PushSubscriptionRecord) {
    await this.db.prepare(`
      INSERT INTO push_subscriptions (endpoint, p256dh, auth)
      VALUES (?, ?, ?)
      ON CONFLICT(endpoint) DO UPDATE SET
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        updated_at = CURRENT_TIMESTAMP
    `).bind(subscription.endpoint, subscription.p256dh, subscription.auth).run();
  }

  async findByEndpoint(endpoint: string) {
    return this.db.prepare(
      'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE endpoint = ?',
    ).bind(endpoint).first<PushSubscriptionRecord>();
  }
}
