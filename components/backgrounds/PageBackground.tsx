"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export type Theme = "home" | "courses" | "arcade" | "videos" | "community" | "default";

export function themeFor(pathname: string): Theme {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/curriculum")) return "courses";
  if (pathname.startsWith("/games")) return "arcade";
  if (pathname.startsWith("/videos")) return "videos";
  if (pathname.startsWith("/community") || pathname.startsWith("/emulator") || pathname.startsWith("/marketplace")) return "community";
  return "default";
}

/* All artwork is inline SVG + CSS gradients: zero image downloads, tiny payload, scales to any screen.
   Colours are kept dark and glows are kept away from the centre so text on top stays high-contrast. */

const BASE: Record<Theme, string> = {
  default: "radial-gradient(1200px 600px at 70% -10%, #0b1b3a 0%, #0a0f1d 45%, #020617 100%)",
  home: "linear-gradient(180deg, #020617 0%, #04223a 55%, #053b4a 100%)",
  courses: "linear-gradient(180deg, #05051a 0%, #0b1033 60%, #0e1b3d 100%)",
  arcade: "linear-gradient(180deg, #0a0020 0%, #1a0536 55%, #2a0a4a 100%)",
  videos: "radial-gradient(ellipse at 50% 0%, #1c1917 0%, #0a0a0a 55%, #000 100%)",
  community: "linear-gradient(180deg, #021a2b 0%, #053a3f 55%, #3a1a2e 100%)",
};

const svgProps = { className: "absolute inset-0 h-full w-full", preserveAspectRatio: "xMidYMid slice", viewBox: "0 0 1200 800", "aria-hidden": true, focusable: false } as const;

function Home() {
  const nodes: [number, number][] = [[120, 140], [300, 80], [470, 190], [650, 90], [840, 170], [1040, 100], [190, 330], [380, 400], [590, 330], [780, 420], [980, 330], [1120, 450]];
  const links = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [0, 6], [6, 7], [2, 7], [7, 8], [8, 3], [8, 9], [9, 4], [9, 10], [10, 5], [10, 11], [2, 8]];
  return (
    <svg {...svgProps}>
      <defs>
        <radialGradient id="hg-glow" cx="50%" cy="0%" r="80%"><stop offset="0" stopColor="#06b6d4" stopOpacity=".35" /><stop offset="1" stopColor="#06b6d4" stopOpacity="0" /></radialGradient>
        <linearGradient id="hg-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0891b2" stopOpacity="0" /><stop offset="1" stopColor="#0e7490" stopOpacity=".55" /></linearGradient>
      </defs>
      <rect width="1200" height="800" fill="url(#hg-glow)" />
      <g stroke="#22d3ee" strokeOpacity=".28" strokeWidth="1.2">{links.map(([a, b], i) => <line key={i} x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]} />)}</g>
      {nodes.map(([x, y], i) => (
        <g key={i}><circle cx={x} cy={y} r="14" fill="#22d3ee" opacity=".08" className="ax-pulse" style={{ animationDelay: `${(i % 5) * 0.7}s` }} /><circle cx={x} cy={y} r="4" fill="#67e8f9" opacity=".8" /></g>
      ))}
      {/* island silhouettes on the horizon */}
      <g fill="#021019" opacity=".9">
        <path d="M0 640 Q120 560 260 640 Z" /><path d="M300 650 Q420 590 560 650 Z" /><path d="M620 645 Q700 600 780 645 Z" /><path d="M860 650 Q990 570 1130 650 Z" />
      </g>
      <rect y="620" width="1200" height="180" fill="url(#hg-sea)" />
      {[660, 690, 720, 750].map((y, i) => <path key={y} d={`M0 ${y} q75 -14 150 0 t150 0 t150 0 t150 0 t150 0 t150 0 t150 0 t150 0`} fill="none" stroke="#67e8f9" strokeOpacity={0.2 - i * 0.03} strokeWidth="1.5" className="ax-drift" style={{ animationDelay: `${i * 0.8}s` }} />)}
    </svg>
  );
}

