import { Download, X } from "lucide-react";
import { useUpdater } from "./useUpdater";
import "./updater.css";

/** Banner de atualização — aparece quando há versão nova ou erro no check manual. */
function UpdateBanner() {
  const { state, install, dismiss } = useUpdater();

  if (state.status === "available") {
    return (
      <div className="update-banner">
        <Download size={15} />
        <span>
          <strong>Olimpo {state.version}</strong> disponível
        </span>
        <button className="update-banner__go" onClick={() => void install()}>
          Atualizar e reiniciar
        </button>
        <button className="update-banner__x" onClick={dismiss} aria-label="Depois">
          <X size={14} />
        </button>
      </div>
    );
  }

  if (state.status === "downloading") {
    return (
      <div className="update-banner">
        <span>Baixando {state.version}… o app reinicia sozinho ao terminar.</span>
      </div>
    );
  }

  if (state.status === "checking") {
    return <div className="update-banner">Procurando atualizações…</div>;
  }

  if (state.status === "uptodate") {
    return (
      <div className="update-banner update-banner--ok">
        <span>Você já está na versão mais recente.</span>
        <button className="update-banner__x" onClick={dismiss} aria-label="Fechar">
          <X size={14} />
        </button>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="update-banner update-banner--err">
        <span>Não consegui verificar: {state.message}</span>
        <button className="update-banner__x" onClick={dismiss} aria-label="Fechar">
          <X size={14} />
        </button>
      </div>
    );
  }

  return null;
}

export default UpdateBanner;
