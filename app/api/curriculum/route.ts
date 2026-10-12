import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase-admin';
export const dynamic = 'force-dynamic';
type SeedSubject = { code: string; name: string; description: string };
type SeedModule = { subject_code: string; title: string; summary: string; sort_order?: number };
type SeedTopic = { module_title: string; title: string; kind?: 'lesson' | 'video' | 'quiz' | 'project'; resource_url?: string; sort_order?: number };
const fallbackSubjects: SeedSubject[] = [
  { code: 'MATH', name: 'Mathematics', description: 'Core quantitative reasoning and problem solving.' },
  { code: 'PHYS', name: 'Physics', description: 'Motion, energy, forces, and practical investigation.' },
  { code: 'ENGLISH', name: 'English', description: 'Reading, writing, argument, and communication.' },
  { code: 'IT', name: 'Information Technology', description: 'Digital systems, citizenship, and computing.' },
  { code: 'CHEM', name: 'Chemistry', description: 'Matter, reactions, laboratory reasoning, and safety.' },
  { code: 'BIO', name: 'Biology', description: 'Living systems, health, ecology, and evidence.' },
];
const fallbackModules = fallbackSubjects.map((subject, index) => ({ id: `fallback-module-${subject.code}`, subject_id: `fallback-${subject.code}`, title: index === 0 ? 'Functions & graphs' : `${subject.name} foundations`, summary: subject.description, sort_order: 0 }));
const fallbackTopics = fallbackModules.map((module, index) => ({ id: `fallback-topic-${index}`, module_id: module.id, title: index === 0 ? 'Reading graphs and relationships' : 'Core concepts and evidence', kind: 'lesson' }));
export async function GET() {
  try {
    const [subjects, modules, topics] = await Promise.all([
      supabaseAdmin.from('curriculum_subjects').select('*').order('name'),
      supabaseAdmin.from('curriculum_modules').select('*').order('sort_order').order('title'),
      supabaseAdmin.from('curriculum_topics').select('*').order('sort_order').order('title'),
    ]);
    const hasDatabaseContent = !subjects.error && !modules.error && !topics.error && Boolean(subjects.data?.length);
    return NextResponse.json({ source: hasDatabaseContent ? 'database' : 'fallback', subjects: hasDatabaseContent ? subjects.data : fallbackSubjects, modules: hasDatabaseContent ? modules.data : fallbackModules, topics: hasDatabaseContent ? topics.data : fallbackTopics });
  } catch {
    return NextResponse.json({ source: 'fallback', subjects: fallbackSubjects, modules: fallbackModules, topics: fallbackTopics });
  }
}
export async function POST(request: Request) {
  try { await requireAdmin(); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  const body = await request.json().catch(() => ({}));
  const action = body.action === 'seed' ? 'seed' : 'create';
  if (action === 'seed') {
    const { error } = await supabaseAdmin.from('curriculum_subjects').upsert(fallbackSubjects, { onConflict: 'code' });
    if (error) return NextResponse.json({ error: 'Apply migration 006_curriculum_content.sql before seeding.' }, { status: 503 });
    return NextResponse.json({ ok: true, seeded: fallbackSubjects.length });
  }
  const kind = body.kind;
  if (kind === 'subject') {
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : ''; const name = typeof body.name === 'string' ? body.name.trim() : ''; const description = typeof body.description === 'string' ? body.description.trim() : '';
    if (!/^[A-Z0-9_-]{2,24}$/.test(code) || !name || name.length > 100) return NextResponse.json({ error: 'Valid subject code and name are required.' }, { status: 400 });
    const { data, error } = await supabaseAdmin.from('curriculum_subjects').insert({ code, name, description }).select().single(); if (error) return NextResponse.json({ error: 'Unable to create subject.' }, { status: 503 }); return NextResponse.json({ subject: data });
  }
  if (kind === 'module') {
    const subjectId = typeof body.subject_id === 'string' ? body.subject_id : ''; const title = typeof body.title === 'string' ? body.title.trim() : ''; const summary = typeof body.summary === 'string' ? body.summary.trim() : '';
    if (!subjectId || !title || title.length > 160) return NextResponse.json({ error: 'Subject and module title are required.' }, { status: 400 });
    const { data, error } = await supabaseAdmin.from('curriculum_modules').insert({ subject_id: subjectId, title, summary, sort_order: Number(body.sort_order) || 0 }).select().single(); if (error) return NextResponse.json({ error: 'Unable to create module.' }, { status: 503 }); return NextResponse.json({ module: data });
  }
  if (kind === 'topic') {
    const moduleId = typeof body.module_id === 'string' ? body.module_id : ''; const title = typeof body.title === 'string' ? body.title.trim() : ''; const topicKind = ['lesson', 'video', 'quiz', 'project'].includes(body.topic_kind) ? body.topic_kind : 'lesson';
    if (!moduleId || !title || title.length > 180) return NextResponse.json({ error: 'Module and topic title are required.' }, { status: 400 });
    const { data, error } = await supabaseAdmin.from('curriculum_topics').insert({ module_id: moduleId, title, kind: topicKind, resource_url: typeof body.resource_url === 'string' ? body.resource_url.trim() || null : null, sort_order: Number(body.sort_order) || 0 }).select().single(); if (error) return NextResponse.json({ error: 'Unable to create topic.' }, { status: 503 }); return NextResponse.json({ topic: data });
  }
  return NextResponse.json({ error: 'Supported kinds: subject, module, topic.' }, { status: 400 });
}
