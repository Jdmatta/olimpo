import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Play, Square, Trash2 } from "lucide-react";
import {
  todoAdd,
  todoCarryOver,
  todoDelete,
  todoList,
  todoReorder,
  todoToggle,
  pomodoroHistory,
} from "../../lib/ipc";
import type { DayStat, Todo } from "../../lib/ipc";
import { formatRemaining, progress } from "../../os/focus/engine";
import { TECHNIQUES, useFocusStore } from "../../os/focus/focusStore";
import "./focus.css";

function localDay(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, [active]);
  return now;
}

const RING_RADIUS = 84;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

function TimerRing() {
  const session = useFocusStore((s) => s.session);
  const durations = useFocusStore((s) => s.durations);
  const start = useFocusStore((s) => s.start);
  const cancel = useFocusStore((s) => s.cancel);
  const now = useNow(session !== null);

  const pct = session ? progress(session, now) : 0;
  const label = session
    ? session.kind === "focus"
      ? "Foco"
      : "Pausa"
    : "Pronto";
  const time = session
    ? formatRemaining(session, now)
    : `${String(durations.focus).padStart(2, "0")}:00`;

  return (
    <div className="focus-ring-wrap">
      <svg className="focus-ring" viewBox="0 0 200 200">
        <circle className="focus-ring__track" cx="100" cy="100" r={RING_RADIUS} />
        <circle
          className={`focus-ring__bar ${session?.kind === "break" ? "focus-ring__bar--break" : ""}`}
          cx="100"
          cy="100"
          r={RING_RADIUS}
          strokeDasharray={RING_LENGTH}
          strokeDashoffset={RING_LENGTH * (1 - pct)}
        />
      </svg>
      <div className="focus-ring__center">
        <span className="focus-ring__phase">{label}</span>
        <span className="focus-ring__time">{time}</span>
        {session ? (
          <button className="focus-action focus-action--stop" onClick={() => void cancel()}>
            <Square size={12} /> Cancelar
          </button>
        ) : (
          <button className="focus-action" onClick={() => void start("focus")}>
            <Play size={13} /> Iniciar foco
          </button>
        )}
      </div>
    </div>
  );
}

function CycleDots() {
  const cycleCount = useFocusStore((s) => s.cycleCount);
  const filled = cycleCount % 4;
  return (
    <div
      className="focus-cycle"
      title={`${filled}/4 focos até a pausa longa`}
    >
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={`focus-cycle__dot ${i < filled ? "focus-cycle__dot--on" : ""}`}
        />
      ))}
    </div>
  );
}

