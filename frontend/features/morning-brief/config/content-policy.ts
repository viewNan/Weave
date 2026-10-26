export const CATEGORIES = {
  ai_tech: 'AI / 科技', japan_life: '日本 / 生活', international: '国际', business_market: '商业 / 市场',
  developer: '开发者', science_space: '科学 / 太空', games_culture: '游戏 / 文化', weekly_review: '本周回顾', next_week_watch: '下周关注',
} as const;
export type CategoryId = keyof typeof CATEGORIES;
export const DAILY_CATEGORIES: CategoryId[] = ['international','ai_tech','business_market','science_space','japan_life'];
