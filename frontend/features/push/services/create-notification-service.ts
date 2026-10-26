import { getCloudflareContext } from '@opennextjs/cloudflare';
import { D1PushSubscriptionRepository } from '../infrastructure/d1-push-subscription-repository';
import { NotificationService } from './notification-service';
import { PushService } from './push-service';
import { D1NotificationPreferences } from '../infrastructure/d1-notification-preferences';

export function createNotificationServiceFromEnv(env: CloudflareEnv) {
  if (!env.PUSH_SUBSCRIPTIONS_DB || !env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
    throw new Error('Push bindings are not configured.');
  }
  const subscriptions = new D1PushSubscriptionRepository(env.PUSH_SUBSCRIPTIONS_DB);
  const push = new PushService(subscriptions, {
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
    subject: env.VAPID_SUBJECT,
  });
  return new NotificationService(subscriptions, push, new D1NotificationPreferences(env.PUSH_SUBSCRIPTIONS_DB));
}

export async function createNotificationService() {
  const { env } = await getCloudflareContext({ async: true });
  return createNotificationServiceFromEnv(env);
}
