import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRecord, derivePushKeys, encryptRecord, PushService } from '../features/push/services/push-service.ts';

const bytes = (value: string) => new Uint8Array(Buffer.from(value, 'base64url'));
const encoded = (value: Uint8Array) => Buffer.from(value).toString('base64url');

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

test('RFC 8291 encryption vector derives IKM, CEK, nonce, delimiter, and record header', async () => {
  const receiver = bytes('BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4');
  const sender = bytes('BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8');
  const { ikm, cek, nonce } = await derivePushKeys(
    bytes('kyrL1jIIOHEzg3sM2ZWRHDRB62YACZhhSlknJ672kSs'),
    bytes('BTBZMqHH6r4Tts7J_aSIgg'), receiver, sender, bytes('DGv6ra1nlYgDCS1FRnbzlw'),
  );
  assert.equal(encoded(ikm), 'S4lYMb_L0FxCeq0WhDx813KgSYqU26kOyzWUdsXYyrg');
  assert.equal(encoded(cek), 'oIhVW04MRdy2XN9CiKLxTg');
  assert.equal(encoded(nonce), '4h_95klXJ5E_qnoN');
  const ciphertext = await encryptRecord(cek, nonce, 'When I grow up, I want to be a watermelon');
  assert.equal(encoded(ciphertext), '8pfeW0KbunFT06SuDKoJH9Ql87S1QUrdirN6GcG7sFz1y1sqLgVi1VhjVkHsUoEsbI_0LpXMuGvnzQ');
  const record = buildRecord(bytes('DGv6ra1nlYgDCS1FRnbzlw'), sender, ciphertext);
  assert.equal(record.length, 86 + ciphertext.length);
  assert.deepEqual([...record.slice(16, 21)], [0, 0, 16, 0, 65]);
});
