import type { ReactNode } from "react";
import type { ArtName } from "@/lib/art";

/**
 * Vector scenes drawn on a 96x96 canvas. Flat colours plus opacity layers only (no gradient ids),
 * so many icons can share one page without id clashes. Tile background colours come from `tile`.
 */
export const SCENES: Record<ArtName, { tile: [string, string]; art: ReactNode }> = {
  /* ───────── Courses & community ───────── */
  physics: {
    tile: ["#0c4a6e", "#312e81"],
    art: (
      <>
        <circle cx="46" cy="44" r="34" fill="#38bdf8" opacity=".14" />
        <rect x="3" y="75" width="90" height="9" rx="2" fill="#1e293b" stroke="#38bdf8" strokeOpacity=".7" />
        {/* laser emitter */}
        <rect x="5" y="52" width="19" height="13" rx="3" fill="#64748b" />
        <rect x="8" y="65" width="4" height="10" fill="#334155" />
        <rect x="16" y="65" width="4" height="10" fill="#334155" />
        <circle cx="24" cy="58.5" r="3" fill="#fb7185" />
        <line x1="26" y1="58.5" x2="45" y2="58.5" stroke="#fb7185" strokeWidth="6" opacity=".25" />
        <line x1="26" y1="58.5" x2="45" y2="58.5" stroke="#fecdd3" strokeWidth="1.6" />
        {/* prism + dispersed beams */}
        <polygon points="50,43 63,69 37,69" fill="#bae6fd" opacity=".4" stroke="#e0f2fe" strokeWidth="1.6" />
        <line x1="56" y1="60" x2="69" y2="48" stroke="#f87171" strokeWidth="1.8" />
        <line x1="57" y1="63" x2="69" y2="58" stroke="#4ade80" strokeWidth="1.8" />
        <line x1="58" y1="66" x2="69" y2="67" stroke="#60a5fa" strokeWidth="1.8" />
        {/* student in lab coat and goggles */}
        <rect x="70" y="55" width="21" height="21" rx="7" fill="#f1f5f9" />
        <rect x="78" y="58" width="5" height="18" fill="#cbd5e1" />
        <circle cx="80.5" cy="46" r="9" fill="#c68642" />
        <path d="M71.5 44 q9 -12 18 0 v-2 q-9 -9 -18 0z" fill="#1e293b" />
        <rect x="72" y="43" width="17" height="7" rx="3.5" fill="#0ea5e9" fillOpacity=".85" stroke="#f8fafc" strokeWidth="1.2" />
        <circle cx="30" cy="31" r="1.6" fill="#fff" opacity=".8" /><circle cx="14" cy="38" r="1.2" fill="#fff" opacity=".6" />
      </>
    ),
  },
  maths: {
    tile: ["#064e3b", "#0c4a6e"],
    art: (
      <>
        <rect x="9" y="12" width="78" height="64" rx="7" fill="#020617" opacity=".7" stroke="#34d399" strokeWidth="1.5" />
        {[28, 44, 60].map((y) => <line key={y} x1="14" y1={y} x2="82" y2={y} stroke="#34d399" strokeOpacity=".25" />)}
        {[30, 48, 66].map((x) => <line key={x} x1={x} y1="18" x2={x} y2="70" stroke="#34d399" strokeOpacity=".25" />)}
        <path d="M14 66 C 28 62, 34 30, 48 34 S 66 56, 82 22" fill="none" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" />
        <path d="M14 66 C 28 62, 34 30, 48 34 S 66 56, 82 22 V70 H14z" fill="#22d3ee" opacity=".12" />
        {[[14, 66], [48, 34], [82, 22]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="3.5" fill="#fbbf24" stroke="#fff" strokeWidth="1" />)}
        <text x="16" y="88" fontSize="14" fontWeight="800" fill="#fde68a" fontFamily="system-ui,sans-serif">π ∑ √x</text>
      </>
    ),
  },
  market: {
    tile: ["#14532d", "#1e3a8a"],
    art: (
      <>
        <rect x="8" y="10" width="80" height="62" rx="7" fill="#020617" opacity=".75" stroke="#4ade80" strokeWidth="1.5" />
        {[[20, 44, 58, 36, 62, "#4ade80"], [32, 38, 54, 30, 60, "#f87171"], [44, 30, 46, 24, 52, "#4ade80"], [56, 34, 44, 26, 50, "#4ade80"], [68, 20, 36, 14, 42, "#4ade80"], [80, 16, 28, 12, 34, "#4ade80"]].map(([x, top, bot, wt, wb, c], i) => (
          <g key={i}><line x1={x as number} y1={wt as number} x2={x as number} y2={wb as number} stroke={c as string} strokeWidth="1.5" /><rect x={(x as number) - 4} y={top as number} width="8" height={(bot as number) - (top as number)} rx="1.5" fill={c as string} /></g>
        ))}
        <path d="M14 62 L38 50 L52 54 L82 22" fill="none" stroke="#fbbf24" strokeWidth="2.5" strokeDasharray="4 3" />
        <polygon points="82,22 74,22 82,30" fill="#fbbf24" />
        <rect x="14" y="78" width="68" height="10" rx="5" fill="#1e293b" /><circle cx="22" cy="83" r="3" fill="#fbbf24" /><rect x="30" y="81" width="40" height="4" rx="2" fill="#94a3b8" />
      </>
    ),
  },
  community: {
    tile: ["#7c2d12", "#581c87"],
    art: (
      <>
        <path d="M48 7 L84 19 V48 C84 68 68 82 48 90 C28 82 12 68 12 48 V19z" fill="#0f172a" stroke="#fbbf24" strokeWidth="3" />
        <path d="M48 14 L77 24 V48 C77 63 65 75 48 82 C31 75 19 63 19 48 V24z" fill="#1d4ed8" opacity=".55" />
        {/* blocky avatar */}
        <rect x="38" y="26" width="20" height="20" rx="2.5" fill="#fcd34d" stroke="#92400e" strokeWidth="1.5" />
        <rect x="42.5" y="33" width="4" height="4" fill="#0f172a" /><rect x="50.5" y="33" width="4" height="4" fill="#0f172a" />
        <rect x="43" y="40" width="10" height="2.5" rx="1" fill="#92400e" />
        <rect x="33" y="48" width="30" height="20" rx="3" fill="#10b981" stroke="#065f46" strokeWidth="1.5" />
        <rect x="26" y="50" width="7" height="14" rx="2" fill="#fcd34d" /><rect x="63" y="50" width="7" height="14" rx="2" fill="#fcd34d" />
        
        <circle cx="26" cy="20" r="2" fill="#fde68a" /><circle cx="72" cy="16" r="1.5" fill="#fde68a" />
      </>
    ),
  },
  english: {
    tile: ["#4c1d95", "#9f1239"],
    art: (
      <>
        <path d="M10 26 Q30 18 48 28 Q66 18 86 26 V74 Q66 66 48 76 Q30 66 10 74z" fill="#fef3c7" stroke="#92400e" strokeWidth="2" />
        <line x1="48" y1="28" x2="48" y2="76" stroke="#92400e" strokeWidth="2" />
        {[36, 44, 52, 60].map((y) => <g key={y}><line x1="17" y1={y} x2="42" y2={y - 3} stroke="#a16207" strokeOpacity=".6" /><line x1="55" y1={y - 3} x2="80" y2={y} stroke="#a16207" strokeOpacity=".6" /></g>)}
        <text x="19" y="52" fontSize="15" fontWeight="800" fill="#be123c" fontFamily="Georgia,serif">Aa</text>
        <path d="M70 12 L84 36 L76 40 L62 18z" fill="#f8fafc" stroke="#cbd5e1" /><path d="M76 40 L73 50 L80 44z" fill="#334155" />
      </>
    ),
  },
  geography: {
    tile: ["#075985", "#115e59"],
    art: (
      <>
        <circle cx="48" cy="48" r="36" fill="#0369a1" stroke="#7dd3fc" strokeWidth="2.5" />
        <path d="M24 38 q8 -12 20 -8 q6 6 -2 12 q-8 2 -10 10 q-8 -2 -8 -14z" fill="#22c55e" />
        <path d="M54 54 q12 -6 16 6 q-2 12 -12 14 q-6 -8 -4 -20z" fill="#22c55e" />
        {/* Caribbean island arc */}
        {[[40, 62], [46, 64], [52, 66], [58, 70]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="2.8" fill="#fbbf24" stroke="#fff" strokeWidth=".8" />)}
        <ellipse cx="48" cy="48" rx="36" ry="12" fill="none" stroke="#e0f2fe" strokeOpacity=".5" />
        <ellipse cx="48" cy="48" rx="14" ry="36" fill="none" stroke="#e0f2fe" strokeOpacity=".5" />
        <circle cx="36" cy="32" r="8" fill="#fff" opacity=".12" />
      </>
    ),
  },
  science: {
    tile: ["#134e4a", "#4c1d95"],
    art: (
      <>
        <path d="M34 12 h18 v20 l16 34 q4 10 -6 10 H24 q-10 0 -6 -10 l16 -34z" fill="#e0f2fe" opacity=".25" stroke="#e0f2fe" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M27 58 H59 l9 20 q2 4 -3 4 H21 q-5 0 -3 -4z" fill="#a855f7" opacity=".85" />
        <circle cx="38" cy="50" r="3" fill="#e9d5ff" /><circle cx="48" cy="42" r="2.4" fill="#e9d5ff" /><circle cx="44" cy="30" r="2" fill="#e9d5ff" opacity=".8" />
        <rect x="30" y="10" width="26" height="5" rx="2" fill="#e0f2fe" />
        <circle cx="76" cy="26" r="9" fill="none" stroke="#fbbf24" strokeWidth="2" /><circle cx="76" cy="26" r="2.5" fill="#fbbf24" />
        <ellipse cx="76" cy="26" rx="9" ry="3.5" fill="none" stroke="#fbbf24" strokeWidth="1.4" transform="rotate(60 76 26)" />
      </>
    ),
  },
  it: {
    tile: ["#1e1b4b", "#0e7490"],
    art: (
      <>
        <rect x="8" y="14" width="80" height="54" rx="6" fill="#020617" stroke="#22d3ee" strokeWidth="2.5" />
        <rect x="14" y="20" width="68" height="42" rx="2" fill="#0f172a" />
        <text x="18" y="46" fontSize="22" fontWeight="800" fill="#22d3ee" fontFamily="ui-monospace,monospace">{"</>"}</text>
        <rect x="18" y="52" width="26" height="3" rx="1.5" fill="#4ade80" /><rect x="48" y="52" width="16" height="3" rx="1.5" fill="#fbbf24" />
        <rect x="38" y="68" width="20" height="8" fill="#334155" /><rect x="28" y="76" width="40" height="6" rx="3" fill="#475569" />
      </>
    ),
  },
  business: {
    tile: ["#78350f", "#1e3a8a"],
    art: (
      <>
        <rect x="12" y="20" width="44" height="56" rx="4" fill="#fef3c7" stroke="#92400e" strokeWidth="2" />
        {[32, 42, 52, 62].map((y) => <g key={y}><line x1="18" y1={y} x2="38" y2={y} stroke="#a16207" strokeOpacity=".6" /><line x1="42" y1={y} x2="50" y2={y} stroke="#15803d" strokeWidth="2" /></g>)}
        <text x="18" y="29" fontSize="8" fontWeight="800" fill="#92400e" fontFamily="system-ui,sans-serif">LEDGER</text>
        {[[66, 70], [66, 63], [66, 56]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx="14" ry="5.5" fill="#fbbf24" stroke="#92400e" strokeWidth="1.5" />)}
        <ellipse cx="66" cy="49" rx="14" ry="5.5" fill="#fde68a" stroke="#92400e" strokeWidth="1.5" /><text x="62" y="52" fontSize="9" fontWeight="800" fill="#92400e">$</text>
      </>
    ),
  },

  /* ───────── Arcade mini-games ───────── */
  mental_maths: {
    tile: ["#7c2d12", "#312e81"],
    art: (
      <>
        <rect x="22" y="8" width="52" height="80" rx="9" fill="#1e293b" stroke="#fb923c" strokeWidth="2.5" />
        <rect x="29" y="15" width="38" height="16" rx="3" fill="#052e16" /><text x="62" y="28" textAnchor="end" fontSize="13" fontWeight="800" fill="#4ade80" fontFamily="ui-monospace,monospace">42</text>
        {["+", "−", "×", "÷", "7", "8", "9", "="].map((s, i) => (
          <g key={i}><rect x={29 + (i % 4) * 10} y={38 + Math.floor(i / 4) * 14} width="8.5" height="11" rx="2.5" fill={i < 4 ? "#fb923c" : i === 7 ? "#22d3ee" : "#475569"} /><text x={33.25 + (i % 4) * 10} y={46.2 + Math.floor(i / 4) * 14} textAnchor="middle" fontSize="7.5" fontWeight="800" fill="#fff">{s}</text></g>
        ))}
        <rect x="29" y="68" width="38" height="12" rx="3" fill="#22d3ee" opacity=".25" />
      </>
    ),
  },
  number_sequence: {
    tile: ["#164e63", "#4c1d95"],
    art: (
      <>
        {[["2", 6], ["4", 29], ["6", 52]].map(([t, x]) => (
          <g key={t as string}><rect x={x as number} y="34" width="22" height="26" rx="5" fill="#0f172a" stroke="#22d3ee" strokeWidth="2" /><text x={(x as number) + 11} y="53" textAnchor="middle" fontSize="16" fontWeight="800" fill="#e0f2fe" fontFamily="system-ui,sans-serif">{t}</text></g>
        ))}
        <rect x="75" y="34" width="16" height="26" rx="5" fill="#f59e0b" stroke="#fde68a" strokeWidth="2" strokeDasharray="3 2" /><text x="83" y="53" textAnchor="middle" fontSize="16" fontWeight="800" fill="#1e293b">?</text>
        <path d="M17 28 q6 -10 12 0 M40 28 q6 -10 12 0 M63 28 q6 -10 12 0" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
        <text x="12" y="76" fontSize="9" fontWeight="800" fill="#fbbf24" fontFamily="system-ui,sans-serif">+2   +2   +2</text>
      </>
    ),
  },
  fraction_face_off: {
    tile: ["#831843", "#1e3a8a"],
    art: (
      <>
        <circle cx="26" cy="46" r="20" fill="#0f172a" stroke="#f472b6" strokeWidth="2" /><path d="M26 46 L26 26 A20 20 0 1 1 8.7 56z" fill="#f472b6" /><text x="26" y="82" textAnchor="middle" fontSize="11" fontWeight="800" fill="#fbcfe8" fontFamily="system-ui,sans-serif">3/4</text>
        <circle cx="70" cy="46" r="20" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" /><path d="M70 46 L70 26 A20 20 0 0 1 87.3 56z" fill="#38bdf8" /><text x="70" y="82" textAnchor="middle" fontSize="11" fontWeight="800" fill="#bae6fd" fontFamily="system-ui,sans-serif">1/3</text>
        <path d="M44 38 l8 8 -8 8" fill="none" stroke="#fbbf24" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" /><text x="48" y="22" textAnchor="middle" fontSize="12" fontWeight="900" fill="#fbbf24">&gt;</text>
      </>
    ),
  },
  coin_counter: {
    tile: ["#713f12", "#14532d"],
    art: (
      <>
        {[[30, 70], [30, 63], [30, 56], [30, 49]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx="18" ry="6.5" fill="#fbbf24" stroke="#92400e" strokeWidth="1.8" />)}
        <ellipse cx="30" cy="42" rx="18" ry="6.5" fill="#fde68a" stroke="#92400e" strokeWidth="1.8" />
        <circle cx="68" cy="60" r="16" fill="#d1d5db" stroke="#6b7280" strokeWidth="2" /><text x="68" y="66" textAnchor="middle" fontSize="16" fontWeight="900" fill="#374151" fontFamily="system-ui,sans-serif">10¢</text>
        <circle cx="72" cy="28" r="11" fill="#b45309" stroke="#78350f" strokeWidth="2" /><text x="72" y="33" textAnchor="middle" fontSize="12" fontWeight="900" fill="#fef3c7" fontFamily="system-ui,sans-serif">5¢</text>
        <path d="M18 24 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill="#fff" opacity=".8" />
      </>
    ),
  },
  spelling_spotter: {
    tile: ["#365314", "#1e3a8a"],
    art: (
      <>
        <rect x="8" y="22" width="66" height="30" rx="6" fill="#0f172a" stroke="#a3e635" strokeWidth="2" />
        <text x="41" y="44" textAnchor="middle" fontSize="19" fontWeight="800" fill="#ecfccb" fontFamily="Georgia,serif" letterSpacing="3">ABC</text>
        <circle cx="58" cy="58" r="19" fill="#38bdf8" fillOpacity=".25" stroke="#e0f2fe" strokeWidth="4" />
        <line x1="72" y1="72" x2="88" y2="88" stroke="#f59e0b" strokeWidth="7" strokeLinecap="round" />
        <path d="M49 58 l6 6 11 -12" fill="none" stroke="#4ade80" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  word_unscramble: {
    tile: ["#701a75", "#0e7490"],
    art: (
      <>
        {[["T", 6, 20, -10], ["A", 30, 12, 6], ["C", 54, 22, -4], ["S", 18, 52, 8], ["R", 44, 56, -8], ["E", 66, 50, 10]].map(([t, x, y, r]) => (
          <g key={t as string} transform={`rotate(${r} ${(x as number) + 12} ${(y as number) + 12})`}>
            <rect x={x as number} y={y as number} width="24" height="24" rx="5" fill="#fef3c7" stroke="#b45309" strokeWidth="2" /><text x={(x as number) + 12} y={(y as number) + 18} textAnchor="middle" fontSize="16" fontWeight="900" fill="#7c2d12" fontFamily="system-ui,sans-serif">{t}</text>
          </g>
        ))}
        <path d="M80 86 q10 -2 10 -12 M84 78 l6 -4 4 6" fill="none" stroke="#f0abfc" strokeWidth="2.5" strokeLinecap="round" />
      </>
    ),
  },
  odd_one_out: {
    tile: ["#1e3a8a", "#9a3412"],
    art: (
      <>
        {[[8, 14], [38, 14], [8, 48]].map(([x, y], i) => <circle key={i} cx={x + 11} cy={y + 11} r="11" fill="#38bdf8" stroke="#e0f2fe" strokeWidth="2" />)}
        <circle cx="49" cy="59" r="11" fill="#38bdf8" stroke="#e0f2fe" strokeWidth="2" />
        <polygon points="76,10 90,36 62,36" fill="#f59e0b" stroke="#fef3c7" strokeWidth="2.5" />
        <circle cx="76" cy="23" r="12" fill="#fbbf24" opacity=".2" />
        <path d="M60 70 q14 14 28 -2" fill="none" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" /><polygon points="86,62 92,70 82,72" fill="#fbbf24" />
        <text x="76" y="30" textAnchor="middle" fontSize="12" fontWeight="900" fill="#7c2d12">!</text>
      </>
    ),
  },
  percent_sprint: {
    tile: ["#7f1d1d", "#1e1b4b"],
    art: (
      <>
        {[22, 34, 46, 58, 70].map((y, i) => <line key={y} x1={4 + (i % 2) * 6} y1={y} x2={34 - (i % 2) * 4} y2={y} stroke="#fca5a5" strokeWidth="3" strokeLinecap="round" opacity={0.9 - i * 0.12} />)}
        <circle cx="62" cy="46" r="29" fill="#0f172a" stroke="#fb7185" strokeWidth="3" />
        <text x="62" y="59" textAnchor="middle" fontSize="38" fontWeight="900" fill="#fda4af" fontFamily="system-ui,sans-serif">%</text>
        <path d="M66 14 l-8 16 h8 l-6 16 14 -20 h-9 l7 -12z" fill="#fbbf24" stroke="#fff" strokeWidth="1" />
      </>
    ),
  },
  star_counter: {
    tile: ["#1e1b4b", "#0f172a"],
    art: (
      <>
        {[[16, 22, 11], [46, 14, 14], [76, 26, 10], [26, 56, 14], [60, 62, 12], [82, 70, 8]].map(([x, y, r], i) => (
          <polygon key={i} points={Array.from({ length: 10 }, (_, k) => { const a = (Math.PI / 5) * k - Math.PI / 2; const rr = k % 2 ? (r as number) * 0.45 : (r as number); return `${((x as number) + rr * Math.cos(a)).toFixed(1)},${((y as number) + rr * Math.sin(a)).toFixed(1)}`; }).join(" ")} fill="#fbbf24" stroke="#fff7ed" strokeWidth="1.2" />
        ))}
        <circle cx="12" cy="80" r="2" fill="#7dd3fc" /><circle cx="40" cy="84" r="1.5" fill="#7dd3fc" /><circle cx="90" cy="50" r="1.6" fill="#7dd3fc" />
        <rect x="30" y="76" width="34" height="14" rx="7" fill="#0ea5e9" /><text x="47" y="86.5" textAnchor="middle" fontSize="10" fontWeight="900" fill="#fff" fontFamily="system-ui,sans-serif">×6</text>
      </>
    ),
  },
  memory_flash: {
    tile: ["#4c1d95", "#0c4a6e"],
    art: (
      <>
        <path d="M48 16 C30 6 8 16 10 36 C4 44 8 60 22 62 C24 76 42 84 48 78 C54 84 72 76 74 62 C88 60 92 44 86 36 C88 16 66 6 48 16z" fill="#a78bfa" stroke="#ede9fe" strokeWidth="2.5" />
        <path d="M48 16 V78 M30 30 q8 6 18 0 M66 30 q-8 6 -18 0 M26 50 q10 6 22 0 M70 50 q-10 6 -22 0" fill="none" stroke="#4c1d95" strokeWidth="2.2" strokeLinecap="round" />
        <polygon points="60,6 50,28 60,28 52,48 74,22 63,22 71,6" fill="#fbbf24" stroke="#fff" strokeWidth="1.2" />
        <text x="26" y="48" fontSize="11" fontWeight="900" fill="#ede9fe" fontFamily="ui-monospace,monospace">3 7 1</text>
      </>
    ),
  },
};
