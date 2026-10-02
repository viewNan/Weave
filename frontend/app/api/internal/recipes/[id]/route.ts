import { recipeRoute, jsonBody } from '../../../../../features/recipes/server/http';
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, context: Context) { return recipeRoute(request, async service => service.saveRecipe({ ...await jsonBody(request), id: (await context.params).id })); }
export async function DELETE(request: Request, context: Context) { return recipeRoute(request, async service => service.deleteRecipe((await context.params).id)); }
