import { recipeRoute } from '../../../../../../features/recipes/server/http';
export async function POST(request: Request) { return recipeRoute(request, service => service.pushToday()); }
