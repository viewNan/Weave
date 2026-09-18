import type { ButtonHTMLAttributes } from 'react';

export function Button({ className = '', variant = 'default', size = 'default', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'outline' | 'ghost'; size?: 'default' | 'sm' }) {
  const styles = {
    default: 'bg-[#7667F5] text-white hover:bg-[#6557e6] shadow-sm',
    outline: 'border border-[#7667F5]/20 bg-white text-[#5144bf] hover:bg-[#7667F5]/[0.06]',
    ghost: 'text-slate-600 hover:bg-white/80 hover:text-slate-900',
  }[variant];
  const sizes = size === 'sm' ? 'h-9 px-3 text-sm' : 'h-10 px-4';
  return <button className={`inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 ${sizes} ${styles} ${className}`} {...props} />;
}