function Courses() {
  const shelf = [60, 90, 70, 110, 80, 100, 65, 95, 75, 105, 85, 70, 100, 90];
  return (
    <svg {...svgProps}>
      <defs>
        <pattern id="cg-grid" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M60 0H0V60" fill="none" stroke="#6366f1" strokeOpacity=".16" strokeWidth="1" /></pattern>
        <radialGradient id="cg-holo" cx="80%" cy="20%" r="45%"><stop offset="0" stopColor="#818cf8" stopOpacity=".3" /><stop offset="1" stopColor="#818cf8" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="1200" height="800" fill="url(#cg-grid)" /><rect width="1200" height="800" fill="url(#cg-holo)" />
      {/* floating atom */}
      {/* outer <g> positions it; inner <g> animates (a CSS transform would otherwise override the SVG attribute) */}
      <g transform="translate(960 190)"><g fill="none" stroke="#a5b4fc" strokeOpacity=".45" strokeWidth="2" className="ax-drift">
        <ellipse rx="90" ry="32" /><ellipse rx="90" ry="32" transform="rotate(60)" /><ellipse rx="90" ry="32" transform="rotate(120)" /><circle r="9" fill="#a5b4fc" fillOpacity=".5" />
      </g></g>
      {/* bookshelf wall along the bottom */}
      <rect y="650" width="1200" height="150" fill="#0b1033" opacity=".92" />
      {shelf.map((h, i) => <rect key={i} x={i * 86 + 6} y={650 - h * 0.9 + 60} width="38" height={h * 0.9} rx="2" fill={["#4338ca", "#0e7490", "#7c3aed", "#1d4ed8"][i % 4]} opacity=".55" />)}
      {shelf.map((h, i) => <rect key={`b${i}`} x={i * 86 + 46} y={650 - h * 0.7 + 60} width="30" height={h * 0.7} rx="2" fill={["#0891b2", "#6366f1", "#2563eb", "#9333ea"][i % 4]} opacity=".4" />)}
      <rect y="706" width="1200" height="8" fill="#38bdf8" opacity=".35" />
      {/* floating formula glyphs */}
      <g fill="#c7d2fe" opacity=".18" fontFamily="Georgia,serif" fontSize="40"><text x="90" y="170">E = mc²</text><text x="420" y="110">∑ aₙ</text><text x="690" y="260">H₂O</text></g>
    </svg>
  );
}

function Arcade() {
  const spokes = Array.from({ length: 15 }, (_, i) => i - 7);
  return (
    <svg {...svgProps}>
      <defs>
        <linearGradient id="ag-sun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f472b6" /><stop offset="1" stopColor="#f59e0b" /></linearGradient>
        <clipPath id="ag-sunclip"><rect x="400" y="120" width="400" height="260" /></clipPath>
      </defs>
      <g clipPath="url(#ag-sunclip)"><circle cx="600" cy="300" r="170" fill="url(#ag-sun)" opacity=".5" />{[250, 285, 315, 340].map((y, i) => <rect key={y} x="400" y={y} width="400" height={3 + i * 2} fill="#1a0536" />)}</g>
      {/* neon perspective floor */}
      <g stroke="#e879f9" strokeWidth="1.5" opacity=".6">
        {spokes.map((n) => <line key={n} x1={600} y1="380" x2={600 + n * 220} y2="800" />)}
        {[400, 425, 462, 515, 590, 700].map((y) => <line key={y} x1="0" y1={y} x2="1200" y2={y} />)}
      </g>
      <rect y="380" width="1200" height="2" fill="#22d3ee" opacity=".9" />
      {/* cabinets silhouettes */}
      {[[40, 300], [1010, 300]].map(([x, y]) => (
        <g key={x} transform={`translate(${x} ${y})`}><path d="M0 80 L30 0 H120 L150 80 V300 H0z" fill="#12082b" stroke="#22d3ee" strokeWidth="3" strokeOpacity=".7" /><rect x="22" y="40" width="106" height="80" rx="6" fill="#0e7490" opacity=".5" className="ax-pulse" /><circle cx="50" cy="170" r="9" fill="#f43f5e" /><circle cx="80" cy="170" r="9" fill="#facc15" /><rect x="100" y="164" width="22" height="12" rx="3" fill="#a3e635" /></g>
      ))}
      {Array.from({ length: 28 }, (_, i) => <circle key={i} cx={(i * 137) % 1200} cy={(i * 71) % 300} r={1 + (i % 3) * 0.7} fill="#fff" opacity=".6" className="ax-twinkle" style={{ animationDelay: `${(i % 7) * 0.4}s` }} />)}
    </svg>
  );
}

