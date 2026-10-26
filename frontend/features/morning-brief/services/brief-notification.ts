import type { Brief } from '../repositories/morning-brief-repository.ts';

const truncate=(value:string,max:number)=>{const chars=Array.from(value.replace(/\s+/g,' ').trim());return chars.length>max?chars.slice(0,max-1).join('')+'…':chars.join('');};

export function briefNotification(brief: Brief) {
  const previews=brief.items.slice(1,4).map(item=>truncate(item.headline,32));
  // Old records may predate structured items; use their saved text without rewriting them.
  const body=previews.length?previews.join('；'):brief.items[0]?.summary||brief.speechText;
  return {title:`全球晨报｜${brief.title}`,body:truncate(body,110),url:'/morning-brief',type:'morning_brief'};
}
