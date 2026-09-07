import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { regions, landmasses, outlines, regionSurfaceShare, surfacePoint } from '../lib/world.ts';
import { landScale, orientation, sphericalArea, createLandGeometry } from '../lib/terrain.ts';

test('the world has distinct regions, island chains and calibrated spherical area', () => {
  assert.equal(new Set(regions.map(r => r.id)).size, 8);
  assert.equal(landmasses.filter(p => p.regionId === 'hobby').length, 6);
  assert.equal(landmasses.filter(p => p.regionId === 'spark').length, 8);
  assert.equal(landmasses.filter(p => p.regionId === 'exploration').length, 6);
  let triangles = 0;
  for (const region of regions) {
    const pieces = landmasses.filter(p => p.regionId === region.id);
    assert.ok(Math.abs(pieces.reduce((sum, p) => sum + p.surfaceShare, 0) - regionSurfaceShare(region)) < 1e-10);
    for (const piece of pieces) {
      const scale = landScale(piece);
      assert.ok(Math.abs(sphericalArea(outlines[piece.shapeType], scale) / (4 * Math.PI) - piece.surfaceShare) < 1e-8);
      const geometry = createLandGeometry(piece, region, scale);
      const vertices = geometry.getAttribute('position');
      triangles += vertices.count / 3;
      for (let i = 0; i < vertices.count; i++) assert.ok(new THREE.Vector3().fromBufferAttribute(vertices, i).length() >= 2.5299);
      geometry.dispose();
    }
  }
  assert.ok(triangles < 25000, `Terrain budget exceeded: ${triangles}`);
  assert.deepEqual(surfacePoint(0, 0), [0, 0, 2.5]);
});

test('continents and detached islands do not overlap on the globe', () => {
  const pieces = landmasses.map(piece => ({ ...piece, scale: landScale(piece), inverse: orientation(piece).invert(), outline: outlines[piece.shapeType] }));
  const overlap = new Map<string, number>();
  const samples = 24000;
  let land = 0, ice = 0;
  for (let i = 0; i < samples; i++) {
    const y = 1 - 2 * (i + .5) / samples, angle = i * Math.PI * (3 - Math.sqrt(5));
    const world = new THREE.Vector3(Math.cos(angle) * Math.sqrt(1-y*y), y, Math.sin(angle) * Math.sqrt(1-y*y));
    const hits: string[] = [];
    for (const piece of pieces) {
      const local = world.clone().applyQuaternion(piece.inverse);
      if (local.z <= 0) continue;
      const x = local.x / local.z / piece.scale, py = local.y / local.z / piece.scale;
      let inside = false;
      const shape = piece.outline;
      for (let a=0,b=shape.length-1;a<shape.length;b=a++) {
        if ((shape[a][1]>py)!==(shape[b][1]>py) && x < (shape[b][0]-shape[a][0])*(py-shape[a][1])/(shape[b][1]-shape[a][1])+shape[a][0]) inside=!inside;
      }
      if (inside) hits.push(piece.id);
    }
    if (hits.some(id => id.startsWith('exploration'))) ice++;
    else if (hits.length) land++;
    if (hits.length>1) { const key=hits.join(' / '); overlap.set(key,(overlap.get(key)??0)+1); }
  }
  assert.equal(overlap.size,0, JSON.stringify(Object.fromEntries(overlap)));
  assert.ok(Math.abs(land/samples-.32)<.005, `Land: ${land/samples}`);
  assert.ok(Math.abs(ice/samples-.08)<.005, `Ice: ${ice/samples}`);
});
