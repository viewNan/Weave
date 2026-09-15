import type { PushSubscriptionRepository } from '../repositories/push-subscription-repository';
import type { PushMessage, PushProviderResult, PushService } from './push-service';

export type NotificationInput = PushMessage;
export type NotificationTarget = { userId?: string; deviceId?: string };
export type NotificationResult = {
  accepted: number;
  rejected: number;
  invalidated: number;
  providerResults: Array<Pick<PushProviderResult, 'providerStatus' | 'providerBody'>>;
};

export class NotificationService {
  private readonly subscriptions: PushSubscriptionRepository;
  private readonly push: Pick<PushService, 'send'>;

  constructor(
    subscriptions: PushSubscriptionRepository,
    push: Pick<PushService, 'send'>,
  ) {
    this.subscriptions = subscriptions;
    this.push = push;
  }

  async send(notification: NotificationInput, target: NotificationTarget = {}): Promise<NotificationResult> {
    if (!notification.title || !notification.body) throw new Error('Notification title and body are required.');
    if (target.userId || target.deviceId) throw new Error('Targeted delivery requires userId/deviceId subscription fields.');

    const result: NotificationResult = { accepted: 0, rejected: 0, invalidated: 0, providerResults: [] };
    for (const subscription of await this.subscriptions.listActive()) {
      try {
        const provider = await this.push.send(subscription, notification);
        result.providerResults.push({ providerStatus: provider.providerStatus, providerBody: provider.providerBody });
        if (provider.providerStatus === 404 || provider.providerStatus === 410) {
          await this.subscriptions.deleteByEndpoint(subscription.endpoint);
          result.invalidated++;
        } else if (provider.accepted) result.accepted++;
        else result.rejected++;
      } catch {
        result.rejected++;
      }
    }
    return result;
  }
}
