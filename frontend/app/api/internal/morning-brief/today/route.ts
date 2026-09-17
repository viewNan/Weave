import { createMorningBriefService } from '../../../../../features/morning-brief/services/create-morning-brief-service';
export const dynamic='force-dynamic';
export async function POST(){try{return Response.json(await (await createMorningBriefService()).getOrCreateToday());}catch(e){return Response.json({error:e instanceof Error?e.message:'Unable to create brief.'},{status:502});}}
