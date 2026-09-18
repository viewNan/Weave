import type { HTMLAttributes } from 'react';

export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={`rounded-3xl border border-white/80 bg-white/80 shadow-[0_18px_55px_rgba(93,73,168,0.08)] backdrop-blur ${className}`} {...props} />; }
export function CardHeader({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={`flex flex-col gap-1.5 p-6 ${className}`} {...props} />; }
export function CardTitle({ className = '', ...props }: HTMLAttributes<HTMLHeadingElement>) { return <h2 className={`text-lg font-semibold tracking-tight text-slate-900 ${className}`} {...props} />; }
export function CardDescription({ className = '', ...props }: HTMLAttributes<HTMLParagraphElement>) { return <p className={`text-sm leading-6 text-slate-500 ${className}`} {...props} />; }
export function CardContent({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={`p-6 pt-0 ${className}`} {...props} />; }