function TechniqueChips() {
  const durations = useFocusStore((s) => s.durations);
  const setDurations = useFocusStore((s) => s.setDurations);
  const running = useFocusStore((s) => s.session !== null);

  return (
    <div className="focus-techniques">
      {TECHNIQUES.map((t) => {
        const active =
          durations.focus === t.durations.focus &&
          durations.break === t.durations.break;
        return (
          <button
            key={t.id}
            className={`focus-chip ${active ? "focus-chip--on" : ""}`}
            disabled={running}
            onClick={() => setDurations(t.durations)}
            title={`Foco ${t.durations.focus}m · pausa ${t.durations.break}m · longa ${t.durations.longBreak}m`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function DurationControls() {
  const durations = useFocusStore((s) => s.durations);
  const setDurations = useFocusStore((s) => s.setDurations);
  const immersive = useFocusStore((s) => s.immersive);
  const setImmersive = useFocusStore((s) => s.setImmersive);
  const running = useFocusStore((s) => s.session !== null);

  return (
    <div className="focus-config">
      <label className="focus-config__item">
        Foco
        <div className="focus-stepper">
          <button
            disabled={running}
            onClick={() => setDurations({ ...durations, focus: durations.focus - 5 })}
          >
            −
          </button>
          <span>{durations.focus}m</span>
          <button
            disabled={running}
            onClick={() => setDurations({ ...durations, focus: durations.focus + 5 })}
          >
            +
          </button>
        </div>
      </label>
      <label className="focus-config__item">
        Pausa
        <div className="focus-stepper">
          <button
            disabled={running}
            onClick={() => setDurations({ ...durations, break: durations.break - 1 })}
          >
            −
          </button>
          <span>{durations.break}m</span>
          <button
            disabled={running}
            onClick={() => setDurations({ ...durations, break: durations.break + 1 })}
          >
            +
          </button>
        </div>
      </label>
      <label className="focus-config__item">
        Longa
        <div className="focus-stepper">
          <button
            disabled={running}
            onClick={() =>
              setDurations({ ...durations, longBreak: durations.longBreak - 5 })
            }
          >
            −
          </button>
          <span>{durations.longBreak}m</span>
          <button
            disabled={running}
            onClick={() =>
              setDurations({ ...durations, longBreak: durations.longBreak + 5 })
            }
          >
            +
          </button>
        </div>
      </label>
      <label className="focus-config__item focus-config__item--switch">
        Imersivo
        <button
          role="switch"
          aria-checked={immersive}
          className={`focus-switch ${immersive ? "focus-switch--on" : ""}`}
          onClick={() => setImmersive(!immersive)}
        >
          <span className="focus-switch__knob" />
        </button>
      </label>
    </div>
  );
}

function TodoSection() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const currentTodoId = useFocusStore((s) => s.currentTodoId);
  const setCurrentTodo = useFocusStore((s) => s.setCurrentTodo);
  const today = localDay();

  const reload = useCallback(async () => {
    try {
      setTodos(await todoList(today));
      setError(null);
    } catch (err) {
      setError(String((err as { message?: string })?.message ?? err));
    }
  }, [today]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function add() {
    const trimmed = title.trim();
    if (!trimmed) return;
    setTitle("");
    try {
      await todoAdd(trimmed, today);
      await reload();
    } catch (err) {
      setError(String((err as { message?: string })?.message ?? err));
    }
  }

  async function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= todos.length) return;
    const ids = todos.map((t) => t.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    await todoReorder(today, ids).catch(() => {});
    await reload();
  }

  const pending = todos.filter((t) => !t.done).length;

  return (
    <section className="focus-todos">
      <header className="focus-todos__head">
        <h2>Hoje</h2>
        <span className="focus-todos__count">
          {pending === 0 ? "tudo feito" : `${pending} pendente${pending > 1 ? "s" : ""}`}
        </span>
        <button
          className="focus-carry"
          title="Trazer não-feitos de ontem"
          onClick={() => void todoCarryOver(localDay(-1), today).then(reload)}
        >
          ← ontem
        </button>
      </header>

      <form
        className="focus-add"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Nova tarefa…"
          maxLength={500}
        />
      </form>

      {error && <div className="focus-error">{error}</div>}

      <ul className="focus-list">
        {todos.map((todo, i) => (
          <li
            key={todo.id}
            className={`focus-item ${todo.done ? "focus-item--done" : ""} ${currentTodoId === todo.id ? "focus-item--current" : ""}`}
          >
            <button
              className="focus-check"
              aria-label={todo.done ? "Desmarcar" : "Concluir"}
              onClick={() => void todoToggle(todo.id).then(reload)}
            >
              {todo.done ? "✓" : ""}
            </button>
            <span className="focus-item__title">{todo.title}</span>
            <span className="focus-item__actions">
              {!todo.done && (
                <button
                  title="Focar nesta tarefa"
                  onClick={() =>
                    setCurrentTodo(currentTodoId === todo.id ? null : todo.id)
                  }
                >
                  <Play size={12} />
                </button>
              )}
              <button title="Subir" onClick={() => void move(i, -1)}>
                <ChevronUp size={13} />
              </button>
              <button title="Descer" onClick={() => void move(i, 1)}>
                <ChevronDown size={13} />
              </button>
              <button
                title="Excluir"
                onClick={() => void todoDelete(todo.id).then(reload)}
              >
                <Trash2 size={12} />
              </button>
            </span>
          </li>
        ))}
        {todos.length === 0 && !error && (
          <li className="focus-empty">Sem tarefas hoje — adiciona a primeira.</li>
        )}
      </ul>
    </section>
  );
}

function History() {
  const [stats, setStats] = useState<DayStat[]>([]);
  useEffect(() => {
    pomodoroHistory(14)
      .then(setStats)
      .catch(() => {});
  }, []);

  const days: { day: string; minutes: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const day = localDay(-i);
    const hit = stats.find((s) => s.day === day);
    days.push({ day, minutes: hit?.focus_minutes ?? 0 });
  }
  const max = Math.max(25, ...days.map((d) => d.minutes));

  return (
    <div className="focus-history" title="Minutos de foco — últimos 14 dias">
      {days.map((d) => (
        <div
          key={d.day}
          className="focus-history__bar"
          style={{ height: `${Math.max(6, (d.minutes / max) * 100)}%` }}
          title={`${d.day.slice(8)}/${d.day.slice(5, 7)} — ${d.minutes} min`}
          data-active={d.minutes > 0}
        />
      ))}
    </div>
  );
}

function FocusApp() {
  return (
    <div className="focus-app">
      <TimerRing />
      <CycleDots />
      <TechniqueChips />
      <DurationControls />
      <TodoSection />
      <History />
    </div>
  );
}

export default FocusApp;
