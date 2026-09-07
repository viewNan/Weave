<<<<<<< HEAD
"use client";

import { useMemo, useState } from "react";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Archive, ChevronDown, File, FileText, Folder, LayoutDashboard, MoreHorizontal, Plus, Search, Settings2, Sparkles, Upload, X } from "lucide-react";

type Doc = { id: string; name: string; type: string; project: string; version: number; updated: string; size: string; status: string };
const docs: Doc[] = [
  { id: "1", name: "Personal Knowledge & Agent Platform.md", type: "Markdown", project: "Personal AI", version: 3, updated: "Today, 14:32", size: "42 KB", status: "Ready" },
  { id: "2", name: "Research notes — cosmic rays.pdf", type: "PDF", project: "Research", version: 2, updated: "Yesterday", size: "2.4 MB", status: "Ready" },
  { id: "3", name: "Job hunting tracker.xlsx", type: "Excel", project: "Job Hunting", version: 1, updated: "Aug 28", size: "18 KB", status: "Ready" },
  { id: "4", name: "Japanese practice.docx", type: "Word", project: "Japanese Practice", version: 4, updated: "Aug 26", size: "96 KB", status: "Ready" },
];
const columnHelper = createColumnHelper<Doc>();

export default function Home() {
  const [active, setActive] = useState("Files");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Doc | null>(null);
  const filtered = useMemo(() => docs.filter((doc) => `${doc.name} ${doc.project}`.toLowerCase().includes(query.toLowerCase())), [query]);
  const columns = [
    columnHelper.accessor("name", { header: "Name", cell: (info) => <button className="file-name" onClick={() => setSelected(info.row.original)}><span className="file-icon"><FileText size={16} /></span>{info.getValue()}</button> }),
    columnHelper.accessor("project", { header: "Project", cell: (info) => <span className="muted">{info.getValue()}</span> }),
    columnHelper.accessor("version", { header: "Version", cell: (info) => <span className="version">v{info.getValue()}</span> }),
    columnHelper.accessor("updated", { header: "Last updated", cell: (info) => <span className="muted">{info.getValue()}</span> }),
    columnHelper.accessor("size", { header: "Size", cell: (info) => <span className="muted">{info.getValue()}</span> }),
  ];
  const table = useReactTable({ data: filtered, columns, getCoreRowModel: getCoreRowModel() });
  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">W</span><span>Weave</span><ChevronDown size={14} className="brand-chevron" /></div>
      <div className="workspace-switch"><span className="avatar">N</span><span><b>Nan's workspace</b><small>Personal</small></span><ChevronDown size={14} /></div>
      <nav className="nav-group">
        <p className="nav-label">Workspace</p>
        {[[LayoutDashboard, "Dashboard"], [Folder, "Projects"], [File, "Files"]].map(([Icon, label]) => <button key={label as string} className={`nav-item ${active === label ? "active" : ""}`} onClick={() => setActive(label as string)}><Icon size={17} />{label as string}</button>)}
        <button className={`nav-item ${active === "Search" ? "active" : ""}`} onClick={() => setActive("Search")}><Search size={17} />Search<span className="shortcut">⌘ K</span></button>
      </nav>
      <div className="sidebar-bottom"><button className="nav-item"><Archive size={17} />Archive</button><button className="nav-item"><Settings2 size={17} />Settings</button><div className="profile"><span className="avatar">N</span><span><b>Nan</b><small>Personal account</small></span><MoreHorizontal size={17} /></div></div>
    </aside>
    <section className="content">
      <header className="topbar"><div className="breadcrumbs"><span>Workspace</span><span>/</span><b>{active}</b></div><div className="top-actions"><button className="icon-button"><Search size={18} /></button><button className="icon-button"><span className="help">?</span></button><button className="primary small"><Sparkles size={15} /> Ask Weave</button></div></header>
      <div className="page-content">
        <div className="page-heading"><div><p className="eyebrow">PERSONAL WORKSPACE</p><h1>{active}</h1><p className="subtitle">Your knowledge, organized and ready to search.</p></div><button className="primary"><Upload size={17} /> Upload files</button></div>
        <div className="stats"><div><span className="stat-label">Total files</span><b>24</b><span className="stat-note">Across 4 projects</span></div><div><span className="stat-label">Storage used</span><b>186 MB</b><span className="stat-note">of 5 GB available</span></div><div><span className="stat-label">Searchable content</span><b>18</b><span className="stat-note green">● All systems ready</span></div></div>
        <div className="toolbar"><div className="search-box"><Search size={17} /><input placeholder="Search files..." value={query} onChange={(e) => setQuery(e.target.value)} />{query && <button onClick={() => setQuery("")}><X size={15} /></button>}<span className="search-key">⌘ K</span></div><div className="toolbar-right"><button className="filter-button">All projects <ChevronDown size={15} /></button><button className="filter-button">Recently updated <ChevronDown size={15} /></button></div></div>
        <div className="table-card"><div className="table-title"><div><h2>All files</h2><span>{filtered.length} documents</span></div><button className="icon-button"><MoreHorizontal size={18} /></button></div><table><thead>{table.getHeaderGroups().map((group) => <tr key={group.id}>{group.headers.map((header) => <th key={header.id}>{flexRender(header.column.columnDef.header, header.getContext())}</th>)}</tr>)}</thead><tbody>{table.getRowModel().rows.map((row) => <tr key={row.id}>{row.getVisibleCells().map((cell) => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}</tbody></table>{filtered.length === 0 && <div className="empty">No files match your search.</div>}</div>
        <p className="footer-note"><Sparkles size={14} /> Files are stored locally. Search indexing will be available after processing.</p>
      </div>
    </section>
    {selected && <div className="detail-overlay" onClick={() => setSelected(null)}><aside className="detail-panel" onClick={(e) => e.stopPropagation()}><button className="close" onClick={() => setSelected(null)}><X size={18} /></button><div className="detail-file-icon"><FileText size={24} /></div><p className="eyebrow">DOCUMENT</p><h2>{selected.name}</h2><p className="muted">{selected.type} · {selected.size}</p><div className="detail-divider" /><div className="detail-row"><span>Project</span><b>{selected.project}</b></div><div className="detail-row"><span>Current version</span><b>v{selected.version}</b></div><div className="detail-row"><span>Last updated</span><b>{selected.updated}</b></div><div className="detail-divider" /><h3>Version history</h3>{Array.from({ length: selected.version }, (_, i) => <div className="version-row" key={i}><span className="version">v{selected.version - i}</span><span>{i === 0 ? "Current version" : `Previous version ${selected.version - i}`}</span><MoreHorizontal size={15} /></div>)}<button className="secondary full"><Upload size={16} /> Upload new version</button></aside></div>}
  </main>;
}
=======
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


>>>>>>> 55d54c0 (created react threejs earth model on homepage)
