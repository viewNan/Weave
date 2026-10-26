import { createMorningBriefServiceFromEnv } from './features/morning-brief/services/create-morning-brief-service.ts';
import { createRecipeServiceFromEnv } from './features/recipes/services/create-recipe-service.ts';
import { D1NotificationPreferences } from './features/push/infrastructure/d1-notification-preferences.ts';
import { handleCdnCgiImageRequest, handleImageRequest } from './.open-next/cloudflare/images.js';
import { runWithCloudflareRequestContext } from './.open-next/cloudflare/init.js';
import { maybeGetSkewProtectionResponse } from './.open-next/cloudflare/skew-protection.js';
import { handler as middlewareHandler } from './.open-next/middleware/handler.mjs';

export { DOQueueHandler } from './.open-next/.build/durable-objects/queue.js';
export { DOShardedTagCache } from './.open-next/.build/durable-objects/sharded-tag-cache.js';
export { BucketCachePurge } from './.open-next/.build/durable-objects/bucket-cache-purge.js';

export default {
  async fetch(request, env, ctx) {
    return runWithCloudflareRequestContext(request, env, ctx, async () => {
      const response = maybeGetSkewProtectionResponse(request);
      if (response) return response;

      const url = new URL(request.url);
      if (url.pathname.startsWith('/cdn-cgi/image/')) return handleCdnCgiImageRequest(url, env);
      if (url.pathname === `${globalThis.__NEXT_BASE_PATH__}/_next/image${globalThis.__TRAILING_SLASH__ ? '/' : ''}`) {
        return handleImageRequest(url, request.headers, env);
      }

      const reqOrResp = await middlewareHandler(request, env, ctx);
      if (reqOrResp instanceof Response) return reqOrResp;
      const { handler } = await import('./.open-next/server-functions/default/handler.mjs');
      return handler(reqOrResp, env, ctx, request.signal);
    });
  },
  scheduled(controller, env, ctx) {
    ctx.waitUntil((async () => {
      const preferences = await new D1NotificationPreferences(env.PUSH_SUBSCRIPTIONS_DB).read();
      if (controller.cron === '0 9 * * *') {
        if (!preferences.daily_recipe) return;
        const service = createRecipeServiceFromEnv(env);
        await service.getOrCreateDaily();
        await service.pushToday();
      } else {
        if (!preferences.morning_brief) return;
        await createMorningBriefServiceFromEnv(env).generateAndPushToday();
      }
    })().catch(error => console.error('Scheduled daily feature failed.', error)));
  },
};
