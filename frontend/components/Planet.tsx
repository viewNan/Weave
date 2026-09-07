'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Component, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import * as THREE from 'three';
import { regions, landmasses, type Landmass, type Region } from '../lib/world';
import { createLandGeometry, landScale, orientation } from '../lib/terrain';
import Landmarks from './Landmarks';

function Land({ piece, region, active, onHover }: { piece: Landmass; region: Region; active: boolean; onHover: (id: string | null) => void }) {
  const scale = useMemo(() => landScale(piece), [piece]);
  const geometry = useMemo(() => createLandGeometry(piece, region, scale), [piece, region, scale]);
  const quaternion = useMemo(() => orientation(piece), [piece]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const group = useRef<THREE.Group>(null);
  useFrame((_, delta) => { if (group.current) group.current.scale.setScalar(THREE.MathUtils.damp(group.current.scale.x, active ? 1.009 : 1, 9, delta)); });
  return <group ref={group} quaternion={quaternion} onPointerOver={e => { e.stopPropagation(); onHover(region.id); }} onPointerOut={() => onHover(null)}>
    <mesh geometry={geometry}><meshStandardMaterial vertexColors flatShading roughness={1} emissive={active ? '#a9bc91' : '#000000'} emissiveIntensity={.13} /></mesh>
    <Landmarks piece={piece} region={region} scale={scale} />
  </group>;
}

class SceneBoundary extends Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="scene-fallback">Your world needs WebGL to come alive.<br />Try a browser with hardware acceleration enabled.</div> : this.props.children; }
}

export default function Planet({ paused, active, onHover, reset }: { paused: boolean; active: string | null; onHover: (id: string | null) => void; reset: number }) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  useEffect(() => { controls.current?.reset(); }, [reset]);
  const [inside, setInside] = useState(false);
  const [resting, setResting] = useState(true);
  const dragging = useRef(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restAfterInteraction = () => {
    setResting(false);
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = setTimeout(() => setResting(true), 2200);
  };
  useEffect(() => () => { if (timeout.current) clearTimeout(timeout.current); }, []);
  return <div className={`planet-canvas ${active ? 'is-hovered' : ''}`} onPointerEnter={() => setInside(true)} onPointerLeave={() => { setInside(false); onHover(null); restAfterInteraction(); }}>
    <SceneBoundary><Canvas dpr={[1, 1.5]} camera={{ position: [0, 2.4, 8.3], fov: 42 }} fallback={<div className="scene-fallback">3D is unavailable in this browser.</div>}>
      <hemisphereLight args={['#fffaf3', '#b0c4c2', 2.1]} />
      <directionalLight position={[-3, 6, 7]} intensity={2} />
      <group rotation={[0, 0, -.12]}>
        <mesh><icosahedronGeometry args={[2.5, 5]} /><meshStandardMaterial color="#8EC8D2" flatShading roughness={1} /></mesh>
        {landmasses.map(piece => <Land key={piece.id} piece={piece} region={regions.find(r => r.id === piece.regionId)!} active={active === piece.regionId} onHover={id => { if (!dragging.current) onHover(id); }} />)}
      </group>
      <OrbitControls ref={controls} enablePan={false} enableZoom={false} enableDamping dampingFactor={.06} rotateSpeed={.55} autoRotate={!paused && !inside && !active && resting} autoRotateSpeed={.32}
        onStart={() => { dragging.current = true; setResting(false); onHover(null); if (timeout.current) clearTimeout(timeout.current); }}
        onEnd={() => { dragging.current = false; onHover(null); restAfterInteraction(); }} />
    </Canvas></SceneBoundary>
  </div>;
}
