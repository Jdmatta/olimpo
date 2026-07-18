import { useCallback, useEffect, useState } from "react";
import {
  CircleDot,
  ExternalLink,
  GitCommitHorizontal,
  GitPullRequest,
  LogOut,
  RefreshCw,
  Star,
} from "lucide-react";
import {
  githubAssigned,
  githubCommits,
  githubConnect,
  githubDisconnect,
  githubOverview,
  githubStatus,
} from "../../lib/ipc";
import type {
  GhCommit,
  GhRepo,
  GhSearchIssues,
  GithubOverview,
} from "../../lib/ipc";
import { relativeTime, repoFromUrl } from "./relativeTime";
import "./github.css";

interface IpcError {
  code?: string;
  message?: string;
}

function openExternal(url: string) {
  void import("@tauri-apps/plugin-opener")
    .then((m) => m.openUrl(url))
    .catch(() => {});
}

type Screen =
  | { view: "loading" }
  | { view: "connect"; warning?: string }
  | { view: "dashboard" };

function GithubApp() {
  const [screen, setScreen] = useState<Screen>({ view: "loading" });

  useEffect(() => {
    githubStatus()
      .then((s) =>
        setScreen(s.connected ? { view: "dashboard" } : { view: "connect" }),
      )
      .catch(() => setScreen({ view: "connect" }));
  }, []);

  if (screen.view === "loading") {
    return <div className="gh-loading">Carregando…</div>;
  }
  if (screen.view === "connect") {
    return (
      <ConnectView
        warning={screen.warning}
        onConnected={() => setScreen({ view: "dashboard" })}
      />
    );
  }
  return (
    <Dashboard
      onAuthLost={(warning) => setScreen({ view: "connect", warning })}
    />
  );
}

