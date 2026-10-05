import EatAccess from '../../../../features/recipes/ui/EatAccess';
import AtlasEditorShell from '../../../../features/atlas/AtlasEditorShell';

export default async function AtlasEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EatAccess label="Atlas"><AtlasEditorShell mapId={id} /></EatAccess>;
}
