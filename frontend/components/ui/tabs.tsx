import type { ButtonHTMLAttributes, HTMLAttributes } from 'react';
export function Tabs({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={className} {...props} />; }
export function TabsList({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={`inline-flex rounded-2xl bg-[#7667F5]/[0.07] p-1 ${className}`} {...props} />; }
export function TabsTrigger({ active, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) { return <button className={`rounded-xl px-3 py-2 text-sm transition ${active ? 'bg-white font-semibold text-[#5144bf] shadow-sm' : 'text-slate-500 hover:text-slate-800'} ${className}`} {...props} />; }
