import { recipeRoute, jsonBody } from '../../../../../../features/recipes/server/http';
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, context: Context) { return recipeRoute(request, async service => service.renameCategory((await context.params).id, (await jsonBody(request)).name)); }
export async function DELETE(request: Request, context: Context) { return recipeRoute(request, async service => service.deleteCategory((await context.params).id)); }
