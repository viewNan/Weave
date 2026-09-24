import { createMorningBriefServiceFromEnv } from './features/morning-brief/services/create-morning-brief-service.ts';
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
  scheduled(_controller, env, ctx) {
    ctx.waitUntil(
      createMorningBriefServiceFromEnv(env).getOrCreateToday('admin').catch((error) => {
        console.error('Scheduled morning brief failed.', error);
      }),
    );
  },
};
