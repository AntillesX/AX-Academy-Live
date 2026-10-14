'use client';
import { useEffect } from 'react';
import { flushMutations } from '@/lib/pwa/offlineSync';
export default function ServiceWorkerRegistrar() { useEffect(() => { if (!('serviceWorker' in navigator)) return; const flush = () => { void flushMutations(); }; const onMessage = (event: MessageEvent) => { if (event.data?.type === 'AX_FLUSH_MUTATIONS') flush(); }; navigator.serviceWorker.register('/sw.js').catch(() => undefined); navigator.serviceWorker.addEventListener('message', onMessage); window.addEventListener('online', flush); flush(); return () => { navigator.serviceWorker.removeEventListener('message', onMessage); window.removeEventListener('online', flush); }; }, []); return null; }
