import { getCloudflareContext } from '@opennextjs/cloudflare';
import { identifier, PracticeError } from '../../../../features/practice/domain';
import { PracticeService, type PracticeDatabase } from '../../../../features/practice/service';
import { requireSameOrigin } from '../../../../features/recipes/server/auth';
import { RecipeError } from '../../../../features/recipes/domain';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
async function service() {
  const { env } = await getCloudflareContext({ async: true });
  const db = env.PUSH_SUBSCRIPTIONS_DB as unknown as PracticeDatabase | undefined;
  if (!db) throw new PracticeError('数据服务暂不可用，请稍后重试。', 503);
  return new PracticeService(db);
}
function failure(error: unknown) {
  if (error instanceof PracticeError || error instanceof RecipeError) return Response.json({ error: error.message }, { status: error.status, headers });
  // D1 schema and resource details stay on the server.
  console.error('Practice request failed.', error instanceof Error ? error.name : 'UnknownError');
  return Response.json({ error: '数据服务暂不可用，请确认练习清单迁移已应用。' }, { status: 503, headers });
}
export async function GET(request: Request) {
  try {
    const url = new URL(request.url), current = await service(), itemId = url.searchParams.get('itemId');
    const exportScope = url.searchParams.get('export');
    if (exportScope !== null) {
      if (exportScope !== 'current' && exportScope !== 'all') throw new PracticeError('导出范围无效。');
      return Response.json(await current.exportSnapshot(exportScope === 'current' ? identifier(url.searchParams.get('setId')) : undefined), { headers });
    }
    return Response.json(itemId ? { attempts: await current.history(itemId) } : await current.dashboard(url.searchParams.get('setId') || undefined), { headers });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    if (!request.headers.get('content-type')?.startsWith('application/json')) throw new PracticeError('需要 JSON 请求。', 415);
    if (Number(request.headers.get('content-length')) > 1_200_000) throw new PracticeError('请求过大。', 413);
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 1_200_000) throw new PracticeError('请求过大。', 413);
    let body: Record<string, unknown>;
    try { body = JSON.parse(raw); } catch { throw new PracticeError('请求格式无效。'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new PracticeError('请求格式无效。');
    return Response.json(await (await service()).execute(body), { headers });
  } catch (error) { return failure(error); }
}