function Videos() {
  return (
    <svg {...svgProps}>
      <defs>
        <linearGradient id="vg-beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fbbf24" stopOpacity=".5" /><stop offset="1" stopColor="#fbbf24" stopOpacity="0" /></linearGradient>
        <pattern id="vg-film" width="28" height="40" patternUnits="userSpaceOnUse"><rect x="6" y="8" width="16" height="24" rx="3" fill="#000" /></pattern>
      </defs>
      {/* studio spotlights */}
      <polygon points="180,0 260,0 420,800 20,800" fill="url(#vg-beam)" opacity=".55" /><polygon points="940,0 1020,0 1180,800 780,800" fill="url(#vg-beam)" opacity=".55" />
      <polygon points="560,0 640,0 760,800 440,800" fill="#ef4444" opacity=".07" />
      {/* film strips down both sides */}
      <rect x="0" width="56" height="800" fill="#1c1917" /><rect x="0" width="56" height="800" fill="url(#vg-film)" />
      <rect x="1144" width="56" height="800" fill="#1c1917" /><rect x="1144" width="56" height="800" fill="url(#vg-film)" />
      {/* curtains */}
      <g opacity=".5">{Array.from({ length: 6 }, (_, i) => <rect key={i} x={56 + i * 14} width="8" height="800" fill="#7f1d1d" opacity={0.55 - i * 0.07} />)}{Array.from({ length: 6 }, (_, i) => <rect key={i} x={1136 - 56 - i * 14} width="8" height="800" fill="#7f1d1d" opacity={0.55 - i * 0.07} />)}</g>
      {/* ON AIR light and letterbox */}
      <g transform="translate(1030 36)"><rect width="104" height="34" rx="8" fill="#450a0a" stroke="#ef4444" strokeWidth="2" /><circle cx="18" cy="17" r="6" fill="#ef4444" className="ax-pulse" /><text x="32" y="23" fontSize="16" fontWeight="800" fill="#fca5a5" fontFamily="system-ui,sans-serif">ON AIR</text></g>
      <rect width="1200" height="38" fill="#000" opacity=".6" /><rect y="762" width="1200" height="38" fill="#000" opacity=".6" />
    </svg>
  );
}

function Community() {
  const hex = (cx: number, cy: number, r: number) => Array.from({ length: 6 }, (_, k) => `${(cx + r * Math.cos((Math.PI / 3) * k + Math.PI / 6)).toFixed(0)},${(cy + r * Math.sin((Math.PI / 3) * k + Math.PI / 6)).toFixed(0)}`).join(" ");
  const cells: [number, number][] = [[140, 120], [214, 162], [140, 204], [214, 246], [1020, 130], [1094, 172], [1020, 214], [1094, 256], [960, 560], [1034, 602]];
  return (
    <svg {...svgProps}>
      <defs>
        <linearGradient id="cm-sun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fbbf24" /><stop offset="1" stopColor="#f43f5e" /></linearGradient>
        <linearGradient id="cm-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#14b8a6" stopOpacity=".1" /><stop offset="1" stopColor="#0f766e" stopOpacity=".6" /></linearGradient>
      </defs>
      <path d="M410 520 A190 190 0 0 1 790 520 Z" fill="url(#cm-sun)" opacity=".6" />
      <rect y="520" width="1200" height="280" fill="url(#cm-sea)" />
      {[560, 600, 645, 700].map((y, i) => <path key={y} d={`M0 ${y} q60 -12 120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0`} fill="none" stroke="#5eead4" strokeOpacity={0.35 - i * 0.06} strokeWidth="2" className="ax-drift" style={{ animationDelay: `${i * 0.6}s` }} />)}
      {/* palms */}
      <g fill="#022c22" opacity=".95"><path d="M110 800 C120 650 130 560 150 470 l10 3 C145 560 140 660 140 800z" /><path d="M150 470 q-70 -20 -100 20 q50 -20 100 -4z M150 470 q-30 -50 -80 -50 q60 10 80 50z M150 470 q40 -50 90 -40 q-60 5 -90 40z M150 470 q70 -10 100 30 q-50 -20 -100 -30z" /></g>
      <g fill="#022c22" opacity=".95" transform="translate(940 40) scale(.9)"><path d="M110 800 C120 650 130 560 150 470 l10 3 C145 560 140 660 140 800z" /><path d="M150 470 q-70 -20 -100 20 q50 -20 100 -4z M150 470 q-30 -50 -80 -50 q60 10 80 50z M150 470 q40 -50 90 -40 q-60 5 -90 40z M150 470 q70 -10 100 30 q-50 -20 -100 -30z" /></g>
      {/* digital hub: hex cells */}
      {cells.map(([x, y], i) => <polygon key={i} points={hex(x, y, 42)} fill="#2dd4bf" fillOpacity=".06" stroke="#5eead4" strokeOpacity=".4" strokeWidth="2" className="ax-pulse" style={{ animationDelay: `${(i % 4) * 0.8}s` }} />)}
      <g fill="#fbbf24" opacity=".7">{[[300, 90], [520, 150], [760, 70], [880, 300], [60, 380]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3" className="ax-twinkle" style={{ animationDelay: `${i * 0.5}s` }} />)}</g>
    </svg>
  );
}

const ART: Record<Theme, ReactNode> = { default: null, home: <Home />, courses: <Courses />, arcade: <Arcade />, videos: <Videos />, community: <Community /> };

export default function PageBackground() {
  const theme = themeFor(usePathname());
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden" style={{ background: BASE[theme] }} data-theme={theme}>
      {ART[theme]}
      {/* Soft scrim so body text keeps contrast on top of any artwork */}
      <div className="absolute inset-0 bg-[#020617]/35" />
    </div>
  );
}
