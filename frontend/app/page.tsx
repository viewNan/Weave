'use client';
import { LanguageSwitcher, useLanguage } from '../shared/i18n/LanguageProvider';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { regions } from '../lib/world';

const Planet = dynamic(() => import('../components/Planet'), {
  ssr: false,
  loading: PlanetLoading,
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
  const { t } = useLanguage();

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
        <a className="planet-brand" href="/" aria-label={t("返回 Weave 世界")}>
          <span className="planet-brand-mark">W</span>
          <span>weave</span><b>.</b>
        </a>
        <div className="planet-tools">
          <LanguageSwitcher />
          <a href="/console/files">{t("文件库")}</a>
          <a href="/console/morning-brief">{t("晨报")}</a>
          <a className="push-settings-entry" href="/console/notifications" aria-label={t("打开通知设置")}>{t("通知设置")}</a>
          <span className="planet-edition">PERSONAL WORLD <b>01</b></span>
        </div>
      </header>

      <section className="planet-stage" aria-label={t("个人世界地图")}>
        <aside className="world-menu" aria-label={t("世界区域导航")}>
          <div className="menu-heading">
            <span>CONTINENTS</span>
            <small>{t("探索你的世界")}</small>
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
                    <span>{t(section.name)}</span>
                    <b>{open ? '⌃' : '›'}</b>
                  </button>
                  {open && (
                    <div className="world-submenu">
                      {section.items.map((item) => (
                        <a
                          className="world-subitem"
                          href={item === 'Papers' ? '/console/files' : '#planet'}
                          onClick={() => setActive(section.id)}
                          key={item}
                        >
                          <i />{t(item)}
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
          <div className="planet-compass" aria-label={t("方向罗盘")}><b>N</b><span>✦</span><small>S</small></div>
          <Planet paused={paused} active={active} onHover={setActive} reset={reset} />
          {activeRegion && (
            <div className="planet-region-note" aria-live="polite">
              <span>{activeRegion.symbol}</span>
              <div><b>{t(activeRegion.name)}</b><small>{t(activeRegion.description)}</small></div>
            </div>
          )}
          <div className="planet-controls">
            <span>{t("↔　拖动探索　·　悬停发现")}</span>
            <div>
              <button aria-label={paused ? t("继续旋转") : t("暂停旋转")} onClick={() => setPaused(!paused)}>{paused ? '▷' : 'Ⅱ'}</button>
              <button aria-label={t("重置地球视角")} onClick={() => setReset(reset + 1)}>↺</button>
            </div>
          </div>
        </div>
      </section>

      <footer className="planet-footer"><span>{t("一个由知识、计划和好奇心组成的小世界。")}</span><span>GROW AT YOUR OWN PACE　●</span></footer>
    </main>
  );
}

function PlanetLoading() {
  const { t } = useLanguage();
 return <div className="scene-fallback">{t("正在唤醒你的世界…")}</div>; }
