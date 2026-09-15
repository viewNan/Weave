import { getCloudflareContext } from '@opennextjs/cloudflare';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.VAPID_PUBLIC_KEY) return Response.json({ error: 'Push is not configured.' }, { status: 503 });
  return Response.json({ publicKey: env.VAPID_PUBLIC_KEY });
}
