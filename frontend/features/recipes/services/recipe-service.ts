import seasonalFoods from '../config/seasonal-foods.json' with { type: 'json' };
import { RECIPE_PREFERENCES } from '../config/recipe-preferences.ts';
import { todayJst } from '../../morning-brief/server/jst-date.ts';
import { buildMemory, RecipeError, text, validDate, type Recipe, type MealLog, type MealInput, type DailyRecommendation, type Candidate } from '../domain.ts';
import { generateCandidates } from './generate-candidates.ts';
import type { FeaturePreferences } from '../../push/preferences.ts';
export type { Recipe, MealLog, DailyRecommendation, Candidate } from '../domain.ts';

type Result<T = unknown> = { results: T[]; meta?: { changes?: number } };
type Bound = { first<T>(): Promise<T | null>; all<T>(): Promise<Result<T>>; run(): Promise<unknown> };
export type RecipeDatabase = { prepare(query: string): { bind(...values: any[]): Bound } };
type Notifier = { send(input: { title: string; body: string; url: string; type: string }): Promise<{ accepted: number; rejected: number; skipped?: boolean }> };
const changed = (result: unknown) => ((result as Result).meta?.changes ?? 0) > 0;
const recipe = (row: any): Recipe => ({ id: row.id, title: row.title, categoryId: row.category_id, category: row.category_name ?? null,
  tags: JSON.parse(row.tags_json), minutes: row.minutes, difficulty: row.difficulty, servings: row.servings,
  markdown: row.markdown, createdAt: row.created_at, updatedAt: row.updated_at });
const meal = (row: any): MealLog => ({ id: row.id, date: row.meal_date, recipeId: row.recipe_id, name: row.meal_name,
  source: row.source, rating: row.rating ?? null, revision: row.revision,
  recommendationDate: row.recommendation_date ?? null, candidateIndex: row.candidate_index ?? null });

