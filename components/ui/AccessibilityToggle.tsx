'use client';
import { useSyncExternalStore } from 'react';

type Preference = 'system' | 'on' | 'off';
const KEY = 'ax.a11y.reducedMotion.v1';
let preference: Preference = 'system'; let systemReduced = false; let initialized = false;
const listeners = new Set<() => void>();
function init() { if (initialized || typeof window === 'undefined') return; initialized = true; try { const saved = localStorage.getItem(KEY); if (saved === 'on' || saved === 'off' || saved === 'system') preference = saved; } catch {} const media = window.matchMedia('(prefers-reduced-motion: reduce)'); systemReduced = media.matches; media.addEventListener('change', event => { systemReduced = event.matches; listeners.forEach(listener => listener()); }); }
const isReduced = () => { init(); return preference === 'on' || (preference === 'system' && systemReduced); };
export const motion = { isReduced, allowFlash: () => !isReduced(), allowLightning: () => !isReduced(), shakeScale: () => isReduced() ? 0 : 1, subscribe: (callback: () => void) => { init(); listeners.add(callback); return () => listeners.delete(callback); } };
export function useReducedMotion() { return useSyncExternalStore(motion.subscribe, motion.isReduced, () => false); }
export default function AccessibilityToggle({ className = '' }: { className?: string }) { const reduced = useReducedMotion(); return <button type="button" role="switch" aria-checked={reduced} className={className} onClick={() => { const next: Preference = reduced ? 'off' : 'on'; preference = next; try { localStorage.setItem(KEY, next); } catch {} listeners.forEach(listener => listener()); }}>{reduced ? 'Reduced motion: On' : 'Reduced motion: Off'}</button>; }
