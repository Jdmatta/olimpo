import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  ChevronRight,
  File,
  FilePlus2,
  Folder,
  FolderPlus,
  RefreshCw,
} from "lucide-react";
import {
  fsCreateDir,
  fsCreateFile,
  fsDelete,
  fsList,
  fsMove,
  fsOpenInVsCode,
  fsRename,
  fsRevealInExplorer,
  fsRoots,
} from "../../lib/ipc";
import type { FsEntry, FsListing, FsRoot } from "../../lib/ipc";
import { useWindowContext } from "../../os/window-manager/context";
import { useWindowStore } from "../../os/window-manager/store";
import { crumbsFor, formatModified, formatSize } from "./pathUtils";
import "./files.css";

interface MenuState {
  x: number;
  y: number;
  entry: FsEntry | null;
}

interface IpcError {
  code?: string;
  message?: string;
}

function errText(err: unknown): string {
  const e = err as IpcError;
  return e?.message ?? String(err);
}

function FileExplorer() {
  const { isFocused } = useWindowContext();
  const openWindow = useWindowStore((s) => s.open);

  const [listing, setListing] = useState<FsListing | null>(null);
  const [roots, setRoots] = useState<FsRoot[]>([]);
  const [rootPath, setRootPath] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<FsEntry | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (path?: string) => {
    try {
      const result = await fsList(path);
      setListing(result);
      setError(null);
    } catch (err) {
      setError(errText(err));
    }
  }, []);

  const refresh = useCallback(() => {
    if (listing) void load(listing.path);
  }, [listing, load]);

  useEffect(() => {
    fsRoots()
      .then((rs) => {
        setRoots(rs);
        if (rs.length > 0) {
          setRootPath(rs[0].path);
          void load(rs[0].path);
        }
      })
      .catch((err) => setError(errText(err)));
  }, [load]);

  function switchRoot(root: FsRoot) {
    setRootPath(root.path);
    setSelected(null);
    void load(root.path);
  }

  // Revalida quando a janela ganha foco (substitui watcher no v1).
  const wasFocused = useRef(isFocused);
  useEffect(() => {
    if (isFocused && !wasFocused.current) refresh();
    wasFocused.current = isFocused;
  }, [isFocused, refresh]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!isFocused) return;
      if (e.key === "F5") {
        e.preventDefault();
        refresh();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isFocused, refresh]);

  const entries = listing?.entries ?? [];
  const currentPath = listing?.path ?? "";
  const atRoot = rootPath !== null && currentPath === rootPath;
  const selectedEntry = entries.find((e) => e.path === selected) ?? null;

  async function run(op: () => Promise<unknown>) {
    try {
      await op();
      setError(null);
      await load(currentPath);
    } catch (err) {
      setError(errText(err));
    }
  }

  function goUp() {
    if (atRoot || !currentPath) return;
    const parent = currentPath.slice(0, currentPath.lastIndexOf("\\"));
    void load(parent.length >= (rootPath?.length ?? 0) ? parent : rootPath!);
  }

  function openEntry(entry: FsEntry) {
    if (entry.is_dir) {
      void load(entry.path);
    } else {
      void run(() => fsOpenInVsCode(entry.path));
    }
  }

  function startCreate(kind: "dir" | "file") {
    const base = kind === "dir" ? "Nova pasta" : "novo-arquivo.txt";
    let name = base;
    let n = 2;
    while (entries.some((e) => e.name.toLowerCase() === name.toLowerCase())) {
      name = kind === "dir" ? `${base} ${n}` : `novo-arquivo-${n}.txt`;
      n += 1;
    }
    const create = kind === "dir" ? fsCreateDir : fsCreateFile;
    void run(async () => {
      const created = await create(currentPath, name);
      setSelected(created.path);
      setRenaming(created.path);
    });
  }

  function commitRename(entry: FsEntry, newName: string) {
    setRenaming(null);
    const trimmed = newName.trim();
    if (!trimmed || trimmed === entry.name) return;
    void run(async () => {
      const renamed = await fsRename(entry.path, trimmed);
      setSelected(renamed.path);
    });
  }

  function onRowKeyDown(e: React.KeyboardEvent) {
    if (renaming) return;
    if (e.key === "F2" && selectedEntry) {
      e.preventDefault();
      setRenaming(selectedEntry.path);
    } else if (e.key === "Delete" && selectedEntry) {
      e.preventDefault();
      setConfirmDelete(selectedEntry);
    } else if (e.key === "Enter" && selectedEntry) {
      e.preventDefault();
      openEntry(selectedEntry);
    }
  }

  function onDropInto(target: FsEntry, e: React.DragEvent) {
    e.preventDefault();
    setDropTarget(null);
    const source = e.dataTransfer.getData("application/x-olimpo-path");
    if (!source || !target.is_dir || source === target.path) return;
    void run(() => fsMove(source, target.path));
  }

  const crumbs = rootPath && currentPath ? crumbsFor(rootPath, currentPath) : [];

  return (
    <div
      className="files-app"
      tabIndex={0}
      onKeyDown={onRowKeyDown}
      onClickCapture={(e) => {
        // Clique em linha não foca o container sozinho; F2/Del dependem disso.
        if (!renaming) (e.currentTarget as HTMLElement).focus();
      }}
      onClick={() => setMenu(null)}
      onContextMenu={(e) => {
        // Menu da área vazia (criar itens).
        if ((e.target as HTMLElement).closest(".files-row")) return;
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY, entry: null });
      }}
    >
      <div className="files-body-wrap">
      <aside className="files-sidebar">
        {roots.map((root) => (
          <button
            key={root.path}
            className={`files-root ${rootPath === root.path ? "files-root--on" : ""}`}
            onClick={() => switchRoot(root)}
            title={root.path}
          >
            <Folder size={14} />
            <span>{root.label}</span>
          </button>
        ))}
      </aside>
      <div className="files-main">
      <div className="files-toolbar">
        <button
          className="files-tool"
          onClick={goUp}
          disabled={atRoot}
          title="Subir um nível"
        >
          <ArrowUp size={15} />
        </button>
        <nav className="files-crumbs">
          {crumbs.map((crumb, i) => (
            <span key={crumb.path} className="files-crumb-wrap">
              {i > 0 && <ChevronRight size={12} className="files-crumb-sep" />}
              <button
                className={`files-crumb ${i === crumbs.length - 1 ? "files-crumb--current" : ""}`}
                onClick={() => void load(crumb.path)}
              >
                {crumb.label}
              </button>
            </span>
          ))}
        </nav>
        <div className="files-toolbar-actions">
          <button
            className="files-tool"
            onClick={() => startCreate("dir")}
            title="Nova pasta"
          >
            <FolderPlus size={15} />
          </button>
          <button
            className="files-tool"
            onClick={() => startCreate("file")}
            title="Novo arquivo"
          >
            <FilePlus2 size={15} />
          </button>
          <button className="files-tool" onClick={refresh} title="Atualizar (F5)">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {error && (
        <div className="files-error" role="alert">
          {error}
        </div>
      )}

      <div className="files-list" ref={listRef}>
        <div className="files-head">
          <span>Nome</span>
          <span>Modificado</span>
          <span>Tamanho</span>
        </div>
        {entries.map((entry) => (
          <div
            key={entry.path}
            className={`files-row ${selected === entry.path ? "files-row--selected" : ""} ${dropTarget === entry.path ? "files-row--drop" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              setSelected(entry.path);
              setMenu(null);
            }}
            onDoubleClick={() => openEntry(entry)}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setSelected(entry.path);
              setMenu({ x: e.clientX, y: e.clientY, entry });
            }}
            draggable={renaming !== entry.path}
            onDragStart={(e) => {
              e.dataTransfer.setData("application/x-olimpo-path", entry.path);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              if (entry.is_dir) {
                e.preventDefault();
                setDropTarget(entry.path);
              }
            }}
            onDragLeave={() => setDropTarget((t) => (t === entry.path ? null : t))}
            onDrop={(e) => onDropInto(entry, e)}
          >
            <span className="files-name">
              {entry.is_dir ? (
                <Folder size={16} className="files-icon files-icon--dir" />
              ) : (
                <File size={16} className="files-icon" />
              )}
              {renaming === entry.path ? (
                <input
                  className="files-rename"
                  defaultValue={entry.name}
                  autoFocus
                  onFocus={(e) => e.target.select()}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") {
                      commitRename(entry, (e.target as HTMLInputElement).value);
                    } else if (e.key === "Escape") {
                      setRenaming(null);
                    }
                  }}
                  onBlur={(e) => commitRename(entry, e.target.value)}
                />
              ) : (
                <span className="files-label">{entry.name}</span>
              )}
            </span>
            <span className="files-meta">{formatModified(entry.modified_ms)}</span>
            <span className="files-meta">{formatSize(entry.size, entry.is_dir)}</span>
          </div>
        ))}
        {entries.length === 0 && !error && (
          <div className="files-empty">Pasta vazia</div>
        )}
      </div>
      </div>
      </div>

      {menu && (
        <div
          className="files-menu glass-strong"
          style={{ left: menu.x, top: menu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {menu.entry ? (
            <>
              <button
                className="files-menu-item"
                onClick={() => {
                  openEntry(menu.entry!);
                  setMenu(null);
                }}
              >
                Abrir
              </button>
              <button
                className="files-menu-item"
                onClick={() => {
                  void run(() => fsOpenInVsCode(menu.entry!.path));
                  setMenu(null);
                }}
              >
                Abrir no VS Code
              </button>
              {menu.entry.is_dir && (
                <button
                  className="files-menu-item"
                  onClick={() => {
                    openWindow("terminal", { cwd: menu.entry!.path });
                    setMenu(null);
                  }}
                >
                  Abrir Terminal aqui
                </button>
              )}
              <button
                className="files-menu-item"
                onClick={() => {
                  void run(() => fsRevealInExplorer(menu.entry!.path));
                  setMenu(null);
                }}
              >
                Revelar no Explorer
              </button>
              <div className="files-menu-sep" />
              <button
                className="files-menu-item"
                onClick={() => {
                  setRenaming(menu.entry!.path);
                  setMenu(null);
                }}
              >
                Renomear (F2)
              </button>
              <button
                className="files-menu-item files-menu-item--danger"
                onClick={() => {
                  setConfirmDelete(menu.entry);
                  setMenu(null);
                }}
              >
                Mover para a Lixeira (Del)
              </button>
            </>
          ) : (
            <>
              <button
                className="files-menu-item"
                onClick={() => {
                  startCreate("dir");
                  setMenu(null);
                }}
              >
                Nova pasta
              </button>
              <button
                className="files-menu-item"
                onClick={() => {
                  startCreate("file");
                  setMenu(null);
                }}
              >
                Novo arquivo
              </button>
              <button
                className="files-menu-item"
                onClick={() => {
                  openWindow("terminal", { cwd: currentPath });
                  setMenu(null);
                }}
              >
                Abrir Terminal aqui
              </button>
            </>
          )}
        </div>
      )}

      {confirmDelete && (
        <div className="files-confirm-backdrop" onClick={() => setConfirmDelete(null)}>
          <div className="files-confirm glass-strong" onClick={(e) => e.stopPropagation()}>
            <p>
              Mover <strong>{confirmDelete.name}</strong> para a Lixeira?
            </p>
            <div className="files-confirm-actions">
              <button className="files-btn" onClick={() => setConfirmDelete(null)}>
                Cancelar
              </button>
              <button
                className="files-btn files-btn--danger"
                onClick={() => {
                  const target = confirmDelete;
                  setConfirmDelete(null);
                  setSelected(null);
                  void run(() => fsDelete(target.path));
                }}
              >
                Mover para a Lixeira
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FileExplorer;
