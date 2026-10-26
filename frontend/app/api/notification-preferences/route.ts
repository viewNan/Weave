import { getCloudflareContext } from '@opennextjs/cloudflare';
import { D1NotificationPreferences } from '../../../features/push/infrastructure/d1-notification-preferences';
import { isNotificationActivity } from '../../../features/push/preferences';
import { failure, jsonBody, privateHeaders } from '../../../features/recipes/server/http';
import { requireSameOrigin } from '../../../features/recipes/server/auth';
import { RecipeError } from '../../../features/recipes/domain';

async function repository() {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.PUSH_SUBSCRIPTIONS_DB) throw new RecipeError('通知数据库尚未配置。', 503);
  return new D1NotificationPreferences(env.PUSH_SUBSCRIPTIONS_DB);
}

export async function GET() {
  try { return Response.json(await (await repository()).read(), { headers: privateHeaders }); }
  catch (error) { return failure(error); }
}

export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request);
    const { activity, enabled } = await jsonBody(request);
    if (!isNotificationActivity(activity) || typeof enabled !== 'boolean') throw new RecipeError('功能或开关值无效。');
    const repo = await repository();
    await repo.set(activity, enabled);
    return Response.json(await repo.read(), { headers: privateHeaders });
  } catch (error) { return failure(error); }
}
