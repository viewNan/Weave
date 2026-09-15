'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { regions } from '../lib/world';

const Planet = dynamic(() => import('../components/Planet'), {
  ssr: false,
  loading: () => <div className="scene-fallback">正在唤醒你的世界…</div>,
});

const sections = [
  { id: 'research', name: 'Research', icon: '☕', items: ['Papers', 'Experiments', 'Reading', 'Publications'] },
  { id: 'workbench', name: 'Workbench', icon: '▧', items: ['Projects', 'Experiments', 'Drafts'] },
  { id: 'living', name: 'Living', icon: '⌂', items: ['Daily life', 'Schedule', 'Notes'] },
  { id: 'growth', name: 'Growth', icon: '↟', items: ['Learning', 'Languages', 'Next steps'] },
  { id: 'hobby', name: 'Hobby Isles', icon: '⌁', items: ['Movement', 'Creative detours'] },
  { id: 'archive', name: 'Archive', icon: '▤', items: ['Memories', 'Collected things'] },
  { id: 'exploration', name: 'Exploration Ice', icon: '❄', items: ['Someday', 'Unexplored'] },
];

export default function Home() {
  const [paused, setPaused] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [expanded, setExpanded] = useState('research');
  const [reset, setReset] = useState(0);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setPaused(preference.matches);
    update();
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  const activeRegion = regions.find((region) => region.id === active);

  return (
    <main className="planet-home" id="planet">
      <header className="planet-header">
        <a className="planet-brand" href="/" aria-label="返回 Weave 世界">
          <span className="planet-brand-mark">W</span>
          <span>weave</span><b>.</b>
        </a>
        <div className="planet-tools">
          <a href="/files">文件库</a>
          <span className="planet-edition">PERSONAL WORLD <b>01</b></span>
        </div>
      </header>
      <a className="push-settings-entry" href="/push" aria-label="打开通知设置">通知设置</a>

      <section className="planet-stage" aria-label="个人世界地图">
        <aside className="world-menu" aria-label="世界区域导航">
          <div className="menu-heading">
            <span>CONTINENTS</span>
            <small>探索你的世界</small>
          </div>
          <div className="menu-sections">
            {sections.map((section) => {
              const open = expanded === section.id;
              return (
                <div className={`world-section ${open ? 'open' : ''}`} key={section.id}>
                  <button
                    className={`world-section-button ${active === section.id ? 'selected' : ''}`}
                    onClick={() => { setExpanded(open ? '' : section.id); setActive(section.id); }}
                    aria-expanded={open}
                  >
                    <span className="world-section-icon">{section.icon}</span>
                    <span>{section.name}</span>
                    <b>{open ? '⌃' : '›'}</b>
                  </button>
                  {open && (
                    <div className="world-submenu">
                      {section.items.map((item) => (
                        <a
                          className="world-subitem"
                          href={item === 'Papers' ? '/files' : '#planet'}
                          onClick={() => setActive(section.id)}
                          key={item}
                        >
                          <i />{item}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        <div className="planet-viewport">
          <div className="planet-stars" aria-hidden="true">✦　·　✧　　·　　 ✦　　 ·</div>
          <div className="planet-caption"><span>THE PERSONAL PLANET</span><span>EST. 2026</span></div>
          <div className="planet-compass" aria-label="方向罗盘"><b>N</b><span>✦</span><small>S</small></div>
          <Planet paused={paused} active={active} onHover={setActive} reset={reset} />
          {activeRegion && (
            <div className="planet-region-note" aria-live="polite">
              <span>{activeRegion.symbol}</span>
              <div><b>{activeRegion.name}</b><small>{activeRegion.description}</small></div>
            </div>
          )}
          <div className="planet-controls">
            <span>↔　拖动探索　·　悬停发现</span>
            <div>
              <button aria-label={paused ? '继续旋转' : '暂停旋转'} onClick={() => setPaused(!paused)}>{paused ? '▷' : 'Ⅱ'}</button>
              <button aria-label="重置地球视角" onClick={() => setReset(reset + 1)}>↺</button>
            </div>
          </div>
        </div>
      </section>

      <footer className="planet-footer"><span>一个由知识、计划和好奇心组成的小世界。</span><span>GROW AT YOUR OWN PACE　●</span></footer>
    </main>
  );
}
