import type { CategoryId } from '../config/content-policy.ts';
import type { EditorialItem } from '../config/editorial-policy.ts';
export type GeneratedBrief={title:string;speechText:string;categories:CategoryId[];sources:string[];items:EditorialItem[]};
export interface MorningBriefProvider { generate(input:{date:string;categories:CategoryId[];recentItems:EditorialItem[];instructions?:string;previousBrief?:{title:string;speechText:string}}):Promise<GeneratedBrief>; }
