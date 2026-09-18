import type { EditorialItem } from '../config/editorial-policy';
import { DEFAULT_WEEKDAYS, type CategoryId } from '../config/content-policy';
import type { Brief, MorningBriefRepository, Settings } from '../repositories/morning-brief-repository';

type D1Result<T = unknown> = { results: T[]; meta?: { changes?: number } };
type BoundStatement = { first<T>(): Promise<T | null>; all<T>(): Promise<D1Result<T>>; run(): Promise<unknown> };
type Statement = { bind(...values: unknown[]): BoundStatement };
type D1 = { prepare(query: string): Statement };
type BriefRow = { brief_date:string;title:string;speech_text:string;categories_json:string;sources_json:string;items_json:string|null;generated_at:string;updated_at:string;manually_edited_at:string|null;shortcut_last_accessed_at:string|null;push_status:string;push_accepted:number;push_rejected:number;push_invalidated:number;push_sent_at:string|null };
const parse = <T>(value:string|null, fallback:T):T => { try { return value ? JSON.parse(value) as T : fallback; } catch { return fallback; } };
const row = (value:BriefRow):Brief => ({ date:value.brief_date,title:value.title,speechText:value.speech_text,categories:parse<CategoryId[]>(value.categories_json,[]),sources:parse<string[]>(value.sources_json,[]),items:parse<EditorialItem[]>(value.items_json,[]),generatedAt:value.generated_at,updatedAt:value.updated_at,manuallyEditedAt:value.manually_edited_at,shortcutLastAccessedAt:value.shortcut_last_accessed_at,pushStatus:value.push_status,pushAccepted:value.push_accepted,pushRejected:value.push_rejected,pushInvalidated:value.push_invalidated,pushSentAt:value.push_sent_at });

export class D1MorningBriefRepository implements MorningBriefRepository {
  constructor(private db:D1) {}
  async getSettings(){const value=await this.db.prepare('SELECT * FROM morning_brief_settings WHERE id=1').bind().first<{timezone:string;weekday_categories_json:string}>();return {timezone:value?.timezone||'Asia/Tokyo',weekdays:parse(value?.weekday_categories_json??null,DEFAULT_WEEKDAYS)} as Settings;}
  async updateSettings(weekdays:Record<string,CategoryId[]>) {await this.db.prepare('UPDATE morning_brief_settings SET weekday_categories_json=?,updated_at=? WHERE id=1').bind(JSON.stringify(weekdays),new Date().toISOString()).run();}
  async find(date:string){const value=await this.db.prepare('SELECT * FROM morning_briefs WHERE brief_date=?').bind(date).first<BriefRow>();return value?row(value):null;}
  async insert(brief:Brief){await this.db.prepare('INSERT INTO morning_briefs (brief_date,title,speech_text,categories_json,sources_json,items_json,generated_at,updated_at,manually_edited_at,shortcut_last_accessed_at,push_status,push_accepted,push_rejected,push_invalidated,push_sent_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(brief.date,brief.title,brief.speechText,JSON.stringify(brief.categories),JSON.stringify(brief.sources),JSON.stringify(brief.items),brief.generatedAt,brief.updatedAt,brief.manuallyEditedAt,brief.shortcutLastAccessedAt,brief.pushStatus,brief.pushAccepted,brief.pushRejected,brief.pushInvalidated,brief.pushSentAt).run();}
  async updateSpeechText(date:string,text:string,at:string){await this.db.prepare('UPDATE morning_briefs SET speech_text=?,updated_at=?,manually_edited_at=? WHERE brief_date=?').bind(text,at,at,date).run();return this.find(date);}
  async markShortcutAccessed(date:string,at:string){await this.db.prepare('UPDATE morning_briefs SET shortcut_last_accessed_at=? WHERE brief_date=?').bind(at,date).run();}
  async updatePush(date:string,result:{status:string;accepted:number;rejected:number;invalidated:number;sentAt:string|null}){await this.db.prepare('UPDATE morning_briefs SET push_status=?,push_accepted=?,push_rejected=?,push_invalidated=?,push_sent_at=? WHERE brief_date=?').bind(result.status,result.accepted,result.rejected,result.invalidated,result.sentAt,date).run();}
  async history(limit:number){const result=await this.db.prepare('SELECT * FROM morning_briefs ORDER BY brief_date DESC LIMIT ?').bind(limit).all<BriefRow>();return result.results.map(row);}
  async recentItems(beforeDate:string,days:number){const result=await this.db.prepare('SELECT items_json FROM morning_briefs WHERE brief_date<? AND items_json IS NOT NULL ORDER BY brief_date DESC LIMIT ?').bind(beforeDate,days).all<{items_json:string}>();return result.results.flatMap(value=>parse<EditorialItem[]>(value.items_json,[]));}
  async acquireGeneration(date:string,owner:string,staleBefore:string){await this.db.prepare('DELETE FROM morning_brief_generation_locks WHERE brief_date=? AND acquired_at<?').bind(date,staleBefore).run();const result=await this.db.prepare('INSERT OR IGNORE INTO morning_brief_generation_locks (brief_date,owner_id,acquired_at) VALUES (?,?,?)').bind(date,owner,new Date().toISOString()).run() as D1Result;return (result.meta?.changes??0)===1;}
  async releaseGeneration(date:string,owner:string){await this.db.prepare('DELETE FROM morning_brief_generation_locks WHERE brief_date=? AND owner_id=?').bind(date,owner).run();}
}
