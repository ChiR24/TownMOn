/** The mark: three towers and a lime sun on near-black. Same drawing as app/icon.svg and the PNG app icons. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={className ?? "size-8"}>
      <rect width="64" height="64" rx="20" fill="#121212" />
      <circle cx="46" cy="18" r="6" fill="#c8f26d" />
      <rect x="13" y="29" width="11" height="21" rx="2.5" fill="#fff" fillOpacity=".72" />
      <rect x="27" y="17" width="11" height="33" rx="2.5" fill="#fff" />
      <rect x="41" y="31" width="11" height="19" rx="2.5" fill="#fff" fillOpacity=".72" />
      <rect x="10" y="50" width="44" height="3" rx="1.5" fill="#c8f26d" />
    </svg>
  );
}

// x, width, height of each tower, left to right.
const TOWERS = [
  [22, 44, 104],
  [74, 52, 142],
  [134, 40, 92],
  [182, 58, 128],
  [248, 44, 110],
  [300, 40, 84],
] as const;
const GROUND = 186;

/**
 * The township at morning: white towers, a lime sun, trees along the boundary. Brand imagery for sign-in and the
 * welcome screen; a drawing (a few KB) rather than photos, so it loads instantly on weak data.
 */
export function TownshipArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 360 220" preserveAspectRatio="xMidYMid slice" aria-hidden className={className}>
      <defs>
        <linearGradient id="art-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e4f6bf" />
          <stop offset="0.65" stopColor="#fbf3e2" />
          <stop offset="1" stopColor="#fde8d3" />
        </linearGradient>
        <radialGradient id="art-sun">
          <stop offset="0.55" stopColor="#c8f26d" />
          <stop offset="1" stopColor="#c8f26d" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="art-tower" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#f1efea" />
        </linearGradient>
      </defs>
      <rect width="360" height="220" fill="url(#art-sky)" />
      <circle cx="286" cy="58" r="54" fill="url(#art-sun)" opacity=".7" />
      <circle cx="286" cy="58" r="24" fill="#c8f26d" />
      <rect x="40" y="40" width="74" height="16" rx="8" fill="#fff" opacity=".75" />
      <rect x="62" y="30" width="40" height="16" rx="8" fill="#fff" opacity=".75" />
      <rect x="182" y="70" width="58" height="12" rx="6" fill="#fff" opacity=".6" />
      {TOWERS.map(([x, w, h]) => (
        <g key={x}>
          <rect x={x + 6} y={GROUND - h + 8} width={w} height={h} rx="7" fill="#121212" opacity=".06" />
          <rect x={x} y={GROUND - h} width={w} height={h + 6} rx="7" fill="url(#art-tower)" />
          {Array.from({ length: Math.floor((h - 22) / 16) }, (_, row) =>
            Array.from({ length: Math.floor((w - 12) / 12) }, (_, col) => (
              <rect key={`${row}-${col}`} x={x + 8 + col * 12} y={GROUND - h + 12 + row * 16} width="6" height="8" rx="1.5" fill={(row * 7 + col * 3 + x) % 9 === 0 ? "#c8f26d" : "#121212"} opacity={(row * 7 + col * 3 + x) % 9 === 0 ? 1 : 0.08} />
            )),
          )}
        </g>
      ))}
      <path d={`M0 ${GROUND} C 90 ${GROUND - 10}, 250 ${GROUND - 10}, 360 ${GROUND} L360 220 L0 220 Z`} fill="#d7efa6" />
      <path d={`M0 ${GROUND + 14} C 120 ${GROUND + 4}, 240 ${GROUND + 6}, 360 ${GROUND + 16} L360 220 L0 220 Z`} fill="#c2e57f" />
      {[14, 64, 128, 172, 236, 292, 338].map((x, i) => (
        <g key={x}>
          <rect x={x - 1.5} y={GROUND - 6} width="3" height="12" rx="1.5" fill="#6b8f3a" />
          <circle cx={x} cy={GROUND - 12} r={i % 2 ? 11 : 14} fill={i % 3 ? "#8fcf4a" : "#6fb52f"} />
        </g>
      ))}
    </svg>
  );
}
