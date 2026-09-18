import type { HTMLAttributes } from 'react';
export function Sidebar({ className = '', ...props }: HTMLAttributes<HTMLElement>) { return <aside className={`flex h-svh w-64 flex-col border-r bg-sidebar text-sidebar-foreground ${className}`} {...props} />; }
export function SidebarHeader({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={`p-4 ${className}`} {...props} />; }
export function SidebarContent({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={`flex-1 overflow-auto px-3 ${className}`} {...props} />; }
export function SidebarFooter({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={`border-t p-3 ${className}`} {...props} />; }
export function SidebarGroup({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={`py-2 ${className}`} {...props} />; }
export function SidebarGroupLabel({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={`px-2 py-1.5 text-xs font-medium text-muted-foreground ${className}`} {...props} />; }
export function SidebarMenu({ className = '', ...props }: HTMLAttributes<HTMLUListElement>) { return <ul className={`flex w-full min-w-0 flex-col gap-1 ${className}`} {...props} />; }
export function SidebarMenuItem({ className = '', ...props }: HTMLAttributes<HTMLLIElement>) { return <li className={className} {...props} />; }
export function SidebarMenuButton({ active, className = '', ...props }: HTMLAttributes<HTMLButtonElement> & { active?: boolean }) { return <button className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${active ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground' : ''} ${className}`} {...props} />; }
export function SidebarInset({ className = '', ...props }: HTMLAttributes<HTMLElement>) { return <main className={`min-w-0 flex-1 bg-background ${className}`} {...props} />; }
