import { recipeRoute, jsonBody } from '../../../../../../features/recipes/server/http';
export async function POST(request: Request) { return recipeRoute(request, async service => { const body = await jsonBody(request); return service.logMeal(body.date, body); }); }
export async function PATCH(request: Request) { return recipeRoute(request, async service => { const body = await jsonBody(request); return service.updateMeal(body.date, body.id, body.revision, body.mode, body); }); }
export async function DELETE(request: Request) { return recipeRoute(request, async service => { const body = await jsonBody(request); return service.clearMeal(body.date, body.id, body.revision); }); }
