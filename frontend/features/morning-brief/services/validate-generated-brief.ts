import { CATEGORIES, type CategoryId } from '../config/content-policy.ts';
import type { EditorialItem } from '../config/editorial-policy.ts';
import type { GeneratedBrief } from './morning-brief-provider.ts';

const stringList = (value: unknown, max: number) => Array.isArray(value) && value.length <= max && value.every(item => typeof item === 'string' && item.length > 0);
const urlList = (value: unknown) => {
  if (!Array.isArray(value) || value.length > 8) return false;
  return value.every((url): url is string => typeof url === 'string' && /^https?:\/\//.test(url));
};

export function validateGeneratedBrief(value: unknown): GeneratedBrief {
  if (!value || typeof value !== 'object') throw new Error('OpenAI returned an invalid brief.');
  const raw = value as Record<string, unknown>;
  if (typeof raw.title !== 'string' || !raw.title.trim() || raw.title.length > 120) throw new Error('OpenAI returned an invalid title.');
  if (typeof raw.speechText !== 'string' || raw.speechText.trim().length < 80 || raw.speechText.length > 12000) throw new Error('OpenAI returned an invalid speechText.');
  if (!Array.isArray(raw.items) || raw.items.length > 12) throw new Error('OpenAI returned invalid items.');
  const seen = new Set<string>();
  const items = raw.items.map((value): EditorialItem => {
    if (!value || typeof value !== 'object') throw new Error('OpenAI returned an invalid item.');
    const item = value as Record<string, unknown>;
    if (typeof item.category !== 'string' || !(item.category in CATEGORIES)) throw new Error('OpenAI returned an invalid category.');
    if (typeof item.eventKey !== 'string' || !/^[a-z0-9][a-z0-9_-]{2,100}$/i.test(item.eventKey) || seen.has(item.eventKey)) throw new Error('OpenAI returned duplicate or invalid event keys.');
    if (typeof item.headline !== 'string' || !item.headline.trim() || item.headline.length > 180) throw new Error('OpenAI returned an invalid headline.');
    if (typeof item.summary !== 'string' || !item.summary.trim() || item.summary.length > 500) throw new Error('OpenAI returned an invalid summary.');
    if (item.updateType !== 'new' && item.updateType !== 'material_update') throw new Error('OpenAI returned an invalid update type.');
    if (item.updateType === 'material_update' && (typeof item.materialUpdateReason !== 'string' || !item.materialUpdateReason.trim())) throw new Error('OpenAI returned an update without its new fact.');
    if (!urlList(item.sourceUrls)) throw new Error('OpenAI returned invalid sources.');
    seen.add(item.eventKey);
    return { category: item.category as CategoryId, eventKey: item.eventKey, headline: item.headline.trim(), summary: item.summary.trim(), updateType: item.updateType, materialUpdateReason: typeof item.materialUpdateReason === 'string' ? item.materialUpdateReason.trim() : undefined, sourceUrls: item.sourceUrls as string[] };
  });
  const categories = [...new Set(items.map(item => item.category))];
  const sources = [...new Set(items.flatMap(item => item.sourceUrls))];
  return { title: raw.title.trim(), speechText: raw.speechText.trim(), categories, sources, items };
}
