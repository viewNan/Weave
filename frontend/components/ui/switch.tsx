import type { ButtonHTMLAttributes } from 'react';

export function Switch({ checked, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { checked?: boolean }) { return <button type="button" role="switch" aria-checked={checked} className={`relative h-6 w-11 rounded-full transition-colors ${checked ? 'bg-[#7667F5]' : 'bg-slate-200'} ${className}`} {...props}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'left-6' : 'left-1'}`} /></button>; }
