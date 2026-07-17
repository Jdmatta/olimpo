interface ComingSoonProps {
  title: string;
  hint: string;
}

/** Placeholder de app ainda não construído. */
function ComingSoon({ title, hint }: ComingSoonProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
      <span
        className="text-3xl italic"
        style={{ fontFamily: "var(--font-display)", color: "var(--laurel)" }}
      >
        {title}
      </span>
      <p className="max-w-xs text-sm" style={{ color: "var(--text-tertiary)" }}>
        {hint}
      </p>
    </div>
  );
}

export default ComingSoon;
