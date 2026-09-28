import { createRecipeService } from '../../../../../../features/recipes/services/create-recipe-service';
export async function POST(){try{return Response.json(await (await createRecipeService()).pushToday());}catch(error){return Response.json({error:error instanceof Error?error.message:'推送失败。'},{status:400});}}
