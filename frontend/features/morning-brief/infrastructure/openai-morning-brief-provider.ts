import type { GeneratedBrief, MorningBriefProvider } from '../services/morning-brief-provider.ts';
import { CATEGORIES } from '../config/content-policy.ts';
import { EDITORIAL_RULES, RUNTIME_PROMPT, recentCoverageText } from '../config/editorial-policy.ts';
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

export class OpenAIMorningBriefProvider implements MorningBriefProvider { private key:string; constructor(key:string){this.key=key;} async generate({date,categories,recentItems,instructions,previousBrief}:Parameters<MorningBriefProvider['generate']>[0]):Promise<GeneratedBrief>{
 const currentTimeJST=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',dateStyle:'short',timeStyle:'long'}).format(new Date());
 const prompt=RUNTIME_PROMPT.replace('{{reportDateJST}}',()=>date).replace('{{currentTimeJST}}',()=>currentTimeJST).replace('{{historyEvents}}',()=>recentCoverageText(recentItems))
   + `\n\n技术格式说明：category可使用 ${categories.map(c=>`${c}（${CATEGORIES[c]}）`).join('、')}，分类只用于标记，不设置各类配额。返回title、speechText、items。items为1–12条；每项包含category、eventKey、headline、summary、updateType、materialUpdateReason、sourceUrls。new的materialUpdateReason为空字符串；material_update必须说明实质新事实。sourceUrls至少包含一个相关的HTTP(S)来源。`;
 const regenerationContext=previousBrief ? `\n\n重新生成今日播报。请根据用户补充提示修订选题及表达，重新核实涉及的事实和来源，返回完整的新播报，而不是修改说明。原稿仅供修改参考，不作为已经核实的来源。保持原有JSON格式、来源要求与事实准确性要求。\n<previous_brief>\n${JSON.stringify(previousBrief)}\n</previous_brief>\n<user_supplement>\n${JSON.stringify(instructions || '请重新选择和组织今天值得知道的内容。')}\n</user_supplement>` : '';
 const schema={
  type:'object', additionalProperties:false, required:['title','speechText','items'],
  properties:{
   title:{type:'string'}, speechText:{type:'string'},
   items:{type:'array',minItems:1,maxItems:12,items:{type:'object',additionalProperties:false,required:['category','eventKey','headline','summary','updateType','materialUpdateReason','sourceUrls'],properties:{
    category:{type:'string',enum:categories}, eventKey:{type:'string'}, headline:{type:'string'}, summary:{type:'string'}, updateType:{type:'string',enum:['new','material_update']}, materialUpdateReason:{type:'string'}, sourceUrls:{type:'array',minItems:1,maxItems:8,items:{type:'string'}},
   }}},
  },
 };
 const runId=crypto.randomUUID();const startedAt=Date.now();const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),5*60_000);
 const log=(stage:string, detail:Record<string,unknown>={})=>console.info('Morning brief OpenAI.',{runId,stage,elapsedMs:Date.now()-startedAt,...detail});
 try {
  log('request_started',{model:'gpt-5',reasoningEffort:'low',categoryCount:categories.length,recentItemCount:recentItems.length});
  const res=await fetch('https://api.openai.com/v1/responses',{method:'POST',signal:controller.signal,headers:{'content-type':'application/json',authorization:`Bearer ${this.key}`},body:JSON.stringify({model:'gpt-5',reasoning:{effort:'low'},max_output_tokens:12000,tools:[{type:'web_search'}],tool_choice:'required',instructions:EDITORIAL_RULES,input:prompt+regenerationContext,store:false,stream:true,text:{format:{type:'json_schema',name:'morning_brief',strict:true,schema}}})});
  const requestId=res.headers.get('x-request-id');log('response_headers',{status:res.status,requestId});
  if(!res.ok) throw await openAIError(res);
  const streamed=await readStreamingText(res,type=>{if(type==='response.created'||type==='response.in_progress'||type==='response.completed'||type==='response.failed'||type==='response.incomplete')log('stream_event',{type,requestId});});
  if (!streamed.webSearchCalls) throw new Error('Morning brief requires a completed web search; no result was saved.');
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
