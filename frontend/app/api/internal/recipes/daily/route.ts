import { recipeRoute, jsonBody } from '../../../../../features/recipes/server/http';
import { todayJst } from '../../../../../features/morning-brief/server/jst-date';
export async function GET(request: Request) {
  return recipeRoute(request, async service => {
    const date = todayJst();
    const [daily, meal, recentMeals, recipes, generation] = await Promise.all([
      service.daily(date), service.todayMeal(date), service.recentMeals(30, date), service.listRecipes(), service.generationState(date),
    ]);
    return { date, daily, meal, recentMeals, recipes, generation };
  });
}
export async function POST(request: Request) { return recipeRoute(request, async service => service.getOrCreateDaily((await jsonBody(request)).retry === true)); }
export async function PATCH(request: Request) { return recipeRoute(request, async service => { const body = await jsonBody(request); return service.select(body.selectedIndex, body.date); }); }
