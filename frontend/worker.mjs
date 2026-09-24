import nextWorker from './.open-next/worker.js';
import { createMorningBriefServiceFromEnv } from './features/morning-brief/services/create-morning-brief-service.ts';

export default {
  fetch: nextWorker.fetch,
  scheduled(_controller, env, ctx) {
    ctx.waitUntil(
      createMorningBriefServiceFromEnv(env).getOrCreateToday('admin').catch((error) => {
        console.error('Scheduled morning brief failed.', error);
      }),
    );
  },
};
