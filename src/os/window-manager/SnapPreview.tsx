import { motion } from "motion/react";
import { useWindowStore } from "./store";

/** Contorno de vidro mostrando onde a janela vai encaixar. */
function SnapPreview() {
  const rect = useWindowStore((s) => s.snapPreview);
  if (!rect) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.12 }}
      style={{
        position: "absolute",
        left: rect.x + 6,
        top: rect.y + 6,
        width: rect.w - 12,
        height: rect.h - 12,
        zIndex: 8000,
        borderRadius: 14,
        border: "1.5px solid var(--glass-border-focus)",
        background: "rgba(217, 180, 91, 0.08)",
        backdropFilter: "blur(4px)",
        pointerEvents: "none",
      }}
    />
  );
}

export default SnapPreview;
