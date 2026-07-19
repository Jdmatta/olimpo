import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  Download,
  Layers,
  MonitorUp,
  Play,
  Trash2,
  X,
} from "lucide-react";
import {
  fsOpenInVsCode,
  noteDelete,
  noteList,
  noteReviewMark,
  noteTopics,
  noteUpdate,
  notesExport,
} from "../../lib/ipc";
import type { Note } from "../../lib/ipc";
import { STICKY_COLORS } from "../../os/desktop/StickyLayer";
import "./notes.css";

function notifyDesktop() {
  window.dispatchEvent(new Event("olimpo:notes-changed"));
}

function NoteCard({ note, onChanged }: { note: Note; onChanged: () => void }) {
  const [content, setContent] = useState(note.content);
  const [front, setFront] = useState(note.front);
  const [back, setBack] = useState(note.back);
  const isFlash = note.kind === "flash";

  function save(patch: Partial<Note>) {
    void noteUpdate({ ...note, content, front, back, ...patch })
      .then(() => {
        onChanged();
        notifyDesktop();
      })
      .catch(() => {});
  }

  return (
    <div className={`ncard ncard--${note.color}`}>
      <div className="ncard__bar">
        <span className="ncard__dots">
          {STICKY_COLORS.map((c) => (
            <button
              key={c}
              className={`sticky__dot sticky__dot--${c} ${note.color === c ? "sticky__dot--on" : ""}`}
              onClick={() => save({ color: c })}
              aria-label={`Cor ${c}`}
            />
          ))}
        </span>
        <button
          className="ncard__tool"
          title={isFlash ? "Voltar para nota" : "Virar flashcard"}
          onClick={() =>
            save({
              kind: isFlash ? "note" : "flash",
              front: isFlash ? front : front || (content.split("\n")[0] ?? ""),
              back: isFlash ? back : back || content,
            })
          }
        >
          <Layers size={13} />
        </button>
        <button
          className="ncard__tool"
          title={note.on_desktop ? "Tirar do desktop" : "Mandar pro desktop"}
          onClick={() => save({ on_desktop: !note.on_desktop })}
        >
          <MonitorUp size={13} className={note.on_desktop ? "ncard__ondesk" : ""} />
        </button>
        <button
          className="ncard__tool ncard__tool--danger"
          title="Excluir"
          onClick={() =>
            void noteDelete(note.id).then(() => {
              onChanged();
              notifyDesktop();
            })
          }
        >
          <Trash2 size={13} />
        </button>
      </div>
      {isFlash ? (
        <div className="ncard__flash">
          <input
            value={front}
            onChange={(e) => setFront(e.target.value)}
            onBlur={() => save({})}
            placeholder="Pergunta (frente)"
            maxLength={4000}
          />
          <textarea
            value={back}
            onChange={(e) => setBack(e.target.value)}
            onBlur={() => save({})}
            placeholder="Resposta (verso)"
            maxLength={4000}
          />
        </div>
      ) : (
        <textarea
          className="ncard__text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onBlur={() => save({})}
          placeholder="Nota…"
          maxLength={4000}
        />
      )}
    </div>
  );
}

function ReviewMode({
  cards,
  onDone,
}: {
  cards: Note[];
  onDone: () => void;
}) {
  const [order] = useState(() => [...cards].sort(() => Math.random() - 0.5));
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [score, setScore] = useState({ ok: 0, fail: 0 });

  const card = order[idx];
  if (!card) {
    return (
      <div className="review review--end">
        <span className="review__final">
          {score.ok} lembradas · {score.fail} pra revisar
        </span>
        <button className="review__btn" onClick={onDone}>
          Concluir
        </button>
      </div>
    );
  }

  function mark(ok: boolean) {
    void noteReviewMark(card.id, ok).catch(() => {});
    setScore((s) => (ok ? { ...s, ok: s.ok + 1 } : { ...s, fail: s.fail + 1 }));
    setFlipped(false);
    setIdx((i) => i + 1);
  }

  return (
    <div className="review">
      <span className="review__progress">
        {idx + 1} / {order.length}
      </span>
      <button className="review__card" onClick={() => setFlipped((f) => !f)}>
        <span className="review__side">{flipped ? "resposta" : "pergunta"}</span>
        <span className="review__content">
          {flipped ? card.back || "—" : card.front || "—"}
        </span>
        {!flipped && <span className="review__hint">clique pra virar</span>}
      </button>
      {flipped && (
        <div className="review__actions">
          <button className="review__btn review__btn--fail" onClick={() => mark(false)}>
            <X size={14} /> Não lembrei
          </button>
          <button className="review__btn review__btn--ok" onClick={() => mark(true)}>
            <Check size={14} /> Lembrei
          </button>
        </div>
      )}
    </div>
  );
}

