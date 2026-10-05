import { createMap, listMaps } from '../../../../../../features/atlas/maps';
import { atlasRoute, mapBody } from '../../../../../../features/atlas/server';

export async function GET(request: Request) {
  return atlasRoute(request, db => listMaps(db));
}

export async function POST(request: Request) {
  return atlasRoute(request, async db => createMap(db, await mapBody(request)));
}
