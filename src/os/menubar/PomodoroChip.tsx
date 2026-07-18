import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { formatRemaining } from "../focus/engine";
import { useFocusStore } from "../focus/focusStore";
import { useWindowStore } from "../window-manager/store";

/** Contagem regressiva no menubar enquanto uma sessão roda. */
function PomodoroChip() {
  const session = useFocusStore((s) => s.session);
  const openWindow = useWindowStore((s) => s.open);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!session) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [session]);

  if (!session) return null;

  return (
    <button
      className={`menubar__chip ${session.kind === "break" ? "menubar__chip--break" : ""}`}
      onClick={() => openWindow("focus")}
      title={session.kind === "focus" ? "Sessão de foco" : "Pausa"}
    >
      <Timer size={12} strokeWidth={2} />
      {formatRemaining(session, now)}
    </button>
  );
}

export default PomodoroChip;
