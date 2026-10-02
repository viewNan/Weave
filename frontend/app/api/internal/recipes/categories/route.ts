import { recipeRoute, jsonBody } from '../../../../../features/recipes/server/http';
export async function GET(request: Request) { return recipeRoute(request, async service => ({ categories: await service.categories() })); }
export async function POST(request: Request) { return recipeRoute(request, async service => service.createCategory((await jsonBody(request)).name)); }
