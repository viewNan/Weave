import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createNotificationServiceFromEnv } from '../../push/services/create-notification-service';
import { RecipeService } from './recipe-service';
export function createRecipeServiceFromEnv(env:CloudflareEnv) { if(!env.PUSH_SUBSCRIPTIONS_DB) throw new Error('Recipe database binding is not configured.'); return new RecipeService(env.PUSH_SUBSCRIPTIONS_DB,env.OPENAI_API_KEY,env.VAPID_PUBLIC_KEY&&env.VAPID_PRIVATE_KEY&&env.VAPID_SUBJECT?createNotificationServiceFromEnv(env):undefined); }
export async function createRecipeService() { const {env}=await getCloudflareContext({async:true}); return createRecipeServiceFromEnv(env); }
