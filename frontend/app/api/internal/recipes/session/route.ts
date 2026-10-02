import { getCloudflareContext } from '@opennextjs/cloudflare';
import { authenticated, createSession, equalSecret, localDevelopment, requireSameOrigin, requireSecret, SESSION_COOKIE } from '../../../../../features/recipes/server/auth';
import { failure, jsonBody, privateHeaders } from '../../../../../features/recipes/server/http';
import { RecipeError } from '../../../../../features/recipes/domain';
export async function GET(request: Request) {
  try {
    if (localDevelopment(request, process.env.NODE_ENV === 'development')) return Response.json({ ok: true, development: true }, { headers: privateHeaders });
    const { env } = await getCloudflareContext({ async: true });
    if (!await authenticated(request, requireSecret(env.EAT_ADMIN_TOKEN))) throw new RecipeError('请解锁食谱。', 401);
    return Response.json({ ok: true }, { headers: privateHeaders });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { env } = await getCloudflareContext({ async: true });
    const secret = requireSecret(env.EAT_ADMIN_TOKEN);
    if (!env.PUSH_SUBSCRIPTIONS_DB) throw new RecipeError('数据服务未配置。', 503);
    // Global bounded login window for this single-owner application; no IPs stored.
    const slot = String(Math.floor(Date.now() / 60000));
    const attempt = await env.PUSH_SUBSCRIPTIONS_DB.prepare(`INSERT INTO recipe_login_attempts (slot,attempts) VALUES (?,1)
      ON CONFLICT(slot) DO UPDATE SET attempts=attempts+1 WHERE attempts<20`).bind(slot).run() as { meta?: { changes?: number } };
    if (!attempt.meta?.changes) throw new RecipeError('尝试过于频繁，请一分钟后再试。', 429);
    await env.PUSH_SUBSCRIPTIONS_DB.prepare('DELETE FROM recipe_login_attempts WHERE slot<?').bind(String(Number(slot) - 5)).run();
    const body = await jsonBody(request);
    if (!await equalSecret(body.token, secret)) throw new RecipeError('访问密钥不正确。', 401);
    const session = await createSession(secret);
    return Response.json({ ok: true }, { headers: { ...privateHeaders,
      'Set-Cookie': `${SESSION_COOKIE}=${session}; Path=/api/internal/recipes; HttpOnly; SameSite=Strict; Max-Age=28800${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}` } });
  } catch (error) { return failure(error); }
}
export async function DELETE(request: Request) {
  try {
    requireSameOrigin(request);
    return Response.json({ ok: true }, { headers: { ...privateHeaders, 'Set-Cookie': `${SESSION_COOKIE}=; Path=/api/internal/recipes; HttpOnly; SameSite=Strict; Max-Age=0` } });
  } catch (error) { return failure(error); }
}
