/** "há 5 min", "há 3 h", "há 2 d" — curto, pt-BR, para feeds. */
export function relativeTime(iso: string | null, now = Date.now()): string {
  if (!iso) return "—";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "—";
  const diff = Math.max(0, now - then);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `há ${days} d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `há ${months} ${months > 1 ? "meses" : "mês"}`;
  const years = Math.floor(months / 12);
  return `há ${years} ano${years > 1 ? "s" : ""}`;
}

/** "Jdmatta/olimpo" a partir da repository_url da API de busca. */
export function repoFromUrl(repositoryUrl: string): string {
  const marker = "/repos/";
  const idx = repositoryUrl.indexOf(marker);
  return idx === -1 ? repositoryUrl : repositoryUrl.slice(idx + marker.length);
}
