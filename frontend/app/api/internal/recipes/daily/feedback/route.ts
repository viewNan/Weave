import { createRecipeService } from '../../../../../../features/recipes/services/create-recipe-service';
export async function POST(request:Request){try{const {rating}=await request.json();return Response.json(await (await createRecipeService()).rateTodayMeal(rating));}catch(error){return Response.json({error:error instanceof Error?error.message:'评分失败。'},{status:400});}}
