import { createMorningBriefService } from '../../../../../features/morning-brief/services/create-morning-brief-service';
import { requireSameOrigin } from '../../../../../features/recipes/server/auth';
import { failure, jsonBody, privateHeaders } from '../../../../../features/recipes/server/http';
import { RecipeError } from '../../../../../features/recipes/domain';

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { instructions } = await jsonBody(request);
    if (typeof instructions !== 'string' || instructions.length > 2000) throw new RecipeError('补充提示需为文字，且不能超过2000字。');
    return Response.json(await (await createMorningBriefService()).regenerateToday(instructions), { headers: privateHeaders });
  } catch (error) {
    return failure(error instanceof Error && !(error instanceof RecipeError) ? new RecipeError(error.message, 409) : error);
  }
}
