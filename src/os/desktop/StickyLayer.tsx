import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { NotebookPen, X } from "lucide-react";
import { noteDelete, noteList, noteUpdate } from "../../lib/ipc";
import type { Note } from "../../lib/ipc";
import "./sticky.css";

export const STICKY_COLORS = ["louro", "rosa", "menta", "ceu", "lavanda"] as const;

const MENUBAR_H = 30;

function Sticky({
  note,
  onChanged,
}: {
  note: Note;
  onChanged: () => void;
}) {
  const [content, setContent] = useState(note.content);
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startX: number; startY: number; x: number; y: number } | null>(null);
  const saveTimer = useRef<number | undefined>(undefined);

  // Autosave do texto (debounce 600ms) — nota de estudo não pode se perder.
  useEffect(() => {
    window.clearTimeout(saveTimer.current);
    if (content === note.content) return;
    saveTimer.current = window.setTimeout(() => {
      void noteUpdate({ ...note, content }).catch(() => {});
    }, 600);
    return () => window.clearTimeout(saveTimer.current);
  }, [content, note]);

  function beginDrag(e: ReactPointerEvent) {
    drag.current = { startX: e.clientX, startY: e.clientY, x: note.x, y: note.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function moveDrag(e: ReactPointerEvent) {
    const d = drag.current;
    const el = ref.current;
    if (!d || !el) return;
    el.style.transform = `translate3d(${e.clientX - d.startX}px, ${e.clientY - d.startY}px, 0)`;
  }
  function endDrag(e: ReactPointerEvent) {
    const d = drag.current;
    const el = ref.current;
    drag.current = null;
    if (!d || !el) return;
    el.style.transform = "";
    const x = Math.max(0, d.x + (e.clientX - d.startX));
    const y = Math.max(MENUBAR_H, d.y + (e.clientY - d.startY));
    void noteUpdate({ ...note, content, x, y })
      .then(onChanged)
      .catch(() => {});
  }

  function setColor(color: string) {
    void noteUpdate({ ...note, content, color }).then(onChanged).catch(() => {});
  }

  function dismiss() {
    // Sai do desktop mas continua no app Notas.
    void noteUpdate({ ...note, content, on_desktop: false })
      .then(onChanged)
      .catch(() => {});
  }

  function removeIfEmpty() {
    if (!content.trim()) {
      void noteDelete(note.id).then(onChanged).catch(() => {});
    } else {
      dismiss();
    }
  }

  return (
    <div
      ref={ref}
      className={`sticky sticky--${note.color}`}
      style={{ left: note.x, top: note.y }}
    >
      <div
        className="sticky__bar"
        onPointerDown={beginDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
      >
        <span className="sticky__topic" title={note.topic}>
          {note.topic}
        </span>
        <span className="sticky__dots">
          {STICKY_COLORS.map((c) => (
            <button
              key={c}
              className={`sticky__dot sticky__dot--${c} ${note.color === c ? "sticky__dot--on" : ""}`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setColor(c)}
              aria-label={`Cor ${c}`}
            />
          ))}
        </span>
        <button
          className="sticky__close"
          title="Guardar no app Notas"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={removeIfEmpty}
        >
          <X size={12} />
        </button>
      </div>
      <textarea
        className="sticky__text"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Anota aí…"
        maxLength={4000}
        autoFocus={!note.content}
      />
    </div>
  );
}

/** Post-its soltos na área de trabalho. */
function StickyLayer() {
  const [notes, setNotes] = useState<Note[]>([]);

  const reload = useCallback(() => {
    noteList(null, true)
      .then(setNotes)
      .catch(() => {});
  }, []);

  useEffect(() => {
    reload();
    window.addEventListener("olimpo:notes-changed", reload);
    return () => window.removeEventListener("olimpo:notes-changed", reload);
  }, [reload]);

  return (
    <div className="sticky-layer">
      {notes.map((note) => (
        <Sticky key={note.id} note={note} onChanged={reload} />
      ))}
    </div>
  );
}

export default StickyLayer;

export function stickyIcon(size = 15) {
  return <NotebookPen size={size} strokeWidth={1.8} />;
}
