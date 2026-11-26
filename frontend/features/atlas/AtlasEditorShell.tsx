'use client';
import { useLanguage } from '../../shared/i18n/LanguageProvider';

import dynamic from 'next/dynamic';

const AtlasEditor = dynamic(() => import('./AtlasEditor'), { ssr: false, loading: AtlasLoading });

export default function AtlasEditorShell({ mapId }: { mapId: string }) {
  return <AtlasEditor mapId={mapId} />;
}

function AtlasLoading() {
  const { t } = useLanguage();
 return <p className="p-6 text-sm text-muted-foreground">{t("正在打开画布…")}</p>; }
