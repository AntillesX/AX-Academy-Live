'use client';
import { useEffect, useState } from 'react';
export default function BroadcastBanner() { const [message, setMessage] = useState(''); useEffect(() => { fetch('/api/admin/broadcasts').then(r => r.ok ? r.json() : null).then(data => setMessage(data?.broadcast?.message || '')).catch(() => undefined); }, []); if (!message) return null; return <div className="border-b border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-center text-xs font-bold text-cyan-100">{message}</div>; }
