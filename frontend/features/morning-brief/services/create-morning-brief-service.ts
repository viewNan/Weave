import { D1NotificationPreferences } from '../../push/infrastructure/d1-notification-preferences';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { D1MorningBriefRepository } from '../infrastructure/d1-morning-brief-repository';
import { OpenAIMorningBriefProvider } from '../infrastructure/openai-morning-brief-provider';
import { createNotificationServiceFromEnv } from '../../push/services/create-notification-service';
import { MorningBriefService } from './morning-brief-service';

export function createMorningBriefServiceFromEnv(env: CloudflareEnv) {
  if (!env.PUSH_SUBSCRIPTIONS_DB) throw new Error('Morning Brief database is not configured.');
  return new MorningBriefService(new D1MorningBriefRepository(env.PUSH_SUBSCRIPTIONS_DB), {
    async generate(input) {
      if (!env.OPENAI_API_KEY) throw new Error('尚未配置晨报生成服务。');
      return new OpenAIMorningBriefProvider(env.OPENAI_API_KEY).generate(input);
    },
  }, {
    async send(input) { return createNotificationServiceFromEnv(env).send(input); },
  }, new D1NotificationPreferences(env.PUSH_SUBSCRIPTIONS_DB));
}
export async function createMorningBriefService(){const {env}=await getCloudflareContext({async:true});return createMorningBriefServiceFromEnv(env);}
