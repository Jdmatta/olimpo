import { useWindowStore } from "./store";
import { WindowFrame } from "./Window";

/**
 * Renderiza TODAS as janelas — inclusive minimizadas (ficam montadas com
 * `inert` + animação de saída via CSS/motion). Manter montado é requisito:
 * o Terminal (M2) precisa do xterm vivo enquanto minimizado.
 */
function WindowLayer() {
  const windows = useWindowStore((s) => s.windows);

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ pointerEvents: "none" }}>
      <div style={{ pointerEvents: "auto" }} className="contents">
        {Object.values(windows).map((win) => (
          <WindowFrame key={win.id} win={win} />
        ))}
      </div>
    </div>
  );
}

export default WindowLayer;
