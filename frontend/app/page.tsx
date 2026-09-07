'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { regions, familiarityColors } from '../lib/world';

const Planet = dynamic(() => import('../components/Planet'), { ssr: false, loading: () => <div className="scene-fallback">Growing your little world…</div> });

export default function Home() {
  const [paused, setPaused] = useState(false), [active, setActive] = useState<string | null>(null), [reset, setReset] = useState(0);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setPaused(preference.matches);
    update(); preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);
  const region = regions.find(r => r.id === active);
  return <main>
    <header className="header"><a className="brand" href="#" aria-label="Weave home"><span className="brand-mark">w</span>weave<span className="brand-dot">.</span></a><span className="header-note">A SPACE TO GROW</span><span className="edition"><span /> Personal world <small>01</small></span></header>
    <section className="hero" aria-labelledby="hero-title">
      <div className="intro"><p className="eyebrow"><span /> YOUR MIND, A LITTLE WORLD</p><h1 id="hero-title">A world of<br />your <em>own.</em></h1><p className="description">Everything you learn, build, and remember.<br className="desktop-break" /> Connected in one little planet.<br />Always growing. Unmistakably you.</p><a className="explore" href="#regions">Explore my world <span>↗</span></a><p className="intro-footnote"><span className="tiny-orbit">✳</span> A little curiosity goes a long way.</p></div>
      <div className="world-stage" aria-label="Interactive personal planet">
        <div className="orbit orbit-one" /><div className="orbit orbit-two" /><span className="orbit-spark">✦</span><span className="orbit-dot" />
        <div className="world-caption"><span>THE PERSONAL PLANET</span><span>EST. 2026</span></div>
        <Planet paused={paused} active={active} onHover={setActive} reset={reset} />
        <div className="planet-shadow" />
        <div className={`region-label ${region ? 'visible' : ''}`} aria-live="polite">{region ? <><span className="label-dot" /><div><strong>{region.name}</strong><span>{region.description}</span><small>{region.id === 'exploration' ? 'Unexplored · Polar ice' : ['Undeveloped', 'Taking root', 'Familiar', 'Home ground'][region.defaultFamiliarity]}</small></div></> : null}</div>
        <div className="world-toolbar"><span className="drag-hint">↔ <span>Drag to wander · Hover to discover</span></span><div><button aria-label={paused ? 'Resume rotation' : 'Pause rotation'} aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? '▷' : 'Ⅱ'}</button><button aria-label="Reset planet view" onClick={() => setReset(reset + 1)}>↺</button></div></div>
      </div>
    </section>
    <section className="regions" id="regions" aria-labelledby="regions-heading"><div className="section-heading"><h2 id="regions-heading">Every part of you, a place.</h2><span>EIGHT REGIONS. A WORLD IN THE MAKING.</span></div><div className="region-grid">{regions.map((r, i) => <button key={r.id} className={`region-item ${active === r.id ? 'active' : ''}`} onMouseEnter={() => setActive(r.id)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(r.id)} onBlur={() => setActive(null)} onClick={() => setActive(r.id)} aria-pressed={active === r.id}><span className={`region-symbol symbol-${i}`}>{r.symbol}</span><span><strong>{r.name}</strong><small>{r.detail}</small></span><span className="region-number">0{i + 1}</span></button>)}</div><div className="world-legend"><span>FAMILIARITY</span><div>{familiarityColors.map((color, i) => <span key={color}><i style={{ background: color }} />{['Unexplored', 'Taking root', 'Familiar', 'Home ground'][i]}</span>)}</div><span>OCEAN 60% · LAND 32% · ICE 8%</span></div></section>
    <footer><span>A living collection of what makes you, you.</span><span><i /> GROW AT YOUR OWN PACE</span></footer>
  </main>;
}
