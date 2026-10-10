'use client';
import { useEffect, useRef, useState } from 'react';

export type Island = { id: string; name: string; capital: string; x: number; y: number; tint: string };
export type Property = { id: string; type: 'Airport' | 'Library' | 'Internet Cafe' | 'Island Academy' | 'Avatar Store'; name: string; x: number; y: number; lessee: string; yieldRate: string };
export const islands: Island[] = [
  { id: 'svg', name: 'St. Vincent & the Grenadines', capital: 'Kingstown', x: 43, y: 53, tint: '#d8ff45' },
  { id: 'barbados', name: 'Barbados', capital: 'Bridgetown', x: 55, y: 63, tint: '#ffad9e' },
  { id: 'st-lucia', name: 'St. Lucia', capital: 'Castries', x: 50, y: 39, tint: '#b5c8ff' },
  { id: 'grenada', name: 'Grenada', capital: "St. George's", x: 34, y: 72, tint: '#d8ff45' },
  { id: 'antigua', name: 'Antigua', capital: "St. John's", x: 66, y: 20, tint: '#ffad9e' },
  { id: 'trinidad', name: 'Trinidad & Tobago', capital: 'Port of Spain', x: 22, y: 88, tint: '#b5c8ff' }
];
const propertyTemplates: Array<Property['type']> = ['Airport', 'Library', 'Internet Cafe', 'Island Academy', 'Avatar Store'];
export function propertiesFor(island: Island): Property[] { return propertyTemplates.map((type, index) => ({ id: `${island.id}-${index}`, type, name: `${island.capital} ${type}`, x: 22 + index * 14, y: 28 + (index % 2) * 30, lessee: index % 3 === 0 ? 'Open lease' : ['Maya Joseph', 'Kai Baptiste'][index % 2], yieldRate: `${(1.2 + index * 0.45).toFixed(2)}%` })); }

