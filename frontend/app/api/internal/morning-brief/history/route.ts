import { createMorningBriefService } from '../../../../../features/morning-brief/services/create-morning-brief-service';
export const dynamic='force-dynamic'; export async function GET(request:Request){const n=Math.min(100,Math.max(1,Number(new URL(request.url).searchParams.get('limit')||30)));return Response.json({briefs:await (await createMorningBriefService()).history(n)});}
