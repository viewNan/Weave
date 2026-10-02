export class RecipeError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

export type Recipe = {
  id: string; title: string; categoryId: string | null; category: string | null;
  tags: string[]; minutes: number | null; difficulty: string | null;
  servings: string | null; markdown: string; createdAt: string; updatedAt: string;
};
export type Candidate = {
  title: string; cuisine: string; minutes: number; difficulty: string;
  reason: string; recipeId?: string; markdown?: string;
};
export type MealLog = {
  id: string; date: string; name: string; recipeId: string | null;
  source: 'recommended' | 'library' | 'freeform'; rating: number | null;
  revision: number; recommendationDate: string | null; candidateIndex: number | null;
};
export type DailyRecommendation = {
  date: string; candidates: Candidate[]; selectedIndex: number; generatedAt: string;
  origin: string; pushStatus: string;
};
export type MealInput = { name?: string; source: MealLog['source']; recipeId?: string | null; candidateIndex?: number };
export type MemoryContext = {
  version: 'recipe-context-v1'; date: string; explicitPreferences: string; seasonalFoods: string[];
  // Facts are rebuilt on every generation, never accumulated as an uncorrectable model summary.
  recentMeals: MealLog[];
  observations: { name: string; count: number; ratedCount: number; meanRating: number | null; lastEaten: string }[];
  library: Pick<Recipe, 'id' | 'title' | 'tags' | 'category' | 'minutes'>[];
};
export function validDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) {
    throw new RecipeError('日期无效。');
  }
  return value;
}
export function text(value: unknown, label: string, max = 120): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new RecipeError(`${label}需为 1–${max} 个字符。`);
  return value.trim();
}
export function buildMemory(date: string, preferences: string, season: string[], meals: MealLog[], recipes: Recipe[]): MemoryContext {
  const groups = new Map<string, MealLog[]>();
  for (const item of meals) groups.set(item.name, [...(groups.get(item.name) || []), item]);
  return {
    version: 'recipe-context-v1', date, explicitPreferences: preferences, seasonalFoods: season,
    recentMeals: meals.slice(0, 14),
    observations: [...groups].map(([name, items]) => {
      const ratings = items.flatMap(item => item.rating === null ? [] : [item.rating]);
      return { name, count: items.length, ratedCount: ratings.length,
        meanRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
        lastEaten: items.map(item => item.date).sort().at(-1)! };
    }),
    library: recipes.slice(0, 50).map(({ id, title, tags, category, minutes }) => ({ id, title, tags, category, minutes })),
  };
}
