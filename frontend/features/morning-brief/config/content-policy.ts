export const CATEGORIES = {
  ai_tech: 'AI / 科技', japan_life: '日本 / 生活', international: '国际', business_market: '商业 / 市场',
  developer: '开发者', science_space: '科学 / 太空', games_culture: '游戏 / 文化', weekly_review: '本周回顾', next_week_watch: '下周关注',
} as const;
export type CategoryId = keyof typeof CATEGORIES;
export const DAILY_CATEGORIES: CategoryId[] = ['ai_tech','japan_life','international','developer'];
export const LIMITS: Record<CategoryId, number> = { ai_tech:2,japan_life:2,international:2,business_market:1,developer:1,science_space:1,games_culture:1,weekly_review:1,next_week_watch:1 };
