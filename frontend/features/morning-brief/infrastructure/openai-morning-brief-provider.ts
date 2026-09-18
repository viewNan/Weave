import type { GeneratedBrief, MorningBriefProvider } from '../services/morning-brief-provider';
import { CATEGORIES, LIMITS } from '../config/content-policy';
import { EDITORIAL_RULES, recentCoverageText } from '../config/editorial-policy';
import { validateGeneratedBrief } from '../services/validate-generated-brief';

export class OpenAIMorningBriefProvider implements MorningBriefProvider { constructor(private key:string){} async generate({date,categories,recentItems}:Parameters<MorningBriefProvider['generate']>[0]):Promise<GeneratedBrief>{
 const categorySpec=categories.map(c=>`${c}（${CATEGORIES[c]}，最多 ${LIMITS[c]} 条）`).join('、');
 const prompt=`${EDITORIAL_RULES}\n日期：${date}；时区：Asia/Tokyo。\n今日栏目：${categorySpec}。\n最近 7 天已经播报过的结构化事件：\n${recentCoverageText(recentItems)}\n\n返回 JSON，必须有 title、speechText、items。speechText 500–900 字，适合 2–4 分钟中文语音播报，不含 URL。items 只包含实际写入 speechText 的事件；每项有 category、eventKey、headline、summary、updateType（new 或 material_update）、materialUpdateReason 与 sourceUrls。new 的 materialUpdateReason 填空字符串；material_update 必须写明今天的新事实。相同核心事件必须沿用历史 eventKey；无实质更新就不要收入。`;
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),55000);
 const schema={
  type:'object', additionalProperties:false, required:['title','speechText','items'],
  properties:{
   title:{type:'string'}, speechText:{type:'string'},
   items:{type:'array',items:{type:'object',additionalProperties:false,required:['category','eventKey','headline','summary','updateType','materialUpdateReason','sourceUrls'],properties:{
    category:{type:'string',enum:categories}, eventKey:{type:'string'}, headline:{type:'string'}, summary:{type:'string'}, updateType:{type:'string',enum:['new','material_update']}, materialUpdateReason:{type:'string'}, sourceUrls:{type:'array',items:{type:'string'}},
   }}},
  },
 };
 try { const res=await fetch('https://api.openai.com/v1/responses',{method:'POST',signal:controller.signal,headers:{'content-type':'application/json',authorization:`Bearer ${this.key}`},body:JSON.stringify({model:'gpt-5',tools:[{type:'web_search'}],input:prompt,store:false,text:{format:{type:'json_schema',name:'morning_brief',strict:true,schema}}})});
 if(!res.ok) throw new Error(`OpenAI request failed (${res.status}).`);const data:any=await res.json();const text=data.output_text||data.output?.flatMap((x:any)=>x.content||[]).find((x:any)=>x.type==='output_text')?.text;if(!text) throw new Error('OpenAI returned no text.');return validateGeneratedBrief(JSON.parse(text.replace(/^```json\s*|```$/g,'')));}
 catch(error){if(error instanceof DOMException&&error.name==='AbortError')throw new Error('OpenAI request timed out.');throw error;} finally {clearTimeout(timer);}
 }
}
