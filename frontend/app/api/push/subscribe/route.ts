import { createPushService } from '../../../../features/push/services/create-push-service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const subscription = await request.json();
    await (await createPushService()).subscribe({
      endpoint: subscription.endpoint,
      p256dh: subscription.keys?.p256dh,
      auth: subscription.keys?.auth,
    });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Unable to save subscription.' }, { status: 400 });
  }
}
