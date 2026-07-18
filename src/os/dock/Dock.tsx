import { useEffect, useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react";
import type { MotionValue } from "motion/react";
import { AppWindow, Code2, Globe } from "lucide-react";
import { listPinnedApps } from "../../apps/registry";
import type { AppMeta } from "../../apps/registry";
import { extappLaunch, extappList } from "../../lib/ipc";
import type { ExternalApp } from "../../lib/ipc";
import { useWindowStore } from "../window-manager/store";
import "./dock.css";

export function extAppIcon(icon: string, size = 24) {
  if (icon === "globe") return <Globe size={size} strokeWidth={1.6} />;
  if (icon === "code") return <Code2 size={size} strokeWidth={1.6} />;
  return <AppWindow size={size} strokeWidth={1.6} />;
}

const ICON_SIZE = 48;
const MAGNIFY = 1.45;
const RANGE = 130;

function DockIcon({ app, mouseX }: { app: AppMeta; mouseX: MotionValue<number> }) {
  const ref = useRef<HTMLButtonElement>(null);
  const activateApp = useWindowStore((s) => s.activateApp);
  const running = useWindowStore((s) =>
    Object.values(s.windows).some((w) => w.appId === app.id),
  );

  const distance = useTransform(mouseX, (mx) => {
    const bounds = ref.current?.getBoundingClientRect();
    if (!bounds || mx === Infinity) return RANGE;
    return mx - (bounds.x + bounds.width / 2);
  });
  const scaleRaw = useTransform(
    distance,
    [-RANGE, 0, RANGE],
    [1, MAGNIFY, 1],
  );
  const scale = useSpring(scaleRaw, { mass: 0.1, stiffness: 260, damping: 18 });
  const size = useTransform(scale, (s) => s * ICON_SIZE);

  return (
    <div className="dock__item">
      <motion.button
        ref={ref}
        className="dock__icon glass-soft"
        style={{ width: size, height: size }}
        onClick={() => activateApp(app.id)}
        aria-label={app.title}
        title={app.title}
      >
        {app.icon(24)}
      </motion.button>
      <span className={`dock__dot ${running ? "dock__dot--on" : ""}`} />
    </div>
  );
}

function ExternalIcon({ app, mouseX }: { app: ExternalApp; mouseX: MotionValue<number> }) {
  const ref = useRef<HTMLButtonElement>(null);
  const distance = useTransform(mouseX, (mx) => {
    const bounds = ref.current?.getBoundingClientRect();
    if (!bounds || mx === Infinity) return RANGE;
    return mx - (bounds.x + bounds.width / 2);
  });
  const scaleRaw = useTransform(distance, [-RANGE, 0, RANGE], [1, MAGNIFY, 1]);
  const scale = useSpring(scaleRaw, { mass: 0.1, stiffness: 260, damping: 18 });
  const size = useTransform(scale, (s) => s * ICON_SIZE);

  return (
    <div className="dock__item">
      <motion.button
        ref={ref}
        className="dock__icon glass-soft"
        style={{ width: size, height: size }}
        onClick={() => void extappLaunch(app.id).catch(() => {})}
        aria-label={app.label}
        title={`${app.label} (abre fora do Olimpo)`}
      >
        {extAppIcon(app.icon)}
      </motion.button>
      <span className="dock__dot" />
    </div>
  );
}

function Dock() {
  const mouseX = useMotionValue(Infinity);
  const [external, setExternal] = useState<ExternalApp[]>([]);

  useEffect(() => {
    const load = () =>
      extappList()
        .then(setExternal)
        .catch(() => {});
    load();
    window.addEventListener("olimpo:extapps-changed", load);
    return () => window.removeEventListener("olimpo:extapps-changed", load);
  }, []);

  return (
    <div className="dock-zone">
      <motion.nav
        className="dock glass glass-sheen"
        onMouseMove={(e) => mouseX.set(e.clientX)}
        onMouseLeave={() => mouseX.set(Infinity)}
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        {listPinnedApps().map((app) => (
          <DockIcon key={app.id} app={app} mouseX={mouseX} />
        ))}
        {external.length > 0 && <span className="dock__separator" />}
        {external.map((app) => (
          <ExternalIcon key={app.id} app={app} mouseX={mouseX} />
        ))}
      </motion.nav>
    </div>
  );
}

export default Dock;
