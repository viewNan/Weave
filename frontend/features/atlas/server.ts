import { getCloudflareContext } from '@opennextjs/cloudflare';
import { requireSameOrigin } from '../recipes/server/auth';
import { privateHeaders } from '../recipes/server/http';
import { RecipeError } from '../recipes/domain';

type Database = NonNullable<CloudflareEnv['PUSH_SUBSCRIPTIONS_DB']>;

export async function atlasRoute(request: Request, action: (db: Database) => Promise<unknown>) {
  try {
    if (request.method !== 'GET') requireSameOrigin(request);
    const { env } = await getCloudflareContext({ async: true });
    if (!env.PUSH_SUBSCRIPTIONS_DB) return Response.json({ error: 'Atlas 数据库未配置。' }, { status: 503, headers: privateHeaders });
    return Response.json(await action(env.PUSH_SUBSCRIPTIONS_DB), { headers: privateHeaders });
  } catch (error) {
    const expected = error instanceof SyntaxError || error instanceof RecipeError;
    return Response.json({ error: expected ? error.message : 'Atlas 暂不可用。' },
      { status: error instanceof SyntaxError ? 400 : error instanceof RecipeError ? error.status : 500, headers: privateHeaders });
  }
}

export async function mapBody(request: Request, limit = 10000): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new SyntaxError('需要 JSON 请求。');
  const raw = await request.text();
  if (raw.length > limit) throw new SyntaxError('请求过大。');
  try {
    const body: unknown = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch { throw new SyntaxError('请求格式无效。'); }
}