function ConnectView({
  warning,
  onConnected,
}: {
  warning?: string;
  onConnected: () => void;
}) {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(warning ?? null);

  async function connect() {
    if (!token.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await githubConnect(token.trim());
      setToken("");
      onConnected();
    } catch (err) {
      const e = err as IpcError;
      setError(
        e.code === "github_auth"
          ? "Token inválido — confere se copiou inteiro e se não expirou."
          : (e.message ?? String(err)),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gh-connect">
      <h1 className="gh-connect__title">Conecte seu GitHub</h1>
      <ol className="gh-connect__steps">
        <li>
          Crie um{" "}
          <button
            className="gh-link"
            onClick={() =>
              openExternal("https://github.com/settings/personal-access-tokens/new")
            }
          >
            fine-grained token <ExternalLink size={11} />
          </button>
        </li>
        <li>
          Permissões de repositório, <strong>somente leitura</strong>: Metadata,
          Contents, Issues e Pull requests.
        </li>
        <li>Cole aqui — ele vai direto pro Cofre de Credenciais do Windows.</li>
      </ol>
      <form
        className="gh-connect__form"
        onSubmit={(e) => {
          e.preventDefault();
          void connect();
        }}
      >
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="github_pat_…"
          autoComplete="off"
          spellCheck={false}
        />
        <button type="submit" disabled={busy || !token.trim()}>
          {busy ? "Validando…" : "Conectar"}
        </button>
      </form>
      {error && <div className="gh-error">{error}</div>}
      <p className="gh-connect__note">
        O token nunca fica em arquivo ou banco — só no Credential Manager, e as
        chamadas saem do lado nativo do app.
      </p>
    </div>
  );
}

function Dashboard({ onAuthLost }: { onAuthLost: (w: string) => void }) {
  const [overview, setOverview] = useState<GithubOverview | null>(null);
  const [assigned, setAssigned] = useState<GhSearchIssues | null>(null);
  const [assignedError, setAssignedError] = useState<string | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [commits, setCommits] = useState<GhCommit[] | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (force: boolean) => {
      setBusy(true);
      setBanner(null);
      setAssignedError(null);
      // allSettled: falha nos issues não pode derrubar o dashboard inteiro.
      const [ov, asg] = await Promise.allSettled([
        githubOverview(force),
        githubAssigned(force),
      ]);

      if (ov.status === "fulfilled") {
        setOverview(ov.value);
      } else {
        const e = ov.reason as IpcError;
        if (e.code === "github_auth") {
          onAuthLost("Token revogado ou expirado — conecta de novo.");
          setBusy(false);
          return;
        }
        setBanner(
          e.code === "github_rate"
            ? "Rate limit do GitHub atingido — tenta de novo em alguns minutos."
            : `Sem conexão com o GitHub agora. ${e.message ?? ""}`,
        );
      }

      if (asg.status === "fulfilled") {
        setAssigned(asg.value);
      } else {
        const e = asg.reason as IpcError;
        setAssignedError(
          `Não consegui listar seus issues/PRs (${e.message ?? "erro"}). ` +
            "Confere se o token tem permissão de leitura em Issues e Pull requests.",
        );
      }
      setBusy(false);
    },
    [onAuthLost],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  useEffect(() => {
    if (!selectedRepo) return;
    setCommits(null);
    githubCommits(selectedRepo)
      .then(setCommits)
      .catch((err) => {
        const e = err as IpcError;
        setBanner(e.message ?? String(err));
      });
  }, [selectedRepo]);

  async function disconnect() {
    await githubDisconnect().catch(() => {});
    onAuthLost("Desconectado.");
  }

  const issues = assigned?.items.filter((i) => !i.pull_request) ?? [];
  const prs = assigned?.items.filter((i) => i.pull_request) ?? [];

  return (
    <div className="gh-app">
      <header className="gh-header">
        {overview ? (
          <>
            <img
              className="gh-avatar"
              src={overview.user.avatar_url}
              alt=""
              width={40}
              height={40}
            />
            <div className="gh-header__id">
              <button
                className="gh-header__login"
                onClick={() => openExternal(overview.user.html_url)}
                title="Abrir perfil"
              >
                {overview.user.name ?? overview.user.login}
              </button>
              <span className="gh-header__meta">
                @{overview.user.login} · {overview.user.public_repos} repos ·{" "}
                {overview.user.followers} seguidores
              </span>
            </div>
          </>
        ) : (
          <div className="gh-skeleton gh-skeleton--header" />
        )}
        <div className="gh-header__actions">
          {overview?.rate_remaining != null && (
            <span className="gh-rate" title="Chamadas restantes da API">
              {overview.rate_remaining}
            </span>
          )}
          <button
            className="gh-tool"
            title="LinkedIn"
            onClick={() => openExternal("https://www.linkedin.com/in/jdmatta")}
          >
            in
          </button>
          <button
            className="gh-tool"
            title="Atualizar (ignora cache)"
            onClick={() => void load(true)}
            disabled={busy}
          >
            <RefreshCw size={14} className={busy ? "gh-spin" : ""} />
          </button>
          <button className="gh-tool" title="Desconectar" onClick={() => void disconnect()}>
            <LogOut size={14} />
          </button>
        </div>
      </header>

      {banner && <div className="gh-banner">{banner}</div>}

      <div className="gh-body">
        <section className="gh-repos">
          <h2 className="gh-section-title">Repositórios</h2>
          <div className="gh-repos__list">
            {overview?.repos.map((repo) => (
              <RepoCard
                key={repo.id}
                repo={repo}
                selected={selectedRepo === repo.full_name}
                onSelect={() =>
                  setSelectedRepo(
                    selectedRepo === repo.full_name ? null : repo.full_name,
                  )
                }
              />
            ))}
            {!overview && <div className="gh-skeleton gh-skeleton--list" />}
            {overview?.repos.length === 0 && (
              <div className="gh-empty">Nenhum repo ainda.</div>
            )}
          </div>
        </section>

        <section className="gh-side">
          <h2 className="gh-section-title">
            Meus abertos{" "}
            {assigned && (
              <span className="gh-count">
                {issues.length} issues · {prs.length} PRs
              </span>
            )}
          </h2>
          <div className="gh-side__assigned">
            {assignedError && <div className="gh-empty">{assignedError}</div>}
            {!assignedError && assigned?.items.length === 0 && (
              <div className="gh-empty">Nada atribuído a você. Paz.</div>
            )}
            {assigned?.items.map((item) => (
              <button
                key={item.id}
                className="gh-issue"
                onClick={() => openExternal(item.html_url)}
                title={item.title}
              >
                {item.pull_request ? (
                  <GitPullRequest size={13} className="gh-issue__icon gh-issue__icon--pr" />
                ) : (
                  <CircleDot size={13} className="gh-issue__icon" />
                )}
                <span className="gh-issue__title">{item.title}</span>
                <span className="gh-issue__repo">
                  {repoFromUrl(item.repository_url)}#{item.number}
                </span>
              </button>
            ))}
          </div>

          {selectedRepo && (
            <>
              <h2 className="gh-section-title">
                <GitCommitHorizontal size={14} /> {selectedRepo.split("/")[1]}
              </h2>
              <div className="gh-commits">
                {commits === null && <div className="gh-skeleton gh-skeleton--list" />}
                {commits?.map((c) => (
                  <button
                    key={c.sha}
                    className="gh-commit"
                    onClick={() => openExternal(c.html_url)}
                  >
                    <code className="gh-commit__sha">{c.sha.slice(0, 7)}</code>
                    <span className="gh-commit__msg">
                      {c.commit.message.split("\n")[0]}
                    </span>
                    <span className="gh-commit__when">
                      {relativeTime(c.commit.author?.date ?? null)}
                    </span>
                  </button>
                ))}
                {commits?.length === 0 && (
                  <div className="gh-empty">Repo vazio.</div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function RepoCard({
  repo,
  selected,
  onSelect,
}: {
  repo: GhRepo;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      className={`gh-repo ${selected ? "gh-repo--selected" : ""}`}
      onClick={onSelect}
      title={repo.description ?? repo.full_name}
    >
      <span className="gh-repo__name">
        {repo.name}
        {repo.private && <span className="gh-repo__badge">privado</span>}
      </span>
      {repo.description && (
        <span className="gh-repo__desc">{repo.description}</span>
      )}
      <span className="gh-repo__meta">
        {repo.language && <span className="gh-repo__lang">{repo.language}</span>}
        {repo.stargazers_count > 0 && (
          <span className="gh-repo__stars">
            <Star size={11} /> {repo.stargazers_count}
          </span>
        )}
        <span className="gh-repo__when">{relativeTime(repo.pushed_at)}</span>
      </span>
    </button>
  );
}

export default GithubApp;
