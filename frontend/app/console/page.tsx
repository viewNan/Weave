import { ArrowRight, Bell, Dices, FileText, Map, Sun, UtensilsCrossed } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';

const items = [
  { href: '/console/morning-brief', title: 'Morning Brief', description: '生成今天的晨报并编辑播报稿。', icon: Sun },
  { href: '/console/eat', title: 'Eat', description: '生成每日推荐、记录实际饮食并管理个人食谱。', icon: UtensilsCrossed },
  { href: '/console/study', title: '学习转盘', description: '把学习内容交给转盘，直接开始这一轮。', icon: Dices },
  { href: '/console/notifications', title: 'Notifications', description: '管理 Web Push 订阅并发送测试通知。', icon: Bell },
  { href: '/console/files', title: 'Files', description: '浏览、搜索和查看个人文件。', icon: FileText },
  { href: '/console/atlas', title: 'Atlas', description: '整理值得长期记住的设计地图。', icon: Map },
];

export default function ConsoleOverview() {
  return <div className="mx-auto w-full max-w-6xl space-y-8 p-6 md:p-10"><div><h1 className="text-3xl font-semibold tracking-tight">Overview</h1><p className="mt-2 text-muted-foreground">Manage your Weave workspace.</p></div><div className="grid gap-4 md:grid-cols-3">{items.map(({ href, title, description, icon: Icon }) => <Card key={href}><CardHeader><Icon className="mb-2" size={20}/><CardTitle className="text-lg">{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader><CardContent><a href={href}><Button variant="outline" size="sm">Open <ArrowRight size={15}/></Button></a></CardContent></Card>)}</div></div>;
}
