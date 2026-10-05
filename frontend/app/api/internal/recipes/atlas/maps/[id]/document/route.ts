import { getDocument, saveDocument } from '../../../../../../../../features/atlas/document';
import { atlasRoute, mapBody } from '../../../../../../../../features/atlas/server';

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  return atlasRoute(request, async db => getDocument(db, (await context.params).id));
}

export async function PUT(request: Request, context: Context) {
  return atlasRoute(request, async db => saveDocument(db, (await context.params).id, await mapBody(request, 2_000_000)));
}
