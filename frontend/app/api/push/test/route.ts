import { createPushService } from '../../../../features/push/services/create-push-service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { endpoint } = await request.json();
    if (typeof endpoint !== 'string') throw new Error('A PushSubscription endpoint is required.');
    await (await createPushService()).sendTest(endpoint);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Unable to send notification.' }, { status: 400 });
  }
}