function NotesApp() {
  const [topics, setTopics] = useState<string[]>([]);
  const [topic, setTopic] = useState<string | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [reviewing, setReviewing] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  const reloadTopics = useCallback(() => {
    noteTopics()
      .then((ts) => {
        setTopics(ts);
        setTopic((t) => t ?? ts[0] ?? null);
      })
      .catch(() => {});
  }, []);

  const reloadNotes = useCallback(() => {
    if (!topic) {
      setNotes([]);
      return;
    }
    noteList(topic, false)
      .then(setNotes)
      .catch(() => {});
  }, [topic]);

  useEffect(reloadTopics, [reloadTopics]);
  useEffect(reloadNotes, [reloadNotes]);
  useEffect(() => {
    const fn = () => {
      reloadTopics();
      reloadNotes();
    };
    window.addEventListener("olimpo:notes-changed", fn);
    return () => window.removeEventListener("olimpo:notes-changed", fn);
  }, [reloadTopics, reloadNotes]);

  const flashcards = useMemo(() => notes.filter((n) => n.kind === "flash"), [notes]);

  async function exportTopic() {
    if (!topic) return;
    try {
      const path = await notesExport(topic);
      setExportMsg(path);
    } catch (err) {
      setExportMsg(`erro: ${String((err as { message?: string })?.message ?? err)}`);
    }
  }

  return (
    <div className="notes-app">
      <aside className="notes-topics">
        {topics.map((t) => (
          <button
            key={t}
            className={`notes-topic ${topic === t ? "notes-topic--on" : ""}`}
            onClick={() => {
              setTopic(t);
              setReviewing(false);
              setExportMsg(null);
            }}
          >
            {t}
          </button>
        ))}
        {topics.length === 0 && (
          <p className="notes-empty">
            Sem notas ainda — cria um post-it pelo menubar ou Ctrl+Space →
            "Nova nota".
          </p>
        )}
      </aside>

      <section className="notes-main">
        {topic && (
          <header className="notes-head">
            <h2>{topic}</h2>
            <span className="notes-count">
              {notes.length} nota{notes.length !== 1 ? "s" : ""} ·{" "}
              {flashcards.length} flashcard{flashcards.length !== 1 ? "s" : ""}
            </span>
            <button
              className="notes-btn"
              disabled={flashcards.length === 0}
              onClick={() => setReviewing((r) => !r)}
              title="Revisar flashcards"
            >
              <Play size={13} /> {reviewing ? "Sair da revisão" : "Revisar"}
            </button>
            <button className="notes-btn" onClick={() => void exportTopic()}>
              <Download size={13} /> Exportar resumo
            </button>
          </header>
        )}

        {exportMsg && (
          <div className="notes-export">
            {exportMsg.startsWith("erro") ? (
              exportMsg
            ) : (
              <>
                Salvo em <code>{exportMsg}</code>{" "}
                <button
                  className="notes-btn"
                  onClick={() => void fsOpenInVsCode(exportMsg).catch(() => {})}
                >
                  Abrir no VS Code
                </button>
              </>
            )}
          </div>
        )}

        {reviewing && flashcards.length > 0 ? (
          <ReviewMode cards={flashcards} onDone={() => setReviewing(false)} />
        ) : (
          <div className="notes-grid">
            {notes.map((note) => (
              <NoteCard key={note.id} note={note} onChanged={reloadNotes} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default NotesApp;
