'use client';

import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { outlines, type Landmass, type Region, type Point } from '../lib/world';
import { localSurface, coastDistance, isInOutline } from '../lib/terrain';

function House({ workshop = false }: { workshop?: boolean }) {
  return <group>
    <mesh position={[0,.07,0]}><boxGeometry args={[.15,.14,.12]} /><meshStandardMaterial color="#F6E2D7" flatShading roughness={1} /></mesh>
    <mesh position={[0,.165,0]} rotation={[0,Math.PI / 4,0]}><coneGeometry args={[.125,.09,4]} /><meshStandardMaterial color={workshop ? '#718A66' : '#D99B76'} flatShading roughness={1} /></mesh>
    <mesh position={[0,.05,.061]}><boxGeometry args={[.035,.07,.006]} /><meshStandardMaterial color="#718A66" /></mesh>
    <mesh position={[.052,.09,.062]}><boxGeometry args={[.025,.026,.006]} /><meshStandardMaterial color="#FBF5F2" /></mesh>
  </group>;
}

function Landmark({ kind }: { kind: string }) {
  if (kind === 'observatory') return <group>
    <mesh position={[0,.025,0]}><cylinderGeometry args={[.23,.25,.05,8]} /><meshStandardMaterial color="#C8BBAF" flatShading /></mesh>
    <mesh position={[0,.15,0]}><cylinderGeometry args={[.16,.17,.22,8]} /><meshStandardMaterial color="#F6E2D7" flatShading /></mesh>
    <mesh position={[0,.26,0]}><sphereGeometry args={[.17,8,4,0,Math.PI*2,0,Math.PI/2]} /><meshStandardMaterial color="#718A66" flatShading /></mesh>
    <mesh position={[.075,.32,.05]} rotation={[0,0,-.65]}><cylinderGeometry args={[.035,.045,.25,6]} /><meshStandardMaterial color="#F6E2D7" flatShading /></mesh>
    <mesh position={[0,.12,.165]}><boxGeometry args={[.055,.1,.015]} /><meshStandardMaterial color="#758A85" /></mesh>
  </group>;
  if (kind === 'lighthouse' || kind === 'beacon') return <group scale={kind === 'beacon' ? .6 : 1}>
    <mesh position={[0,.17,0]}><cylinderGeometry args={[.055,.10,.34,6]} /><meshStandardMaterial color="#F6E2D7" flatShading /></mesh>
    <mesh position={[0,.35,0]}><cylinderGeometry args={[.078,.078,.07,6]} /><meshStandardMaterial color="#FF9558" flatShading /></mesh>
    <mesh position={[0,.415,0]}><coneGeometry args={[.10,.075,6]} /><meshStandardMaterial color="#718A66" flatShading /></mesh>
  </group>;
  if (kind === 'workshop' || kind === 'archive') return <group>
    <mesh position={[0,.11,0]}><boxGeometry args={[.34,.22,.24]} /><meshStandardMaterial color="#F6E2D7" flatShading /></mesh>
    <mesh position={[0,.24,0]}><boxGeometry args={[.38,.045,.28]} /><meshStandardMaterial color="#718A66" /></mesh>
    {[-.1,0,.1].map(x => <mesh key={x} position={[x,.12,.125]}><boxGeometry args={[.048,.095,.009]} /><meshStandardMaterial color="#85A9AB" /></mesh>)}
    {kind === 'workshop' && <mesh position={[.1,.32,-.07]}><boxGeometry args={[.065,.21,.07]} /><meshStandardMaterial color="#C8BBAF" /></mesh>}
  </group>;
  if (kind === 'camp') return <group>
    <mesh position={[0,.105,0]} rotation={[0,Math.PI/4,0]}><coneGeometry args={[.2,.21,4]} /><meshStandardMaterial color="#E8B68F" flatShading /></mesh>
    <mesh position={[0,.055,.141]}><circleGeometry args={[.048,3]} /><meshStandardMaterial color="#718A66" /></mesh>
  </group>;
  if (kind === 'mailbox') return <group>
    <mesh position={[0,.07,0]}><boxGeometry args={[.02,.14,.02]} /><meshStandardMaterial color="#B7B09E" /></mesh>
    <mesh position={[0,.145,0]}><boxGeometry args={[.07,.05,.05]} /><meshStandardMaterial color="#FF9558" /></mesh>
  </group>;
  return <group scale={1.6}><House /></group>;
}

function SurfaceObject({ point, piece, region, scale, children }: { point: Point; piece: Landmass; region: Region; scale: number; children: React.ReactNode }) {
  const position = localSurface(point, scale, region, piece, .008);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), position.clone().normalize());
  return <group position={position} quaternion={quaternion}>{children}</group>;
}

function Path({ target, piece, region, scale }: { target: Point; piece: Landmass; region: Region; scale: number }) {
  const geometry = useMemo(() => {
    const points = Array.from({length: 13}, (_, i) => {
      const t = i / 12;
      const bend = region.id === 'living' ? Math.sin(t * Math.PI) * .06 : 0;
      return localSurface([target[0] * t + bend, target[1] * t], scale, region, piece, .008);
    });
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 20, .012, 3, false);
  }, [target, piece, region, scale]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry}><meshStandardMaterial color="#F6E2D7" roughness={1} /></mesh>;
}

export default function Landmarks({ piece, region, scale }: { piece: Landmass; region: Region; scale: number }) {
  const locations = useMemo(() => {
    const shape = outlines[piece.shapeType];
    const points: Point[] = [];
    for (let i = 0; i < 80; i++) {
      const angle = i * 2.39996, radius = .30 + .38 * ((i % 11) / 10);
      const point: Point = [Math.cos(angle) * radius * (region.id === 'growth' ? .52 : 1), Math.sin(angle) * radius];
      if (isInOutline(point, shape) && coastDistance(point, shape) > .16 && !points.some(p => Math.hypot(p[0]-point[0],p[1]-point[1]) < .15)) points.push(point);
    }
    return points;
  }, [piece.shapeType, region.id]);
  const buildings = piece.main ? region.buildingCount : 0;
  const trees = piece.main ? region.treeCount : region.id === 'hobby' ? 2 : 0;
  const housePoints = locations.slice(0, Math.max(0, buildings - 1));
  const treePoints = locations.slice(housePoints.length, housePoints.length + trees);
  return <group>
    {piece.main && <SurfaceObject point={[0,0]} piece={piece} region={region} scale={scale}><Landmark kind={region.landmark} /></SurfaceObject>}
    {housePoints.map((p, i) => <group key={`house-${i}`}><Path target={p} piece={piece} region={region} scale={scale} /><SurfaceObject point={p} piece={piece} region={region} scale={scale}><group scale={.65}><House workshop={region.id === 'workbench'} /></group></SurfaceObject></group>)}
    {treePoints.map((p, i) => <SurfaceObject key={`tree-${i}`} point={p} piece={piece} region={region} scale={scale}><mesh position={[0,.072,0]}><coneGeometry args={[.055,.16,5]} /><meshStandardMaterial color={i % 3 ? '#718A66' : '#93A883'} flatShading /></mesh></SurfaceObject>)}
  </group>;
}
