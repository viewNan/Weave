import { recipeRoute, jsonBody } from '../../../../../../features/recipes/server/http';
export async function POST(request: Request) { return recipeRoute(request, async service => { const body = await jsonBody(request); return service.rateMeal(body.date, body.id, body.revision, body.rating); }); }
