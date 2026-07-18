import { Suspense, memo, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { motion } from "motion/react";
import { Minus, Plus, X } from "lucide-react";
import { getAppMeta } from "../../apps/registry";
import { useWindowStore } from "./store";
import type { Rect, WindowState } from "./types";
import "./window.css";

const MENUBAR_H = 30;
const EDGE_MARGIN = 80;

type ResizeDir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
const RESIZE_DIRS: ResizeDir[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

function clampRect(rect: Rect, minW: number, minH: number): Rect {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.max(minW, rect.w);
  const h = Math.max(minH, rect.h);
  return {
    w,
    h,
    x: Math.min(Math.max(rect.x, EDGE_MARGIN - w), vw - EDGE_MARGIN),
    y: Math.min(Math.max(rect.y, MENUBAR_H), vh - 48),
  };
}

interface WindowFrameProps {
  win: WindowState;
}

function WindowFrameImpl({ win }: WindowFrameProps) {
  const meta = getAppMeta(win.appId);
  const frameRef = useRef<HTMLDivElement>(null);
  const focus = useWindowStore((s) => s.focus);
  const close = useWindowStore((s) => s.close);
  const minimize = useWindowStore((s) => s.minimize);
  const setRect = useWindowStore((s) => s.setRect);
  const toggleMaximize = useWindowStore((s) => s.toggleMaximize);
  const isFocused = useWindowStore((s) => s.focusedId === win.id);

  const gesture = useRef<{
    startX: number;
    startY: number;
    rect: Rect;
    dir: ResizeDir | "move";
  } | null>(null);

  function beginGesture(
    e: ReactPointerEvent,
    dir: ResizeDir | "move",
  ) {
    if (win.maximized) return;
    focus(win.id);
    gesture.current = {
      startX: e.clientX,
      startY: e.clientY,
      rect: win.rect,
      dir,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onGestureMove(e: ReactPointerEvent) {
    const g = gesture.current;
    const el = frameRef.current;
    if (!g || !el) return;
    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;

    if (g.dir === "move") {
      el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      return;
    }
    const next = resizedRect(g.rect, g.dir, dx, dy, meta.minSize.w, meta.minSize.h);
    el.style.left = `${next.x}px`;
    el.style.top = `${next.y}px`;
    el.style.width = `${next.w}px`;
    el.style.height = `${next.h}px`;
  }

  function endGesture(e: ReactPointerEvent) {
    const g = gesture.current;
    const el = frameRef.current;
    gesture.current = null;
    if (!g || !el) return;
    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    el.style.transform = "";

    const next =
      g.dir === "move"
        ? { ...g.rect, x: g.rect.x + dx, y: g.rect.y + dy }
        : resizedRect(g.rect, g.dir, dx, dy, meta.minSize.w, meta.minSize.h);
    setRect(win.id, clampRect(next, meta.minSize.w, meta.minSize.h));
  }

  const Content = meta.component;

  const frameStyle = win.maximized
    ? { left: 0, top: MENUBAR_H, width: "100vw", height: `calc(100vh - ${MENUBAR_H}px)` }
    : {
        left: win.rect.x,
        top: win.rect.y,
        width: win.rect.w,
        height: win.rect.h,
      };

  return (
    <motion.div
      ref={frameRef}
      className={`os-window glass-strong glass-sheen ${isFocused ? "os-window--focused" : ""} ${win.maximized ? "os-window--maximized" : ""}`}
      style={{ ...frameStyle, zIndex: win.z }}
      inert={win.minimized}
      initial={{ scale: 0.97, y: 0 }}
      animate={
        win.minimized
          ? { opacity: 0, scale: 0.9, y: 48, transition: { duration: 0.2 } }
          : { opacity: 1, scale: 1, y: 0 }
      }
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      onPointerDown={() => focus(win.id)}
    >
      <div
        className="os-window__titlebar"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest(".os-window__lights")) return;
          beginGesture(e, "move");
        }}
        onPointerMove={onGestureMove}
        onPointerUp={endGesture}
        onDoubleClick={() => toggleMaximize(win.id)}
      >
        <div className="os-window__lights">
          <button
            className="os-light os-light--close"
            aria-label="Fechar"
            onClick={() => close(win.id)}
          >
            <X size={9} strokeWidth={2.6} />
          </button>
          <button
            className="os-light os-light--min"
            aria-label="Minimizar"
            onClick={() => minimize(win.id)}
          >
            <Minus size={9} strokeWidth={2.6} />
          </button>
          <button
            className="os-light os-light--max"
            aria-label="Maximizar"
            onClick={() => toggleMaximize(win.id)}
          >
            <Plus size={9} strokeWidth={2.6} />
          </button>
        </div>
        <span className="os-window__title">{meta.title}</span>
        <div className="os-window__titlebar-spacer" />
      </div>

      <div className="os-window__content grain">
        <Suspense fallback={null}>
          <Content />
        </Suspense>
      </div>

      {!win.maximized &&
        RESIZE_DIRS.map((dir) => (
          <div
            key={dir}
            className={`os-resize os-resize--${dir}`}
            onPointerDown={(e) => {
              e.stopPropagation();
              beginGesture(e, dir);
            }}
            onPointerMove={onGestureMove}
            onPointerUp={endGesture}
          />
        ))}
    </motion.div>
  );
}

function resizedRect(
  base: Rect,
  dir: ResizeDir,
  dx: number,
  dy: number,
  minW: number,
  minH: number,
): Rect {
  let { x, y, w, h } = base;
  if (dir.includes("e")) w = Math.max(minW, base.w + dx);
  if (dir.includes("s")) h = Math.max(minH, base.h + dy);
  if (dir.includes("w")) {
    w = Math.max(minW, base.w - dx);
    x = base.x + (base.w - w);
  }
  if (dir.includes("n")) {
    h = Math.max(minH, base.h - dy);
    y = base.y + (base.h - h);
  }
  return { x, y, w, h };
}

export const WindowFrame = memo(WindowFrameImpl);
