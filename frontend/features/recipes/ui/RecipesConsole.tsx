'use client';
import { useLanguage } from '../../../shared/i18n/LanguageProvider';
import { Plus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { recipeRequest } from './client';
type Recipe={id:string;title:string;categoryId:string|null;category:string|null;tags:string[];minutes:number|null;difficulty:string|null;servings:string|null;markdown:string};
type Category={id:string;name:string};
export default function RecipesConsole({tab: _tab}:{tab:'daily'|'library'}) {
  const { t } = useLanguage();

  const [recipes,setRecipes]=useState<Recipe[]>([]), [categories,setCategories]=useState<Category[]>([]);
  const [editing,setEditing]=useState<Recipe|null>(null), [status,setStatus]=useState(''), [busy,setBusy]=useState(false);
  const lock=useRef(false);
  async function load() { const [r,c]=await Promise.all([recipeRequest<{recipes:Recipe[]}>(''),recipeRequest<{categories:Category[]}>('/categories')]);setRecipes(r.recipes);setCategories(c.categories); }
  useEffect(()=>{load().catch(e=>setStatus(e.message));},[]);
  async function save(recipe:Recipe) { if(lock.current)return;lock.current=true;setBusy(true);setStatus('');
    try{await recipeRequest(recipe.id ? `/${recipe.id}` : '',recipe.id?'PATCH':'POST',recipe);setEditing(null);await load();setStatus(t("食谱已保存。"));}
    catch(e){setStatus((e as Error).message);}finally{lock.current=false;setBusy(false);}
  }
  async function addCategory() { const name=window.prompt(t("新分类名称"));if(!name?.trim()||lock.current)return;
    lock.current=true;setBusy(true);setStatus('');try{const category=await recipeRequest<Category>('/categories','POST',{name});await load();return category;}
    catch(e){setStatus((e as Error).message);}finally{lock.current=false;setBusy(false);}
  }
  return <fieldset disabled={busy} className="min-w-0 border-0 p-0" aria-busy={busy}>
    <Library recipes={recipes} categories={categories} editing={editing} setEditing={setEditing} save={save} addCategory={addCategory} status={status}/>
  </fieldset>;
}
function Library({recipes,categories,editing,setEditing,save,addCategory,status}:{recipes:Recipe[];categories:Category[];editing:Recipe|null;setEditing:(x:Recipe|null)=>void;save:(x:Recipe)=>void;addCategory:()=>Promise<Category|undefined>;status:string}){
  const { t } = useLanguage();
const [query,setQuery]=useState('');const shown=useMemo(()=>recipes.filter(x=>x.title.includes(query)||x.tags.join(' ').includes(query)),[recipes,query]);const blank=():Recipe=>({id:'',title:'',categoryId:null,category:null,tags:[],minutes:30,difficulty:t("简单"),servings:t("2 人"),markdown:t("## 材料\n\n- \n\n## 做法\n\n1. \n\n## 下次改进\n\n-")});return <div className="mx-auto w-full max-w-6xl space-y-6 p-6 md:p-10"><header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-semibold tracking-tight">{t("我的食谱")}</h1><p className="mt-2 text-sm text-muted-foreground">{t("你的真实厨房 Notebook。")}</p>{status&&<p className="mt-2 text-sm text-muted-foreground">{t(status)}</p>}</div><div className="flex gap-2"><a href="/console/eat/daily"><Button variant="outline">{t("每日菜单推荐")}</Button></a><Button onClick={()=>setEditing(blank())}><Plus size={16}/>{t("新建食谱")}</Button></div></header>{editing?<RecipeEditor recipe={editing} categories={categories} onChange={setEditing} save={save} addCategory={addCategory} cancel={()=>setEditing(null)}/>:<><Input value={query} onChange={e=>setQuery(e.target.value)} placeholder={t("搜索食谱、食材或标签…")}/><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{shown.map(item=><Card key={item.id} className="cursor-pointer hover:bg-muted/30" onClick={()=>setEditing(item)}><CardHeader><CardTitle className="text-lg">{item.title}</CardTitle><CardDescription>{item.category||t("未分类")} · {item.minutes||'—'} min</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-1">{item.tags.map(tag=><Badge variant="outline" key={tag}>{tag}</Badge>)}</CardContent></Card>)}</div>{!shown.length&&<p className="py-16 text-center text-sm text-muted-foreground">{t("还没有食谱。新建第一道吧。")}</p>}</>}</div>}
function RecipeEditor({recipe,categories,onChange,save,addCategory,cancel}:{recipe:Recipe;categories:Category[];onChange:(x:Recipe)=>void;save:(x:Recipe)=>void;addCategory:()=>Promise<Category|undefined>;cancel:()=>void}){
  const { t } = useLanguage();
return <Card><CardHeader><CardTitle>{recipe.id?t("编辑食谱"):t("新建食谱")}</CardTitle></CardHeader><CardContent className="space-y-4"><Input value={recipe.title} onChange={e=>onChange({...recipe,title:e.target.value})} placeholder={t("标题，例如：麻婆豆腐")}/><div className="grid gap-3 sm:grid-cols-2"><div className="flex gap-2"><select className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm" value={recipe.categoryId||''} onChange={e=>onChange({...recipe,categoryId:e.target.value||null,category:categories.find(x=>x.id===e.target.value)?.name||null})}><option value="">{t("未分类")}</option>{categories.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select><Button type="button" variant="outline" onClick={async()=>{const category=await addCategory();if(category)onChange({...recipe,categoryId:category.id,category:category.name});}}>{t("新分类")}</Button></div><Input value={recipe.tags.join('、')} onChange={e=>onChange({...recipe,tags:e.target.value.split(/[、,]/).map(x=>x.trim()).filter(Boolean)})} placeholder={t("Tags，用顿号分隔")}/></div><div className="grid gap-3 sm:grid-cols-3"><Input type="number" value={recipe.minutes||''} onChange={e=>onChange({...recipe,minutes:Number(e.target.value)||null})} placeholder={t("分钟")}/><Input value={recipe.difficulty||''} onChange={e=>onChange({...recipe,difficulty:e.target.value})} placeholder={t("难度")}/><Input value={recipe.servings||''} onChange={e=>onChange({...recipe,servings:e.target.value})} placeholder={t("份量")}/></div><Textarea className="min-h-96 font-mono leading-6" value={recipe.markdown} onChange={e=>onChange({...recipe,markdown:e.target.value})} aria-label={t("食谱 Markdown 正文")}/><div className="flex gap-2"><Button onClick={()=>save(recipe)}>{t("保存食谱")}</Button><Button variant="outline" onClick={cancel}>{t("取消")}</Button></div></CardContent></Card>}
