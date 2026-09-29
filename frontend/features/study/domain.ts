export type StudyItem = { id:string; title:string; enabled:boolean; sortOrder:number; createdAt:string; updatedAt:string };
export type StudySuggestion = { id:string; title:string; sortOrder:number };
export type StudySettings = { focusMinMinutes:number; focusMaxMinutes:number; breakMinMinutes:number; breakMaxMinutes:number };
export type RoundStatus = 'drawn'|'rerolled'|'focusing'|'paused'|'focus_elapsed'|'break_ready'|'resting'|'completed'|'abandoned';
export type StudyRound = { id:string; studyItemId:string|null; studyTitle:string; plannedFocusMinutes:number; plannedBreakMinutes:number; actualFocusSeconds:number; status:RoundStatus; drawnAt:string; focusStartedAt:string|null; focusEndsAt:string|null; pausedAt:string|null; pausedRemainingSeconds:number|null; focusFinishedAt:string|null; breakStartedAt:string|null; breakEndsAt:string|null; completedAt:string|null; abandonedAt:string|null; createdAt:string; updatedAt:string };

export const defaultStudySettings:StudySettings={focusMinMinutes:25,focusMaxMinutes:50,breakMinMinutes:5,breakMaxMinutes:12};
export const activeRoundStatuses:RoundStatus[]=['drawn','focusing','paused','focus_elapsed','break_ready','resting'];
export const randomInt=(min:number,max:number,rng=Math.random)=>min+Math.floor(rng()*(max-min+1));
export function pickStudyItem(items:StudyItem[],previousId?:string|null,rng=Math.random){const enabled=items.filter(item=>item.enabled);const candidates=enabled.length>1?enabled.filter(item=>item.id!==previousId):enabled;if(!candidates.length) throw new Error('先添加一个启用的学习内容。');return candidates[Math.floor(rng()*candidates.length)];}
export function randomRound(items:StudyItem[],settings:StudySettings,previousId?:string|null,rng=Math.random){return {item:pickStudyItem(items,previousId,rng),focusMinutes:randomInt(settings.focusMinMinutes,settings.focusMaxMinutes,rng),breakMinutes:randomInt(settings.breakMinMinutes,settings.breakMaxMinutes,rng)};}
export const remainingSeconds=(endsAt:string|null,now=Date.now())=>endsAt?Math.max(0,Math.ceil((new Date(endsAt).getTime()-now)/1000)):0;
export const elapsedSeconds=(startedAt:string|null,now=Date.now())=>startedAt?Math.max(0,Math.floor((now-new Date(startedAt).getTime())/1000)):0;
export const formatDuration=(seconds:number)=>`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
