'use client';
import { useState } from 'react';
type Tutor = { name: string; subject: string; price: number; rating: string };
export default function TutorBookingModal({ tutor, onClose }: { tutor: Tutor | null; onClose: () => void }) {
  const [pod, setPod] = useState('1-on-1');
  const [status, setStatus] = useState('');
  if (!tutor) return null;
  const activeTutor = tutor;
  async function checkout() {
    setStatus('Creating secure Stripe Connect checkout…');
    try {
      const response = await fetch('/api/stripe/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tutor: activeTutor.name, subject: activeTutor.subject, pod, amount: activeTutor.price * (pod === 'group' ? 3 : 1) }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Checkout unavailable');
      if (body.url) window.location.href = body.url; else setStatus('Checkout session created.');
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Checkout unavailable'); }
  }
  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-5 backdrop-blur-sm"><div className="w-full max-w-md rounded-[2rem] bg-[#f3f1ea] p-6"><div className="flex justify-between"><div><p className="eyebrow">Ambassador tutor</p><h2 className="mt-2 text-3xl font-black tracking-[-.06em]">Book {activeTutor.name}</h2></div><button onClick={onClose} className="rounded-full bg-black/5 px-3 py-1 font-bold">×</button></div><p className="mt-4 text-sm text-black/55">{activeTutor.subject} · {activeTutor.rating} rating · ${activeTutor.price} per session</p><div className="mt-7 grid grid-cols-2 gap-2">{['1-on-1', 'group'].map((type) => <button key={type} onClick={() => setPod(type)} className={`rounded-2xl border px-4 py-4 text-sm font-bold ${pod === type ? 'border-black bg-black text-white' : 'border-black/10'}`}>{type === 'group' ? 'Group avatar pod' : '1-on-1 classroom'}</button>)}</div><div className="mt-6 rounded-2xl bg-white/65 p-4"><div className="flex justify-between text-sm"><span>Session</span><strong>${activeTutor.price * (pod === 'group' ? 3 : 1)}</strong></div><div className="mt-2 flex justify-between text-xs text-black/50"><span>Platform commission</span><span>19.3%</span></div><div className="mt-1 flex justify-between text-xs text-black/50"><span>Ambassador payout</span><span>80.7%</span></div></div><button onClick={checkout} className="mt-6 w-full rounded-full bg-black px-4 py-3 text-sm font-bold text-white">Continue to secure checkout</button>{status && <p className="mt-4 text-sm font-bold text-[#7f9600]" role="status">{status}</p>}</div></div>;
}