export class RecipeService {
  private db: RecipeDatabase;
  private openaiKey?: string;
  private notifier?: Notifier;
  private preferences?: FeaturePreferences;
  constructor(db: RecipeDatabase, openaiKey?: string, notifier?: Notifier, preferences?: FeaturePreferences) { this.db = db; this.openaiKey = openaiKey; this.notifier = notifier; this.preferences = preferences; }
  private async requireEnabled() {
    if (this.preferences && !(await this.preferences.read()).daily_recipe) throw new RecipeError('每日食谱功能已停止，AI API 调用已暂停。请在设置中开启功能。', 409);
  }
  async listRecipes(search = '') {
    const result = await this.db.prepare('SELECT r.*, c.name category_name FROM recipes r LEFT JOIN recipe_categories c ON c.id=r.category_id WHERE r.title LIKE ? OR r.tags_json LIKE ? ORDER BY r.updated_at DESC').bind(`%${search.slice(0, 120)}%`, `%${search.slice(0, 120)}%`).all<any>();
    return result.results.map(recipe);
  }
  async categories() { return (await this.db.prepare('SELECT id,name FROM recipe_categories ORDER BY name').bind().all<{id: string; name: string}>()).results; }
  async createCategory(name: string) {
    name = text(name, '分类名称', 50);
    await this.db.prepare('INSERT OR IGNORE INTO recipe_categories (id,name) VALUES (?,?)').bind(crypto.randomUUID(), name).run();
    return this.db.prepare('SELECT id,name FROM recipe_categories WHERE name=?').bind(name).first();
  }
  async renameCategory(id: string, name: string) {
    name = text(name, '分类名称', 50);
    await this.db.prepare('UPDATE recipe_categories SET name=? WHERE id=?').bind(name, id).run();
    return this.db.prepare('SELECT id,name FROM recipe_categories WHERE id=?').bind(id).first();
  }
  async deleteCategory(id: string) { await this.db.prepare('DELETE FROM recipe_categories WHERE id=?').bind(id).run(); }
  async saveRecipe(input: Partial<Recipe> & { title: string }) {
    const title = text(input.title, '食谱标题');
    if (!Array.isArray(input.tags) || input.tags.length > 20) throw new RecipeError('标签最多20个。');
    const tags = input.tags.map(tag => text(tag, '标签', 40));
    if (input.minutes != null && (!Number.isInteger(input.minutes) || input.minutes < 1 || input.minutes > 480)) throw new RecipeError('用时需为1–480分钟。');
    if (typeof input.markdown !== 'string' || input.markdown.length > 30000) throw new RecipeError('食谱正文不能超过30000字。');
    if (input.categoryId != null && typeof input.categoryId !== 'string') throw new RecipeError('分类无效。');
    const now = new Date().toISOString();
    const values = [title, input.categoryId || null, JSON.stringify(tags), input.minutes ?? null,
      input.difficulty ? text(input.difficulty, '难度', 20) : null, input.servings ? text(input.servings, '份量', 40) : null, input.markdown, now];
    const id = input.id || crypto.randomUUID();
    if (input.id) {
      const result = await this.db.prepare('UPDATE recipes SET title=?,category_id=?,tags_json=?,minutes=?,difficulty=?,servings=?,markdown=?,updated_at=? WHERE id=?').bind(...values, id).run();
      if (!changed(result)) throw new RecipeError('食谱不存在，请刷新。', 404);
    } else {
      await this.db.prepare('INSERT INTO recipes (id,title,category_id,tags_json,minutes,difficulty,servings,markdown,updated_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(id, ...values, now).run();
    }
    return this.getRecipe(id);
  }
  async getRecipe(id: string) {
    const found = await this.db.prepare('SELECT r.*,c.name category_name FROM recipes r LEFT JOIN recipe_categories c ON c.id=r.category_id WHERE r.id=?').bind(id).first<any>();
    return found ? recipe(found) : null;
  }
  async deleteRecipe(id: string) { await this.db.prepare('DELETE FROM recipes WHERE id=?').bind(id).run(); }
  async daily(date = todayJst()): Promise<DailyRecommendation | null> {
    validDate(date);
    const row = await this.db.prepare('SELECT * FROM daily_recipe_recommendations WHERE recommendation_date=?').bind(date).first<any>();
    if (!row) return null;
    let candidates: Candidate[];
    try { candidates = JSON.parse(row.candidates_json); } catch { throw new RecipeError('已保存的推荐数据无法读取。', 500); }
    if (!Array.isArray(candidates) || candidates.length !== 3 || !Number.isInteger(row.selected_index) || row.selected_index < 0 || row.selected_index > 2) throw new RecipeError('已保存的推荐数据不完整。', 500);
    return { date, candidates, selectedIndex: row.selected_index, generatedAt: row.generated_at, origin: row.origin, pushStatus: row.push_status };
  }
  async todayMeal(date = todayJst()) {
    validDate(date);
    const row = await this.db.prepare('SELECT * FROM meal_logs WHERE meal_date=? AND archived_at IS NULL').bind(date).first<any>();
    return row ? meal(row) : null;
  }
  async recentMeals(limit = 30, date = todayJst()) {
    const result = await this.db.prepare('SELECT * FROM meal_logs WHERE archived_at IS NULL AND meal_date<=? AND meal_date>=date(?, ?) ORDER BY meal_date DESC LIMIT ?').bind(date, date, '-89 days', limit).all<any>();
    return result.results.map(meal);
  }
  async memory(date = todayJst()) {
    validDate(date);
    const [history, recipes] = await Promise.all([this.recentMeals(90, date), this.listRecipes()]);
    const seasonal = (seasonalFoods as Record<string, string[]>)[String(Number(date.slice(5, 7)))] || [];
    return buildMemory(date, RECIPE_PREFERENCES, seasonal, history, recipes);
  }
  async generationState(date = todayJst()) {
    return this.db.prepare('SELECT status,attempts,started_at,error_code FROM recipe_generation_runs WHERE recommendation_date=?').bind(date).first<{status: string; attempts: number; started_at: string; error_code: string | null}>();
  }
  async getOrCreateDaily(retry = false) {
    const date = todayJst();
    const existing = await this.daily(date);
    if (existing) return existing;
    await this.requireEnabled();
    if (!this.openaiKey) throw new RecipeError('尚未配置推荐服务，饮食记录仍可正常使用。', 503);
    const now = new Date().toISOString();
    const owner = crypto.randomUUID();
    // Stalled requests are not silently replayed; only an explicit retry can reacquire them.
    const result = await this.db.prepare(`INSERT INTO recipe_generation_runs (recommendation_date,owner_id,status,attempts,started_at)
      VALUES (?,?,'running',1,?) ON CONFLICT(recommendation_date) DO UPDATE SET
      owner_id=excluded.owner_id,status='running',attempts=attempts+1,started_at=excluded.started_at,finished_at=NULL,error_code=NULL
      WHERE ?=1 AND attempts<3 AND ((status='failed' AND started_at<?) OR (status='running' AND started_at<?))`)
      .bind(date, owner, now, retry ? 1 : 0, new Date(Date.now() - 60000).toISOString(), new Date(Date.now() - 300000).toISOString()).run();
    if (!changed(result)) throw new RecipeError('推荐正在生成或本次尝试已结束。失败后请稍候手动重试，每天最多3次；长时间无响应请等待5分钟。', 409);
    try {
      const saved = await this.daily(date);
      if (saved) return saved;
      const context = await this.memory(date);
      await this.requireEnabled();
      const generated = await generateCandidates(this.openaiKey, context);
      const inserted = await this.db.prepare(`INSERT INTO daily_recipe_recommendations
        (recommendation_date,candidates_json,generated_at,origin,context_json,model_response_id)
        SELECT ?,?,?,'ai',?,? WHERE EXISTS (SELECT 1 FROM recipe_generation_runs WHERE recommendation_date=? AND owner_id=? AND status='running')
        ON CONFLICT(recommendation_date) DO NOTHING`)
        .bind(date, JSON.stringify(generated.candidates), new Date().toISOString(), JSON.stringify(context), generated.responseId, date, owner).run();
      if (!changed(inserted) && !(await this.daily(date))) throw new RecipeError('生成任务已被更新，请刷新查看。', 409);
      await this.db.prepare("UPDATE recipe_generation_runs SET status='completed',finished_at=? WHERE recommendation_date=? AND owner_id=?").bind(new Date().toISOString(), date, owner).run();
      return (await this.daily(date))!;
    } catch (error) {
      await this.db.prepare("UPDATE recipe_generation_runs SET status='failed',finished_at=?,error_code='generation_failed' WHERE recommendation_date=? AND owner_id=?").bind(new Date().toISOString(), date, owner).run();
      if (error instanceof RecipeError) throw error;
      throw new RecipeError('推荐生成未成功，未保存结果。请稍候手动重试。', 502);
    }
  }
  async select(index: number, date: string) {
    validDate(date);
    if (!Number.isInteger(index) || index < 0 || index > 2) throw new RecipeError('候选选择无效。');
    const result = await this.db.prepare('UPDATE daily_recipe_recommendations SET selected_index=? WHERE recommendation_date=?').bind(index, date).run();
    if (!changed(result)) throw new RecipeError('当天尚无推荐。', 404);
    return this.daily(date);
  }
  private async resolveMeal(input: MealInput, date: string) {
    if (input.source === 'recommended') {
      const daily = await this.daily(date);
      if (!daily || !Number.isInteger(input.candidateIndex) || input.candidateIndex! < 0 || input.candidateIndex! > 2) throw new RecipeError('推荐来源无效。');
      const item = daily.candidates[input.candidateIndex!];
      return { name: text(item.title, '菜名'), recipeId: item.recipeId || null, source: input.source, recommendationDate: date, candidateIndex: input.candidateIndex! };
    }
    if (input.source === 'library') {
      const item = typeof input.recipeId === 'string' ? await this.getRecipe(input.recipeId) : null;
      if (!item) throw new RecipeError('所选食谱不存在。', 404);
      return { name: item.title, recipeId: item.id, source: input.source, recommendationDate: null, candidateIndex: null };
    }
    if (input.source !== 'freeform') throw new RecipeError('饮食来源无效。');
    return { name: text(input.name, '实际吃的内容'), recipeId: null, source: input.source, recommendationDate: null, candidateIndex: null };
  }
  async logMeal(date: string, input: MealInput) {
    validDate(date);
    if (date > todayJst()) throw new RecipeError('不能记录未来的实际饮食。');
    const value = await this.resolveMeal(input, date);
    const id = crypto.randomUUID(); const now = new Date().toISOString();
    const result = await this.db.prepare(`INSERT INTO meal_logs (id,meal_date,recipe_id,meal_name,source,recommendation_date,candidate_index,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(meal_date) WHERE archived_at IS NULL DO NOTHING`)
      .bind(id, date, value.recipeId, value.name, value.source, value.recommendationDate, value.candidateIndex, now, now).run();
    if (!changed(result)) throw new RecipeError('当天已有用餐记录，请刷新后编辑或替换。', 409);
    return this.todayMeal(date);
  }
  private target(id: string, revision: number, date: string) {
    validDate(date); text(id, '记录编号', 80);
    if (!Number.isInteger(revision) || revision < 1) throw new RecipeError('记录版本无效，请刷新。');
    return [id, revision, date];
  }
  private assertUpdated(result: unknown) { if (!changed(result)) throw new RecipeError('记录已被修改或清除，请刷新后再操作。', 409); }
  async updateMeal(date: string, id: string, revision: number, mode: 'edit' | 'replace', input: MealInput) {
    const target = this.target(id, revision, date);
    if (mode === 'edit') {
      this.assertUpdated(await this.db.prepare('UPDATE meal_logs SET meal_name=?,revision=revision+1,updated_at=? WHERE id=? AND revision=? AND meal_date=? AND archived_at IS NULL')
        .bind(text(input.name, '实际吃的内容'), new Date().toISOString(), ...target).run());
    } else if (mode === 'replace') {
      const value = await this.resolveMeal(input, date);
      this.assertUpdated(await this.db.prepare(`UPDATE meal_logs SET meal_name=?,recipe_id=?,source=?,recommendation_date=?,candidate_index=?,rating=NULL,feedback=NULL,
        revision=revision+1,updated_at=? WHERE id=? AND revision=? AND meal_date=? AND archived_at IS NULL`)
        .bind(value.name, value.recipeId, value.source, value.recommendationDate, value.candidateIndex, new Date().toISOString(), ...target).run());
    } else throw new RecipeError('操作模式无效。');
    return this.todayMeal(date);
  }
  async clearMeal(date: string, id: string, revision: number) {
    const target = this.target(id, revision, date);
    this.assertUpdated(await this.db.prepare('UPDATE meal_logs SET archived_at=?,revision=revision+1 WHERE id=? AND revision=? AND meal_date=? AND archived_at IS NULL')
      .bind(new Date().toISOString(), ...target).run());
  }
  async rateMeal(date: string, id: string, revision: number, rating: number | null) {
    const target = this.target(id, revision, date);
    if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) throw new RecipeError('评分需为1–5或清除评分。');
    this.assertUpdated(await this.db.prepare('UPDATE meal_logs SET rating=?,feedback=NULL,revision=revision+1,updated_at=? WHERE id=? AND revision=? AND meal_date=? AND archived_at IS NULL')
      .bind(rating, new Date().toISOString(), ...target).run());
    return this.todayMeal(date);
  }
  async pushToday() {
    await this.requireEnabled();
    const daily = await this.getOrCreateDaily();
    if (!this.notifier) throw new RecipeError('通知服务未配置。', 503);
    const claim = await this.db.prepare("UPDATE daily_recipe_recommendations SET push_status='sending' WHERE recommendation_date=? AND push_status='pending'").bind(daily.date).run();
    if (!changed(claim)) return this.daily(daily.date);
    try {
      const item = daily.candidates[0];
      const result = await this.notifier.send({ title: 'Weave · 今天吃什么', body: `${item.title} · ${item.reason} · 约 ${item.minutes} 分钟。`, url: '/console/eat/daily', type: 'daily_recipe' });
      if (result.skipped) {
        await this.db.prepare("UPDATE daily_recipe_recommendations SET push_status='pending' WHERE recommendation_date=?").bind(daily.date).run();
        return this.daily(daily.date);
      }
      const status = result.accepted === 0 ? 'failed' : result.rejected ? 'partial' : 'sent';
      await this.db.prepare('UPDATE daily_recipe_recommendations SET push_status=?,push_sent_at=? WHERE recommendation_date=?').bind(status, new Date().toISOString(), daily.date).run();
    } catch {
      await this.db.prepare("UPDATE daily_recipe_recommendations SET push_status='unknown' WHERE recommendation_date=?").bind(daily.date).run();
      throw new RecipeError('推送结果不确定，未自动重复发送。', 502);
    }
    return this.daily(daily.date);
  }
}
