import assert from 'node:assert/strict';
import test from 'node:test';
import { PushService } from '../features/push/services/push-service.ts';

test('push subscriptions are validated before persistence', async () => {
  let saved = false;
  const service = new PushService({
    upsert: async () => { saved = true; },
    findByEndpoint: async () => null,
  }, { publicKey: '', privateKey: '', subject: '' });

  await assert.rejects(service.subscribe({ endpoint: '', p256dh: '', auth: '' }), /Invalid PushSubscription/);
  await service.subscribe({ endpoint: 'https://push.example/subscription', p256dh: 'key', auth: 'auth' });
  assert.equal(saved, true);
});
