import type { GeneratedBrief, MorningBriefProvider } from '../services/morning-brief-provider.ts';
import { CATEGORIES, LIMITS } from '../config/content-policy.ts';
import { EDITORIAL_RULES, recentCoverageText } from '../config/editorial-policy.ts';
import { validateGeneratedBrief } from '../services/validate-generated-brief.ts';

async function openAIError(res: Response) {
  const body = await res.json().catch(() => null) as { error?: { type?: string; code?: string } } | null;
  const type = body?.error?.type ? `, ${body.error.type}` : '';
  const code = body?.error?.code ? `, ${body.error.code}` : '';
  const requestId = res.headers.get('x-request-id');
  return new Error(`OpenAI request failed (${res.status}${type}${code}${requestId ? `, request ${requestId}` : ''}).`);
}

type StreamResult = { text: string; completed: boolean; responseId?: string; usage?: unknown; webSearchCalls: number };

async function readStreamingText(res: Response, onEvent: (type: string) => void): Promise<StreamResult> {
 const reader = res.body?.getReader();
 if (!reader) throw new Error('OpenAI returned no streaming body.');
 const decoder = new TextDecoder(); let buffer = ''; let text = ''; let completed = false; let responseId: string | undefined; let usage: unknown; let webSearchCalls = 0;
 const handle = (block: string) => {
  const data = block.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
  if (!data || data === '[DONE]') return;
  const event = JSON.parse(data) as { type?: string; delta?: string; text?: string; error?: { code?: string; message?: string }; response?: { id?: string; error?: { code?: string; message?: string }; incomplete_details?: { reason?: string }; usage?: unknown } };
  if (event.type) onEvent(event.type);
  if (event.type === 'response.output_text.delta') text += event.delta ?? '';
  if (event.type === 'response.output_text.done' && !text) text = event.text ?? '';
  if (event.type === 'response.web_search_call.completed') webSearchCalls++;
  if (event.type === 'response.completed') { completed = true; responseId = event.response?.id; usage = event.response?.usage; }
  if (event.type === 'error' || event.type === 'response.failed') {
   const error = event.error ?? event.response?.error;
   throw new Error(`OpenAI streaming request failed${error?.code ? ` (${error.code})` : ''}${error?.message ? `: ${error.message}` : '.'}`);
  }
  if (event.type === 'response.incomplete') throw new Error(`OpenAI response was incomplete${event.response?.incomplete_details?.reason ? ` (${event.response.incomplete_details.reason})` : ''}.`);
 };
 while (true) {
  const { value, done } = await reader.read();
  buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
  const blocks = buffer.split(/\r?\n\r?\n/); buffer = blocks.pop() ?? '';
  blocks.forEach(handle); if (done) break;
 }
 if (buffer.trim()) handle(buffer);
 if (!completed) throw new Error('OpenAI stream ended before response.completed.');
 if (!text) throw new Error('OpenAI returned no text.');
 return { text, completed, responseId, usage, webSearchCalls };
}

export class OpenAIMorningBriefProvider implements MorningBriefProvider { private key:string; constructor(key:string){this.key=key;} async generate({date,categories,recentItems}:Parameters<MorningBriefProvider['generate']>[0]):Promise<GeneratedBrief>{
 const categorySpec=categories.map(c=>`${c}（${CATEGORIES[c]}，最多 ${LIMITS[c]} 条）`).join('、');
 const prompt=`${EDITORIAL_RULES}\n日期：${date}；时区：Asia/Tokyo。\n今日栏目：${categorySpec}。\n最近 7 天已经播报过的结构化事件：\n${recentCoverageText(recentItems)}\n\n返回 JSON，必须有 title、speechText、items。speechText 通常 300–700 字；内容少时可以明显更短，绝不为了达到长度加入次要事件、重复背景或无关信息。适合中文语音播报，不含 URL。items 只包含实际写入 speechText 的事件；每项有 category、eventKey、headline、summary、updateType（new 或 material_update）、materialUpdateReason 与 sourceUrls。new 的 materialUpdateReason 填空字符串；material_update 必须写明今天的新事实。相同核心事件必须沿用历史 eventKey；无实质更新就不要收入。`;
 const schema={
  type:'object', additionalProperties:false, required:['title','speechText','items'],
  properties:{
   title:{type:'string'}, speechText:{type:'string'},
   items:{type:'array',items:{type:'object',additionalProperties:false,required:['category','eventKey','headline','summary','updateType','materialUpdateReason','sourceUrls'],properties:{
    category:{type:'string',enum:categories}, eventKey:{type:'string'}, headline:{type:'string'}, summary:{type:'string'}, updateType:{type:'string',enum:['new','material_update']}, materialUpdateReason:{type:'string'}, sourceUrls:{type:'array',items:{type:'string'}},
   }}},
  },
 };
 const runId=crypto.randomUUID();const startedAt=Date.now();const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),5*60_000);
 const log=(stage:string, detail:Record<string,unknown>={})=>console.info('Morning brief OpenAI.',{runId,stage,elapsedMs:Date.now()-startedAt,...detail});
 try {
  log('request_started',{model:'gpt-5',reasoningEffort:'low',categoryCount:categories.length,recentItemCount:recentItems.length});
  const res=await fetch('https://api.openai.com/v1/responses',{method:'POST',signal:controller.signal,headers:{'content-type':'application/json',authorization:`Bearer ${this.key}`},body:JSON.stringify({model:'gpt-5',reasoning:{effort:'low'},max_output_tokens:4000,tools:[{type:'web_search'}],input:prompt,store:false,stream:true,text:{format:{type:'json_schema',name:'morning_brief',strict:true,schema}}})});
  const requestId=res.headers.get('x-request-id');log('response_headers',{status:res.status,requestId});
  if(!res.ok) throw await openAIError(res);
  const streamed=await readStreamingText(res,type=>{if(type==='response.created'||type==='response.in_progress'||type==='response.completed'||type==='response.failed'||type==='response.incomplete')log('stream_event',{type,requestId});});
  const brief=validateGeneratedBrief(JSON.parse(streamed.text.replace(/^```json\s*|```$/g,'')));
  log('completed',{requestId,responseId:streamed.responseId,usage:streamed.usage,webSearchCalls:streamed.webSearchCalls,textLength:streamed.text.length,itemCount:brief.items.length});
  return brief;
 } catch(error) {
  const message=error instanceof Error?error.message:'OpenAI request failed.';const safeMessage=message.length>500?`${message.slice(0,500)}…`:message;
  console.error('Morning brief OpenAI failed.',{runId,elapsedMs:Date.now()-startedAt,name:error instanceof Error?error.name:'Error',message:safeMessage});
  if(error instanceof DOMException&&error.name==='AbortError')throw new Error('OpenAI request timed out after five minutes.');
  throw error;
 } finally {clearTimeout(timer);}
 }
}
