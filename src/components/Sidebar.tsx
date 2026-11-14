"use client";

import { useState } from "react";
import { Feather, Search, Plus, Files, Star, Clock3, ChevronDown, ChevronRight, Folder, FolderOpen, FileText, Trash2, Settings2, ShieldCheck, ChevronsUpDown, PanelLeftClose, Check, Layers, Download, CircleHelp } from "lucide-react";
import type { Folder as FolderType, Note } from "@/lib/workspace";

type Props = {
  notes: Note[]; folders: FolderType[]; activeId: string; view: string; collapsed: boolean;
  workspace: string; onWorkspace: (workspace: string) => void;
  onView: (view: string) => void; onNote: (id: string) => void;
  onNew: () => void; onSearch: () => void; onFolder: () => void;
  onSettings: (tab?: string) => void; onCollapse: () => void; onExport: () => void;
};

export function Sidebar(props: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ personal: true, work: true, writing: true });
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const visibleNotes = props.notes.filter((note) => !note.deleted);
  const rootFolders = props.folders.filter((folder) => !folder.parentId && (props.workspace === "all" || folder.id === props.workspace));
  const inFolder = (id: string): boolean => props.folders.filter((folder) => folder.parentId === id).some((folder) => folder.id === props.activeId || inFolder(folder.id));
  const folderCount = (id: string) => visibleNotes.filter((note) => note.folderId === id || props.folders.some((folder) => folder.id === note.folderId && folder.parentId === id)).length;

  const noteRow = (note: Note, nested = false) => <button key={note.id} className={`note-row ${nested ? "nested-note" : ""} ${props.activeId === note.id && !note.deleted ? "selected" : ""}`} onClick={() => props.onNote(note.id)} title={note.title}>
    <FileText size={nested ? 12 : 14} /><span>{note.title || "Untitled note"}</span>{props.activeId === note.id && <i className="active-note-dot" />}
  </button>;

  const renderFolder = (folder: FolderType, depth = 0) => {
    const children = props.folders.filter((child) => child.parentId === folder.id);
    const open = expanded[folder.id];
    const selected = props.view === folder.id;
    const folderNotes = visibleNotes.filter((note) => note.folderId === folder.id);
    return <div className={`folder-branch ${depth ? "nested-branch" : ""}`} key={folder.id}>
      <div className={`folder-row ${selected ? "selected" : ""}`}>
        <button className="folder-chevron" onClick={() => setExpanded((previous) => ({ ...previous, [folder.id]: !open }))} aria-label={`${open ? "Collapse" : "Expand"} ${folder.name}`} aria-expanded={!!open}>{open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</button>
        <button className="folder-select" onClick={() => { props.onView(folder.id); setExpanded((previous) => ({ ...previous, [folder.id]: true })); }}>
          {open ? <FolderOpen size={16} className={`folder-icon ${folder.color}`} /> : <Folder size={16} className={`folder-icon ${folder.color}`} />}<span>{folder.name}</span><small>{folderCount(folder.id)}</small>
        </button>
      </div>
      {open && <div className="folder-children">{children.map((child) => renderFolder(child, depth + 1))}{folderNotes.map((note) => noteRow(note, true))}</div>}
    </div>;
  };

  const listView = ["all", "favorites", "recent", "trash"].includes(props.view);
  const listNotes = props.view === "trash" ? props.notes.filter((note) => note.deleted) : visibleNotes.filter((note) => props.view === "favorites" ? note.favorite : props.view === "all" ? props.workspace === "all" || note.folderId === props.workspace || inFolder(note.folderId || "") : true).sort((a, b) => props.view === "recent" ? b.lastOpenedAt.localeCompare(a.lastOpenedAt) : b.updatedAt.localeCompare(a.updatedAt));

  return <>
    <aside className={`sidebar ${props.collapsed ? "is-collapsed" : ""}`} aria-label="Workspace navigation">
      <div className="brand-row"><a className="brand" href="#" onClick={(event) => { event.preventDefault(); props.onView("writing"); }}><span className="brand-mark"><Feather size={22} strokeWidth={1.6} /></span><span>LiquidScribe<span className="brand-period">.</span></span></a><button className="icon-button collapse-sidebar" onClick={props.onCollapse} title="Collapse sidebar · ⌘\" aria-label="Collapse sidebar"><PanelLeftClose size={16} /></button></div>
      <div className="workspace-switcher-wrap">
        <button className="workspace-switcher" onClick={() => setWorkspaceOpen(!workspaceOpen)} aria-expanded={workspaceOpen}><span className="workspace-avatar"><Layers size={14} /></span><span>{props.workspace === "work" ? "Work workspace" : "Personal workspace"}</span><ChevronsUpDown size={13} /></button>
        {workspaceOpen && <><button className="popover-dismiss" aria-label="Close workspace menu" onClick={() => setWorkspaceOpen(false)} /><div className="popover workspace-popover"><span className="menu-eyebrow">YOUR WORKSPACES</span>{[["all", "Personal workspace"], ["work", "Work workspace"]].map(([id, label]) => <button key={id} onClick={() => { props.onWorkspace(id); setWorkspaceOpen(false); }}><Layers size={14} /><span>{label}</span>{props.workspace === id && <Check size={13} />}</button>)}</div></>}
      </div>
      <button className="sidebar-search" onClick={props.onSearch}><Search size={15} /><span>Search anything</span><kbd>⌘ K</kbd></button>
      <button className="new-note-button" onClick={props.onNew}><Plus size={17} /><span>New note</span><kbd>⌘ J</kbd></button>
      <div className="sidebar-scroll">
        <nav className="library-nav" aria-label="Notes">
          <button className={props.view === "all" ? "active" : ""} onClick={() => props.onView("all")}><Files size={16} /><span>All notes</span><small>{visibleNotes.length}</small></button>
          <button className={props.view === "favorites" ? "active" : ""} onClick={() => props.onView("favorites")}><Star size={16} /><span>Favorites</span><small>{visibleNotes.filter((note) => note.favorite).length}</small></button>
          <button className={props.view === "recent" ? "active" : ""} onClick={() => props.onView("recent")}><Clock3 size={16} /><span>Recent</span></button>
        </nav>
        <div className="sidebar-section-label"><span>{listView ? props.view === "all" ? "ALL NOTES" : props.view.toUpperCase() : "WORKSPACE"}</span>{!listView && <button className="icon-button" onClick={props.onFolder} title="New folder" aria-label="New folder"><Plus size={14} /></button>}</div>
        <div className="folder-tree">{listView ? listNotes.length ? listNotes.map((note) => noteRow(note)) : <div className="sidebar-empty">{props.view === "trash" ? <Trash2 size={20} /> : <Star size={20} />}<p>{props.view === "trash" ? "A clean slate." : "Nothing here just yet."}</p><span>{props.view === "trash" ? "Deleted notes will appear here." : "Your notes will find a home here."}</span></div> : rootFolders.map((folder) => renderFolder(folder))}</div>
      </div>
      <div className="sidebar-bottom">
        <button className={`trash-link ${props.view === "trash" ? "active" : ""}`} onClick={() => props.onView("trash")}><Trash2 size={15} /><span>Trash</span>{props.notes.some((note) => note.deleted) && <small>{props.notes.filter((note) => note.deleted).length}</small>}</button>
        <div className="privacy-card"><ShieldCheck size={18} strokeWidth={1.5} /><div><strong>A little space. All yours.</strong><p>Private by default. Local by design.</p></div></div>
        <button className="settings-link" onClick={() => props.onSettings("writing")}><Settings2 size={16} /><span>Settings & preferences</span></button>
      </div>
      <div className="profile-wrap"><button className="profile-button" onClick={() => setProfileOpen(!profileOpen)} aria-expanded={profileOpen}><span className="user-avatar">JD</span><span><strong>Jamie Davis</strong><small>Your personal space</small></span><ChevronsUpDown size={13} /></button>
        {profileOpen && <><button className="popover-dismiss" aria-label="Close profile menu" onClick={() => setProfileOpen(false)} /><div className="popover profile-popover"><span className="menu-eyebrow">YOUR LOCAL WORKSPACE</span><button onClick={() => { props.onExport(); setProfileOpen(false); }}><Download size={14} />Export all notes</button><button onClick={() => { props.onSettings("privacy"); setProfileOpen(false); }}><ShieldCheck size={14} />Data & privacy</button><button onClick={() => { props.onSettings("assistant"); setProfileOpen(false); }}><CircleHelp size={14} />Assistant setup</button></div></>}
      </div>
    </aside>
    {!props.collapsed && <button className="mobile-sidebar-backdrop" onClick={props.onCollapse} aria-label="Close navigation" />}
  </>;
}
