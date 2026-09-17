import type { CategoryId } from '../config/content-policy';
import type { GeneratedBrief, MorningBriefProvider } from '../services/morning-brief-provider';
import { CATEGORIES, LIMITS } from '../config/content-policy';
export class OpenAIMorningBriefProvider implements MorningBriefProvider { constructor(private key:string){} async generate(date:string,categories:CategoryId[]):Promise<GeneratedBrief>{
 const prompt=`你是个人晨报编辑。日期：${date}，时区 Asia/Tokyo。按分类${categories.map(c=>`${c}(${CATEGORIES[c]})最多${LIMITS[c]}条`).join('、')}检索今天最新且重要的信息。输出严格 JSON：{"title":string,"speechText":string,"categories":string[],"sources":string[]}。speechText 用自然中文，500-900字，适合2-4分钟语音播报；不要包含URL，不值得播报的分类可省略，避免重复故事。sources只放来源URL。`;
 const res=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${this.key}`},body:JSON.stringify({model:'gpt-5',tools:[{type:'web_search'}],input:prompt,store:false})});
 if(!res.ok) throw new Error(`OpenAI request failed (${res.status}).`); const data:any=await res.json(); const text=data.output_text||data.output?.flatMap((x:any)=>x.content||[]).find((x:any)=>x.type==='output_text')?.text; if(!text) throw new Error('OpenAI returned no text.');
 const parsed=JSON.parse(text.replace(/^```json\s*|```$/g,'')); return {title:String(parsed.title),speechText:String(parsed.speechText),categories:parsed.categories.filter((x:string)=>categories.includes(x as CategoryId)),sources:Array.isArray(parsed.sources)?parsed.sources.map(String):[]}; }
}
