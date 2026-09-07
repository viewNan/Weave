import * as THREE from 'three';
import { outlines, familiarityColors, surfacePoint, type Landmass, type Region, type Point } from './world.ts';

function unitPoint([x, y]: Point, scale: number) { return new THREE.Vector3(x * scale, y * scale, 1).normalize(); }

// Solid angles measure actual spherical area, rather than flat map area.
export function sphericalArea(outline: Point[], scale: number) {
  const vertices = outline.map(p => unitPoint(p, scale));
  const triangles = THREE.ShapeUtils.triangulateShape(outline.map(p => new THREE.Vector2(...p)), []);
  return triangles.reduce((area, [i, j, k]) => {
    const a = vertices[i], b = vertices[j], c = vertices[k];
    return area + 2 * Math.atan2(Math.abs(a.dot(new THREE.Vector3().crossVectors(b, c))), 1 + a.dot(b) + b.dot(c) + c.dot(a));
  }, 0);
}

export function landScale(piece: Landmass) {
  let low = 0, high = 4;
  for (let i = 0; i < 30; i++) {
    const mid = (low + high) / 2;
    if (sphericalArea(outlines[piece.shapeType], mid) < piece.surfaceShare * 4 * Math.PI) low = mid; else high = mid;
  }
  return (low + high) / 2;
}

export function orientation(piece: Landmass) {
  return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...surfacePoint(piece.latitude, piece.longitude)).normalize())
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), piece.rotation));
}

export function coastDistance(point: Point, shape: Point[]) {
  const p = new THREE.Vector2(...point);
  return Math.min(...shape.map((a, i) => {
    const start = new THREE.Vector2(...a), edge = new THREE.Vector2(...shape[(i + 1) % shape.length]).sub(start);
    const t = THREE.MathUtils.clamp(p.clone().sub(start).dot(edge) / edge.lengthSq(), 0, 1);
    return p.distanceTo(start.addScaledVector(edge, t));
  }));
}

export function isInOutline([x, y]: Point, shape: Point[]) {
  let inside = false;
  for (let i = 0, j = shape.length - 1; i < shape.length; j = i++) {
    if ((shape[i][1] > y) !== (shape[j][1] > y) && x < (shape[j][0] - shape[i][0]) * (y - shape[i][1]) / (shape[j][1] - shape[i][1]) + shape[i][0]) inside = !inside;
  }
  return inside;
}

export function terrainHeight([x, y]: Point, region: Region, shape: Point[]) {
  const inland = Math.min(1, coastDistance([x, y], shape) / .22);
  let height = .015;
  switch (region.terrainBias) {
    case 'ridge': height = .035 + .12 * Math.exp(-((x + .10 - .15 * y) ** 2) * 17) * (.65 + .35 * Math.cos(y * 6)); break;
    case 'terraces': height = (region.id === 'archive' ? .025 : .035) * (1 + THREE.MathUtils.smoothstep(inland, .35, .55) + THREE.MathUtils.smoothstep(inland, .78, .92)); break;
    case 'plain': height = .025 + .015 * Math.sin(x * 4) * Math.cos(y * 3); break;
    case 'slope': height = .035 + .13 * THREE.MathUtils.clamp((y + 1.2) / 2.6, 0, 1); break;
    case 'hills': height = .035 + .085 * Math.exp(-(x * x + y * y) * 4); break;
    case 'ice': height = .025 + .025 * Math.abs(Math.sin(x * 7 + y * 4)); break;
  }
  return height * inland;
}

export function localSurface(point: Point, scale: number, region: Region, piece: Landmass, lift = 0) {
  return unitPoint(point, scale).multiplyScalar(2.53 + terrainHeight(point, region, outlines[piece.shapeType]) + lift);
}

export function createLandGeometry(piece: Landmass, region: Region, scale: number) {
  const shape = outlines[piece.shapeType];
  const positions: number[] = [], colors: number[] = [];
  const ice = region.id === 'exploration';
  const landColor = new THREE.Color(familiarityColors[piece.familiarity]);
  const coastColor = new THREE.Color(ice ? '#EAF1EF' : '#F6E2D7');
  const midpoint = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  function triangle(a: Point, b: Point, c: Point, depth: number) {
    if (depth) {
      const ab = midpoint(a, b), bc = midpoint(b, c), ca = midpoint(c, a);
      triangle(a, ab, ca, depth - 1); triangle(ab, b, bc, depth - 1); triangle(ca, bc, c, depth - 1); triangle(ab, bc, ca, depth - 1); return;
    }
    const center: Point = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3];
    const coast = coastDistance(center, shape);
    const height = terrainHeight(center, region, shape);
    const color = ice ? new THREE.Color('#FBF5F2').lerp(coastColor, .25 + .2 * Math.sin(center[0] * 12)) : landColor.clone();
    if (!ice && region.terrainBias === 'ridge' && height > .11) color.lerp(new THREE.Color('#B7B09E'), .58);
    if (!ice && region.terrainBias === 'terraces' && coast > .32) color.lerp(new THREE.Color('#C8BBAF'), .55);
    if (region.id === 'growth') color.lerp(new THREE.Color(center[1] > .4 ? '#93A883' : '#D8D4C3'), .45);
    color.multiplyScalar(.94 + .08 * (Math.sin(center[0] * 87 + center[1] * 43) * .5 + .5));
    const source = [a, b, c];
    const points = source.map(p => localSurface(p, scale, region, piece));
    if (new THREE.Vector3().subVectors(points[1], points[0]).cross(new THREE.Vector3().subVectors(points[2], points[0])).dot(points[0]) < 0) { points.reverse(); source.reverse(); }
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const vertexColor = color.clone();
      if (!ice) vertexColor.lerp(coastColor, 1 - THREE.MathUtils.smoothstep(coastDistance(source[i], shape), 0, .045));
      positions.push(p.x, p.y, p.z); colors.push(vertexColor.r, vertexColor.g, vertexColor.b);
    }
  }
  const depth = piece.surfaceShare > .01 ? 3 : 2;
  for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(shape.map(p => new THREE.Vector2(...p)), [])) triangle(shape[a], shape[b], shape[c], depth);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}
