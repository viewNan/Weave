import { redirect } from 'next/navigation';

export default function PushPage() { redirect('/settings?tab=push'); }
