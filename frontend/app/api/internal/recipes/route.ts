import { createRecipeService } from '../../../../features/recipes/services/create-recipe-service';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{return Response.json({recipes:await (await createRecipeService()).listRecipes(new URL(request.url).searchParams.get('q')||'')});}catch(error){return Response.json({error:error instanceof Error?error.message:'加载失败。'},{status:502});}}
export async function POST(request:Request){try{const input=await request.json();if(typeof input.title!=='string')throw new Error('title 必填。');return Response.json(await (await createRecipeService()).saveRecipe(input));}catch(error){return Response.json({error:error instanceof Error?error.message:'保存失败。'},{status:400});}}
