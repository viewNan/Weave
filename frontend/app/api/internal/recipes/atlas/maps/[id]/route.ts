import { deleteMap, getMap } from '../../../../../../../features/atlas/maps';
import { atlasRoute } from '../../../../../../../features/atlas/server';
import { RecipeError } from '../../../../../../../features/recipes/domain';

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  return atlasRoute(request, async db => {
    const map = await getMap(db, (await context.params).id);
    if (!map) throw new RecipeError('Atlas 不存在。', 404);
    return map;
  });
}

export async function DELETE(request: Request, context: Context) {
  return atlasRoute(request, async db => ({ deleted: await deleteMap(db, (await context.params).id) }));
}
