import AtlasEditorShell from '../../../../features/atlas/AtlasEditorShell';

export default async function AtlasEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AtlasEditorShell mapId={id} />;
}
