import type { CategoryId } from '../config/content-policy';
export type GeneratedBrief={title:string;speechText:string;categories:CategoryId[];sources:string[]};
export interface MorningBriefProvider { generate(date:string,categories:CategoryId[]):Promise<GeneratedBrief>; }
