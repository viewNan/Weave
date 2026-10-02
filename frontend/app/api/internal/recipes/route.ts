import { recipeRoute, jsonBody } from '../../../../features/recipes/server/http';
export async function GET(request: Request) { return recipeRoute(request, async service => ({ recipes: await service.listRecipes(new URL(request.url).searchParams.get('q') || '') })); }
export async function POST(request: Request) { return recipeRoute(request, async service => service.saveRecipe(await jsonBody(request))); }
