'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import type { DailyRecommendation, MealLog, Recipe } from '../domain';
import { recipeRequest } from './client';
type Overview = { daily: DailyRecommendation|null; meal: MealLog|null; recipes:Recipe[] };
export default function EatOverview() {
  const [data,setData]=useState<Overview|null>(null),[error,setError]=useState('');
  async function load(){setError('');try{setData(await recipeRequest<Overview>('/daily'));}catch(e){setError((e as Error).message);}}
  useEffect(()=>{void load();},[]);
  const today=data?.daily?.candidates[data.daily.selectedIndex];
  return <div className="mx-auto max-w-5xl space-y-6 p-6 md:p-10"><header><h1 className="text-3xl font-semibold">Eat</h1><p className="mt-2 text-muted-foreground">今天的选择与你的厨房笔记。</p></header>
    {error&&<div role="alert"><p className="text-destructive">{error}</p><Button variant="outline" onClick={()=>void load()}>重新加载</Button></div>}
    {!data&&!error&&<p>正在读取…</p>}
    {data&&<div className="grid gap-5 md:grid-cols-2"><Card><CardHeader><CardTitle>{today?.title||'今天还没有推荐'}</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">{data.meal ? `实际吃了：${data.meal.name}` : '今天还没有用餐记录。'}</p><Link className="inline-flex h-10 items-center rounded-md border px-4 text-sm" href="/console/eat/daily">每日菜单推荐</Link></CardContent></Card>
    <Card><CardHeader><CardTitle>{data.recipes.length} 道个人食谱</CardTitle></CardHeader><CardContent><Link className="inline-flex h-10 items-center rounded-md border px-4 text-sm" href="/console/eat/my-recipes">我的食谱</Link></CardContent></Card></div>}
  </div>;
}
