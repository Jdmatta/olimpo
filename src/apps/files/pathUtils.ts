export interface Crumb {
  label: string;
  path: string;
}

/** Quebra `path` em migalhas clicáveis a partir da raiz do workspace. */
export function crumbsFor(root: string, path: string): Crumb[] {
  const sep = "\\";
  const rootLabel = root.split(sep).filter(Boolean).pop() ?? root;
  const crumbs: Crumb[] = [{ label: rootLabel, path: root }];
  if (path === root) return crumbs;
  if (!path.startsWith(root)) return crumbs;

  const rest = path.slice(root.length).split(sep).filter(Boolean);
  let acc = root;
  for (const part of rest) {
    acc = acc.endsWith(sep) ? acc + part : acc + sep + part;
    crumbs.push({ label: part, path: acc });
  }
  return crumbs;
}

export function formatSize(bytes: number, isDir: boolean): string {
  if (isDir) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unit]}`;
}

export function formatModified(ms: number): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