export default function IslandCanvas({ onSelectIsland, onSelectProperty }: { onSelectIsland?: (island: Island) => void; onSelectProperty?: (property: Property) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedId, setSelectedId] = useState('svg');
  const [zoom, setZoom] = useState(1);
  const offset = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastPoint = useRef({ x: 0, y: 0 });
  const selectedIsland = islands.find((island) => island.id === selectedId) || islands[0];
  const properties = propertiesFor(selectedIsland);

  useEffect(() => { onSelectIsland?.(selectedIsland); }, [selectedId, onSelectIsland, selectedIsland]);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    let frame = 0; let raf = 0;
    const draw = () => {
      const ratio = window.devicePixelRatio || 1; const width = canvas.clientWidth; const height = canvas.clientHeight;
      if (canvas.width !== width * ratio || canvas.height !== height * ratio) { canvas.width = width * ratio; canvas.height = height * ratio; }
      ctx.setTransform(ratio * zoom, 0, 0, ratio * zoom, offset.current.x * ratio, offset.current.y * ratio);
      ctx.fillStyle = '#08120f'; ctx.fillRect(-offset.current.x / zoom, -offset.current.y / zoom, width / zoom, height / zoom);
      ctx.strokeStyle = 'rgba(216,255,69,.14)'; ctx.lineWidth = 1 / zoom;
      for (let x = -100; x < width / zoom + 100; x += 48) { ctx.beginPath(); ctx.moveTo(x, -100); ctx.lineTo(x, height / zoom + 100); ctx.stroke(); }
      for (let y = -100; y < height / zoom + 100; y += 48) { ctx.beginPath(); ctx.moveTo(-100, y); ctx.lineTo(width / zoom + 100, y); ctx.stroke(); }
      const pulse = 5 + Math.sin(frame / 18) * 2;
      islands.forEach((island) => { const x = width * island.x / 100 / zoom; const y = height * island.y / 100 / zoom; const isSelected = island.id === selectedId; ctx.fillStyle = island.tint; ctx.globalAlpha = .2; ctx.beginPath(); ctx.ellipse(x, y, isSelected ? 42 : 27, isSelected ? 27 : 18, -.25, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = isSelected ? '#ffffff' : island.tint; ctx.lineWidth = (isSelected ? 2 : 1) / zoom; ctx.beginPath(); ctx.ellipse(x, y, isSelected ? 30 : 20, isSelected ? 19 : 13, -.25, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = island.tint; ctx.beginPath(); ctx.arc(x, y, isSelected ? 6 : 4, 0, Math.PI * 2); ctx.fill(); ctx.font = `${isSelected ? 12 : 10}px Arial`; ctx.fillStyle = '#ffffff'; ctx.fillText(island.capital, x + 10, y - 10); });
      for (let index = 0; index < 7; index++) { const x = (width * (.12 + index * .13) + Math.sin(frame / 60 + index) * 12) / zoom; const y = (height * (.2 + (index % 4) * .19) + Math.cos(frame / 48 + index) * 8) / zoom; ctx.fillStyle = index % 2 ? '#ffad9e' : '#b5c8ff'; ctx.globalAlpha = .85; ctx.beginPath(); ctx.arc(x, y, 4 + (index % 2) * 2, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
      const selectedX = width * selectedIsland.x / 100 / zoom; const selectedY = height * selectedIsland.y / 100 / zoom; ctx.strokeStyle = '#d8ff45'; ctx.globalAlpha = .45; ctx.beginPath(); ctx.arc(selectedX, selectedY, 24 + pulse, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; frame++; raf = requestAnimationFrame(draw);
    }; draw(); return () => cancelAnimationFrame(raf);
  }, [selectedId, zoom, selectedIsland]);
  function chooseIsland(event: React.MouseEvent<HTMLCanvasElement>) { const rect = event.currentTarget.getBoundingClientRect(); const x = ((event.clientX - rect.left - offset.current.x) / zoom) / rect.width * 100; const y = ((event.clientY - rect.top - offset.current.y) / zoom) / rect.height * 100; const closest = islands.map((island) => ({ island, distance: Math.hypot(island.x - x, island.y - y) })).sort((a, b) => a.distance - b.distance)[0]; if (closest.distance < 12) { setSelectedId(closest.island.id); onSelectIsland?.(closest.island); } }
  return <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#08120f]"><canvas ref={canvasRef} onClick={chooseIsland} onPointerDown={(event) => { dragging.current = true; lastPoint.current = { x: event.clientX, y: event.clientY }; }} onPointerMove={(event) => { if (!dragging.current) return; offset.current.x += event.clientX - lastPoint.current.x; offset.current.y += event.clientY - lastPoint.current.y; lastPoint.current = { x: event.clientX, y: event.clientY }; }} onPointerUp={() => { dragging.current = false; }} onWheel={(event) => { event.preventDefault(); setZoom((value) => Math.min(1.8, Math.max(.75, value + (event.deltaY > 0 ? -.08 : .08)))); }} className="h-[58vh] min-h-[420px] w-full touch-none cursor-grab" aria-label="Interactive Lesser Antilles map" /><div className="absolute right-5 top-5 flex gap-2"><button onClick={() => setZoom((value) => Math.min(1.8, value + .12))} className="map-control">+</button><button onClick={() => setZoom((value) => Math.max(.75, value - .12))} className="map-control">−</button><button onClick={() => { setZoom(1); offset.current = { x: 0, y: 0 }; }} className="map-control text-xs">Reset</button></div><div className="absolute bottom-5 left-5 max-w-[calc(100%-2.5rem)] rounded-2xl bg-black/55 px-4 py-3 text-white backdrop-blur"><p className="text-[10px] uppercase tracking-[.25em] text-[#d8ff45]">Selected capital</p><p className="mt-1 font-black">{selectedIsland.capital} · {selectedIsland.name}</p></div><div className="absolute bottom-5 right-5 flex max-w-[58%] gap-2 overflow-x-auto">{properties.map((property) => <button key={property.id} onClick={() => onSelectProperty?.(property)} className="whitespace-nowrap rounded-full border border-white/20 bg-black/60 px-3 py-2 text-[10px] font-bold text-white backdrop-blur hover:border-[#d8ff45]">{property.type}</button>)}</div></div>;
}
