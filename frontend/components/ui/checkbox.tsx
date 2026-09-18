import type { InputHTMLAttributes } from 'react';
export function Checkbox({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) { return <input type="checkbox" className={`h-4 w-4 rounded border-input bg-background text-primary focus:ring-ring ${className}`} {...props} />; }
