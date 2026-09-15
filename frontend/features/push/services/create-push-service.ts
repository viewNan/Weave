import { getCloudflareContext } from '@opennextjs/cloudflare';
import { D1PushSubscriptionRepository } from '../infrastructure/d1-push-subscription-repository';
import { PushService } from './push-service';

export async function createPushService() {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.PUSH_SUBSCRIPTIONS_DB || !env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
    throw new Error('Push bindings are not configured.');
  }
  return new PushService(new D1PushSubscriptionRepository(env.PUSH_SUBSCRIPTIONS_DB), {
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
    subject: env.VAPID_SUBJECT,
  });
}
