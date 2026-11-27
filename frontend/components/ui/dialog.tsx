'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './button';

export function Dialog({ title, closeLabel, onClose, children, size = 'default' }: { title: string; closeLabel: string; onClose: () => void; children: ReactNode; size?: 'default' | 'sm' }) {
  const ref = useRef<HTMLDialogElement>(null), titleId = useId();
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }} style={{ height: 'auto', overflowY: 'auto' }} className={`console-root m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] ${size === 'sm' ? 'max-w-lg' : 'max-w-2xl'} rounded-lg border bg-background p-0 text-foreground shadow-lg backdrop:bg-black/40`}>
    <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-background px-5 py-3"><h2 id={titleId} className="text-lg font-semibold">{title}</h2><Button type="button" variant="ghost" size="icon" aria-label={closeLabel} onClick={onClose}><X size={18}/></Button></div>
    <div className="space-y-4 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>
  </dialog>;
}
