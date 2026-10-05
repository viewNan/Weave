import { RecipeError } from '../../../../../features/recipes/domain';
import { failure, jsonBody, privateHeaders } from '../../../../../features/recipes/server/http';
import { requireSameOrigin } from '../../../../../features/recipes/server/auth';
import { createNotificationService } from '../../../../../features/push/services/create-notification-service';

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const input = await jsonBody(request);
    const { title, body, url } = input;
    if (typeof title !== 'string' || !title.trim() || title.length > 80 || typeof body !== 'string' || !body.trim() || body.length > 300) {
      throw new RecipeError('标题和内容不能为空，且分别不能超过 80 和 300 字。');
    }
    if (typeof url !== 'string' || !url.startsWith('/') || url.length > 200 || new URL(url, request.url).origin !== new URL(request.url).origin) {
      throw new RecipeError('打开页面请填写本站路径，例如 /console。');
    }
    return Response.json(await (await createNotificationService()).send({ title: title.trim(), body: body.trim(), url, type: 'custom' }), { headers: privateHeaders });
  } catch (error) { return failure(error); }
}
