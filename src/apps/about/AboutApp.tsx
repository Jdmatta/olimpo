function AboutApp() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-10 text-center">
      <div
        className="text-5xl italic tracking-wide"
        style={{ fontFamily: "var(--font-display)", color: "var(--marble)" }}
      >
        Olimpo
      </div>
      <div
        className="h-px w-24"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--laurel), transparent)",
        }}
      />
      <p className="max-w-sm text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        Workspace pessoal de desenvolvimento — janelas, terminal, arquivos e
        foco, sob o mesmo céu.
      </p>
      <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
        v0.1.0 · Tauri 2 + React · feito por Jairo da Matta
      </p>
    </div>
  );
}

export default AboutApp;
