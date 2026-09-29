import { getCloudflareContext } from '@opennextjs/cloudflare';
import { StudyService } from '../study-service';
export async function createStudyService(){const {env}=await getCloudflareContext({async:true});if(!env.PUSH_SUBSCRIPTIONS_DB)throw new Error('Study database binding is not configured.');return new StudyService(env.PUSH_SUBSCRIPTIONS_DB);}
