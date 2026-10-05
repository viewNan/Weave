'use client';

import dynamic from 'next/dynamic';

const AtlasEditor = dynamic(() => import('./AtlasEditor'), { ssr: false, loading: () => <p className="p-6 text-sm text-muted-foreground">正在打开画布…</p> });

export default function AtlasEditorShell({ mapId }: { mapId: string }) {
  return <AtlasEditor mapId={mapId} />;
}
