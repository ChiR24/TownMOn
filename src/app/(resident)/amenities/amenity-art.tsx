/** A small drawing for each bookable place, shown on its cover card. Drawings, not photos, so they load instantly. */
export function AmenityArt({ slug, className }: { slug: string; className?: string }) {
  const ink = "#121212";
  if (slug.startsWith("tennis")) {
    return (
      <svg viewBox="0 0 120 120" aria-hidden className={className}>
        <ellipse cx="52" cy="50" rx="26" ry="34" transform="rotate(-35 52 50)" fill="#fff" stroke={ink} strokeWidth="5" />
        <path d="M34 34 L70 66 M30 48 L58 72 M44 26 L76 54" stroke={ink} strokeWidth="2" opacity=".25" />
        <path d="M72 74 L96 102" stroke={ink} strokeWidth="9" strokeLinecap="round" />
        <circle cx="88" cy="36" r="16" fill="#c8f26d" stroke={ink} strokeWidth="4" />
        <path d="M76 26 C84 32 84 40 76 46 M100 26 C92 32 92 40 100 46" fill="none" stroke={ink} strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (slug.startsWith("badminton")) {
    return (
      <svg viewBox="0 0 120 120" aria-hidden className={className}>
        <path d="M40 20 L80 20 L70 70 L50 70 Z" fill="#fff" stroke={ink} strokeWidth="4" strokeLinejoin="round" />
        <path d="M53 22 L56 68 M67 22 L64 68 M46 40 L74 40 M48 55 L72 55" stroke={ink} strokeWidth="2" opacity=".3" />
        <path d="M48 70 Q60 64 72 70 L70 84 Q60 98 50 84 Z" fill="#c8f26d" stroke={ink} strokeWidth="4" strokeLinejoin="round" />
        <circle cx="94" cy="28" r="5" fill="#ffd6aa" />
        <circle cx="22" cy="80" r="4" fill="#c8f26d" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 120 120" aria-hidden className={className}>
      <path d="M18 56 L60 24 L102 56" fill="none" stroke={ink} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="28" y="52" width="64" height="48" rx="6" fill="#fff" stroke={ink} strokeWidth="4" />
      <rect x="50" y="70" width="20" height="30" rx="3" fill="#c8f26d" stroke={ink} strokeWidth="3.5" />
      <rect x="35" y="62" width="10" height="10" rx="2" fill={ink} opacity=".15" />
      <rect x="75" y="62" width="10" height="10" rx="2" fill={ink} opacity=".15" />
      <path d="M14 18 Q40 34 60 14 Q80 34 106 18" fill="none" stroke={ink} strokeWidth="1.5" opacity=".35" />
      {[24, 40, 60, 80, 96].map((x, i) => (
        <circle key={x} cx={x} cy={i % 2 ? 26 : 22} r="3.5" fill={i % 2 ? "#ffd6aa" : "#c8f26d"} />
      ))}
    </svg>
  );
}
