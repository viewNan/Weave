import { Archive, Bell, FileText, LayoutDashboard, Moon, Settings, Sun } from 'lucide-react';
import './console.css';
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '../../components/ui/sidebar';
import { Separator } from '../../components/ui/separator';

const nav = [
  { href: '/console', label: 'Overview', icon: LayoutDashboard },
  { href: '/console/morning-brief', label: 'Morning Brief', icon: Sun },
  { href: '/console/notifications', label: 'Notifications', icon: Bell },
  { href: '/console/files', label: 'Files', icon: FileText },
];

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return <div className="console-root flex min-h-screen"><Sidebar><SidebarHeader><a href="/" className="flex items-center gap-2 px-2 text-sm font-semibold"><span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-xs text-primary-foreground">W</span> Weave Console</a></SidebarHeader><Separator /><SidebarContent><SidebarGroup><SidebarGroupLabel>Workspace</SidebarGroupLabel><SidebarMenu>{nav.map(({ href, label, icon: Icon }) => <SidebarMenuItem key={href}><a href={href} className="block"><SidebarMenuButton><Icon size={16}/>{label}</SidebarMenuButton></a></SidebarMenuItem>)}</SidebarMenu></SidebarGroup></SidebarContent><SidebarFooter><SidebarMenu><SidebarMenuItem><a href="/" className="block"><SidebarMenuButton><Archive size={16}/> Back to Personal Planet</SidebarMenuButton></a></SidebarMenuItem><SidebarMenuItem><SidebarMenuButton><Settings size={16}/> Settings</SidebarMenuButton></SidebarMenuItem></SidebarMenu></SidebarFooter></Sidebar><SidebarInset><div className="border-b"><div className="flex h-14 items-center px-6"><span className="text-sm text-muted-foreground">Weave / Console</span></div></div>{children}</SidebarInset></div>;
}
