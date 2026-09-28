import { createMorningBriefService } from '../../../../../features/morning-brief/services/create-morning-brief-service';

export async function POST() { try { return Response.json(await (await createMorningBriefService()).pushToday()); } catch (error) { return Response.json({ error:error instanceof Error ? error.message : '推送失败。' }, { status:400 }); } }
