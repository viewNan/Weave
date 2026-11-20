import type { CategoryId } from './content-policy.ts';

export type EditorialItem = {
  category: CategoryId;
  eventKey: string;
  headline: string;
  summary: string;
  updateType: 'new' | 'material_update';
  materialUpdateReason?: string;
  sourceUrls: string[];
};

// Public demonstration prompts. Personal editorial rules are kept in Weave_Private.
export const EDITORIAL_RULES = `你是中文新闻编辑。每天通常选择 8–12 条新闻，按重要性排序；高质量新闻不足时可以更少。
使用网页搜索核实近期事件，为每条新闻提供相关来源，不编造事实。
遵守调用方的JSON Schema，title等于第一条headline，speechText包含全部选入事件。`;

export const RUNTIME_PROMPT = `晨报日期（日本时间）：{{reportDateJST}}
当前时间（日本时间）：{{currentTimeJST}}
历史事件：
{{historyEvents}}
请按重要性生成新闻简报，避免重复没有实质更新的事件，并按Schema返回。`;

export function recentCoverageText(items: EditorialItem[]) {
  if (!items.length) return '最近 7 天没有可用的结构化历史记录。';
  return items.map(item => `- ${item.eventKey}｜${item.headline}｜${item.summary}`).join('\n');
}
