'use client';

import { Archive, Bell, ChevronDown, Dices, FileText, LayoutDashboard, Map, Menu, Settings, Sun, UtensilsCrossed, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { Separator } from '../../components/ui/separator';
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '../../components/ui/sidebar';

const nav = [
  { href: '/console', label: 'Overview', icon: LayoutDashboard },
  { href: '/console/morning-brief', label: 'Morning Brief', icon: Sun },
  { href: '/console/study', label: '活动转盘', icon: Dices },
  { href: '/console/notifications', label: 'Notifications', icon: Bell },
  { href: '/console/files', label: 'Files', icon: FileText },
  { href: '/console/atlas', label: 'Atlas', icon: Map },
];

export function ConsoleShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [eatOpen, setEatOpen] = useState(false);
  const pathname = usePathname();
  const eatRoute = pathname.startsWith('/console/eat') || pathname.startsWith('/console/recipes');
  const showEatChildren = eatOpen || (eatRoute && pathname !== '/console/eat');
  const pageLabel = pathname === '/console/settings' ? '设置' : eatRoute ? 'Eat' : nav.find(item => pathname === item.href || (item.href !== '/console' && pathname.startsWith(`${item.href}/`)))?.label || 'Console';
  return <div className="console-root console-shell flex h-svh min-h-0 overflow-hidden">
    <button className="console-backdrop" aria-label="关闭导航" data-open={open} onClick={() => setOpen(false)} />
    <Sidebar className="console-sidebar" data-open={open}>
      <SidebarHeader className="flex items-center justify-between"><a href="/" className="flex items-center gap-2 px-2 text-sm font-semibold"><span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-xs text-primary-foreground">W</span> Weave Console</a><Button className="md:hidden" variant="ghost" size="icon" aria-label="关闭导航" onClick={() => setOpen(false)}><X size={18}/></Button></SidebarHeader>
      <Separator />
      <SidebarContent><SidebarGroup><SidebarGroupLabel>Workspace</SidebarGroupLabel><SidebarMenu>{nav.slice(0,2).map(({ href, label, icon: Icon }) => <SidebarMenuItem key={href}><a href={href} className="block" onClick={() => setOpen(false)}><SidebarMenuButton active={pathname === href}><Icon size={16}/>{label}</SidebarMenuButton></a></SidebarMenuItem>)}<SidebarMenuItem><div className="flex items-center"><a href="/console/eat" className="min-w-0 flex-1" onClick={() => setOpen(false)}><SidebarMenuButton active={eatRoute}><UtensilsCrossed size={16}/>Eat</SidebarMenuButton></a><Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={showEatChildren ? '收起 Eat' : '展开 Eat'} onClick={() => setEatOpen(value => !value)}><ChevronDown className={`transition-transform ${showEatChildren ? '' : '-rotate-90'}`} size={15}/></Button></div>{showEatChildren && <ul className="ml-5 mt-1 grid gap-1 border-l pl-2"><li><a href="/console/eat/daily" className={`block rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent ${pathname === '/console/eat/daily' || pathname === '/console/recipes/daily' ? 'bg-sidebar-accent font-medium' : ''}`} onClick={() => setOpen(false)}>每日食谱</a></li><li><a href="/console/eat/my-recipes" className={`block rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent ${pathname === '/console/eat/my-recipes' || pathname === '/console/recipes/library' ? 'bg-sidebar-accent font-medium' : ''}`} onClick={() => setOpen(false)}>我的食谱</a></li></ul>}</SidebarMenuItem>{nav.slice(2).map(({ href, label, icon: Icon }) => <SidebarMenuItem key={href}><a href={href} className="block" onClick={() => setOpen(false)}><SidebarMenuButton active={pathname === href}><Icon size={16}/>{label}</SidebarMenuButton></a></SidebarMenuItem>)}</SidebarMenu></SidebarGroup></SidebarContent>
      <SidebarFooter><SidebarMenu><SidebarMenuItem><a href="/" className="block"><SidebarMenuButton><Archive size={16}/> Back to Personal Planet</SidebarMenuButton></a></SidebarMenuItem><SidebarMenuItem><a href="/console/settings" className="block" onClick={() => setOpen(false)}><SidebarMenuButton active={pathname === "/console/settings"}><Settings size={16}/> 设置</SidebarMenuButton></a></SidebarMenuItem></SidebarMenu></SidebarFooter>
    </Sidebar>
    <SidebarInset className="console-main"><div className="sticky top-0 z-10 border-b bg-background"><div className="flex h-14 items-center gap-3 px-4 sm:px-6"><Button className="md:hidden" variant="ghost" size="icon" aria-label="打开导航" onClick={() => setOpen(true)}><Menu size={18}/></Button><span className="text-sm text-muted-foreground">Weave / {pageLabel}</span></div></div>{children}</SidebarInset>
  </div>;
}
