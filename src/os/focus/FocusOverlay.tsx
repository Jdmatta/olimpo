import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { formatRemaining } from "./engine";
import { useFocusStore } from "./focusStore";
import "./overlay.css";

/**
 * Modo imersivo: cobre o desktop inteiro durante sessões de FOCO.
 * Dock e menubar ficam por baixo — sem distração até acabar ou cancelar.
 */
function FocusOverlay() {
  const session = useFocusStore((s) => s.session);
  const immersive = useFocusStore((s) => s.immersive);
  const cancel = useFocusStore((s) => s.cancel);
  const setImmersive = useFocusStore((s) => s.setImmersive);

  const active = immersive && session?.kind === "focus";
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, [active]);

  if (!active || !session) return null;

  return (
    <motion.div
      className="focus-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <span className="focus-overlay__phase">foco</span>
      <span className="focus-overlay__time">{formatRemaining(session, now)}</span>
      <div className="focus-overlay__actions">
        <button onClick={() => setImmersive(false)}>sair do imersivo</button>
        <button onClick={() => void cancel()}>encerrar foco</button>
      </div>
    </motion.div>
  );
}

export default FocusOverlay;
