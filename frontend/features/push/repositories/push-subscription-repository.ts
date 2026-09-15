export type PushSubscriptionRecord = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export interface PushSubscriptionRepository {
  upsert(subscription: PushSubscriptionRecord): Promise<void>;
  findByEndpoint(endpoint: string): Promise<PushSubscriptionRecord | null>;
  listActive(): Promise<PushSubscriptionRecord[]>;
  deleteByEndpoint(endpoint: string): Promise<void>;
}
