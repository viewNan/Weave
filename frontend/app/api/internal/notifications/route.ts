import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createNotificationService } from '../../../../features/push/services/create-notification-service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.INTERNAL_API_TOKEN || request.headers.get('authorization') !== `Bearer ${env.INTERNAL_API_TOKEN}`) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  try {
    const input = await request.json();
    if (typeof input.title !== 'string' || typeof input.body !== 'string') throw new Error('title and body are required strings.');
    if (input.url !== undefined && (typeof input.url !== 'string' || !input.url.startsWith('/'))) throw new Error('url must be an internal path.');
    if (input.type !== undefined && typeof input.type !== 'string') throw new Error('type must be a string.');
    if (input.metadata !== undefined && (typeof input.metadata !== 'object' || input.metadata === null || Array.isArray(input.metadata))) throw new Error('metadata must be an object.');
    return Response.json(await (await createNotificationService()).send(input));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Unable to send notification.' }, { status: 400 });
  }
}
