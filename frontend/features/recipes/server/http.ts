import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createRecipeServiceFromEnv } from '../services/create-recipe-service';
import type { RecipeService } from '../services/recipe-service';
import { RecipeError } from '../domain';
import { authenticated, localDevelopment, requireSameOrigin, requireSecret } from './auth';

export const privateHeaders = { 'Cache-Control': 'private, no-store' };
export function failure(error: unknown) {
  return Response.json({ error: error instanceof RecipeError ? error.message : '数据服务暂不可用，请稍后重试。' },
    { status: error instanceof RecipeError ? error.status : 500, headers: privateHeaders });
}
export async function jsonBody(request: Request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new RecipeError('需要 JSON 请求。', 415);
  if (Number(request.headers.get('content-length')) > 100000) throw new RecipeError('请求过大。', 413);
  const value = await request.text();
  if (value.length > 100000) throw new RecipeError('请求过大。', 413);
  try {
    const body = JSON.parse(value);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw new RecipeError('请求格式无效。'); }
}
export async function recipeRoute(request: Request, action: (service: RecipeService) => Promise<unknown>) {
  try {
    if (request.method !== 'GET') requireSameOrigin(request);
    const { env } = await getCloudflareContext({ async: true });
    if (!localDevelopment(request, process.env.NODE_ENV === 'development')) {
      if (!await authenticated(request, requireSecret(env.EAT_ADMIN_TOKEN))) throw new RecipeError('请先解锁食谱。', 401);
    }
    const result = await action(createRecipeServiceFromEnv(env));
    return Response.json(result ?? { ok: true }, { headers: privateHeaders });
  } catch (error) { return failure(error); }
}
