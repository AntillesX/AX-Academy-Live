import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { READY_CSEC_NODES, READY_CSEC_MODULES, READY_CSEC_SUBJECTS, READY_CSEC_TOPICS } from '@/lib/csec-curriculum';
export const dynamic = 'force-dynamic';

type Subject = typeof READY_CSEC_SUBJECTS[number];
type Module = typeof READY_CSEC_MODULES[number];
type Topic = typeof READY_CSEC_TOPICS[number];
type Node = typeof READY_CSEC_NODES[number];
function fallbackPayload() { return { source: 'fallback', subjects: READY_CSEC_SUBJECTS, modules: READY_CSEC_MODULES, topics: READY_CSEC_TOPICS, nodes: READY_CSEC_NODES }; }
function isCompleteTree(subject: Subject, modules: Module[], topics: Topic[], nodes: Node[]) {
  const subjectModules = modules.filter(module => module.subject_id === subject.id);
  if (!subject.is_published || subject.completion_percent !== 100 || !subjectModules.length || subjectModules.some(module => !module.is_complete)) return false;
  const subjectTopics = topics.filter(topic => subjectModules.some(module => module.id === topic.module_id));
  return subjectTopics.length > 0 && subjectTopics.every(topic => topic.is_complete && nodes.some(node => node.topic_id === topic.id && node.node_type === 'quiz' && node.is_complete));
}
export async function GET(request: Request) {
  const includeUnpublished = new URL(request.url).searchParams.get('include_unpublished') === '1';
  if (includeUnpublished) { try { await requireAdmin(); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); } }
  try {
    const [subjectsResult, modulesResult, topicsResult, nodesResult] = await Promise.all([
      supabaseAdmin.from('curriculum_subjects').select('*').order('name'),
      supabaseAdmin.from('curriculum_modules').select('*').order('section_number').order('sort_order').order('title'),
      supabaseAdmin.from('curriculum_topics').select('*').order('sort_order').order('title'),
      supabaseAdmin.from('curriculum_topic_nodes').select('*').order('sort_order').order('title'),
    ]);
    if (subjectsResult.error || modulesResult.error || topicsResult.error || nodesResult.error || !subjectsResult.data?.length) throw new Error('Curriculum tables are not ready');
    const subjects = subjectsResult.data as Subject[]; const modules = modulesResult.data as Module[]; const topics = topicsResult.data as Topic[]; const nodes = nodesResult.data as Node[];
    if (includeUnpublished) return NextResponse.json({ source: 'database', subjects, modules, topics, nodes });
    const readySubjects = subjects.filter(subject => isCompleteTree(subject, modules, topics, nodes));
    if (!readySubjects.length) return NextResponse.json(fallbackPayload());
    const subjectIds = new Set(readySubjects.map(subject => subject.id)); const readyModules = modules.filter(module => subjectIds.has(module.subject_id)); const moduleIds = new Set(readyModules.map(module => module.id)); const readyTopics = topics.filter(topic => moduleIds.has(topic.module_id)); const topicIds = new Set(readyTopics.map(topic => topic.id));
    return NextResponse.json({ source: 'database', subjects: readySubjects, modules: readyModules, topics: readyTopics, nodes: nodes.filter(node => topicIds.has(node.topic_id)) });
  } catch { return NextResponse.json(fallbackPayload()); }
}
export async function POST(request: Request) {
  try { await requireAdmin(); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  const body = await request.json().catch(() => ({}));
  if (body.action === 'seed') {
    const { error } = await supabaseAdmin.from('curriculum_subjects').upsert(READY_CSEC_SUBJECTS.map(subject => ({ code: subject.code, name: subject.name, description: subject.description, is_published: false, completion_percent: 0, icon_key: subject.icon_key, accent: subject.accent })), { onConflict: 'code' });
    if (error) return NextResponse.json({ error: 'Apply migrations 006 and 007 before seeding.' }, { status: 503 });
    return NextResponse.json({ ok: true, message: 'Base subject records prepared. Apply migration 007 to load the complete Math and IT trees.' });
  }
  if (body.action === 'publish') {
    const id = typeof body.id === 'string' ? body.id : '';
    if (!id) return NextResponse.json({ error: 'Subject id is required.' }, { status: 400 });
    const [subjectResult, modulesResult, topicsResult, nodesResult] = await Promise.all([supabaseAdmin.from('curriculum_subjects').select('*').eq('id', id).single(), supabaseAdmin.from('curriculum_modules').select('*').eq('subject_id', id), supabaseAdmin.from('curriculum_topics').select('*'), supabaseAdmin.from('curriculum_topic_nodes').select('*')]);
    if (subjectResult.error || modulesResult.error || topicsResult.error || nodesResult.error) return NextResponse.json({ error: 'Unable to audit curriculum tree.' }, { status: 503 });
    const subject = subjectResult.data as Subject; if (!isCompleteTree(subject, modulesResult.data as Module[], topicsResult.data as Topic[], nodesResult.data as Node[])) return NextResponse.json({ error: 'Only a 100% complete module, topic, and quiz-node tree can be published.' }, { status: 422 });
    const { data, error } = await supabaseAdmin.from('curriculum_subjects').update({ is_published: true, completion_percent: 100 }).eq('id', id).select().single(); if (error) return NextResponse.json({ error: 'Unable to publish subject.' }, { status: 503 }); return NextResponse.json({ subject: data });
  }
  const kind = body.kind;
  if (kind === 'subject') {
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : ''; const name = typeof body.name === 'string' ? body.name.trim() : ''; const description = typeof body.description === 'string' ? body.description.trim() : ''; const iconKey = typeof body.icon_key === 'string' ? body.icon_key.trim() : 'science'; const accent = typeof body.accent === 'string' ? body.accent.trim() : 'cyan';
    if (!/^[A-Z0-9_-]{2,24}$/.test(code) || !name || name.length > 100) return NextResponse.json({ error: 'Valid subject code and name are required.' }, { status: 400 });
    const { data, error } = await supabaseAdmin.from('curriculum_subjects').insert({ code, name, description, icon_key: iconKey, accent, is_published: false, completion_percent: 0 }).select().single(); if (error) return NextResponse.json({ error: 'Unable to create subject.' }, { status: 503 }); return NextResponse.json({ subject: data });
  }
  if (kind === 'module') {
    const subjectId = typeof body.subject_id === 'string' ? body.subject_id : ''; const title = typeof body.title === 'string' ? body.title.trim() : ''; const summary = typeof body.summary === 'string' ? body.summary.trim() : '';
    if (!subjectId || !title || title.length > 160) return NextResponse.json({ error: 'Subject and module title are required.' }, { status: 400 });
    const { data, error } = await supabaseAdmin.from('curriculum_modules').insert({ subject_id: subjectId, title, summary, code: typeof body.code === 'string' ? body.code.trim() : `module_${Date.now()}`, section_number: Number(body.section_number) || 0, is_complete: false }).select().single(); if (error) return NextResponse.json({ error: 'Unable to create module.' }, { status: 503 }); return NextResponse.json({ module: data });
  }
  if (kind === 'topic') {
    const moduleId = typeof body.module_id === 'string' ? body.module_id : ''; const title = typeof body.title === 'string' ? body.title.trim() : ''; const topicKind = ['lesson', 'video', 'quiz', 'project'].includes(body.topic_kind) ? body.topic_kind : 'lesson';
    if (!moduleId || !title || title.length > 180) return NextResponse.json({ error: 'Module and topic title are required.' }, { status: 400 });
    const code = typeof body.code === 'string' ? body.code.trim() : `topic_${Date.now()}`; const { data, error } = await supabaseAdmin.from('curriculum_topics').insert({ module_id: moduleId, code, title, kind: topicKind, lesson_text: typeof body.lesson_text === 'string' ? body.lesson_text : '', worked_solution: typeof body.worked_solution === 'string' ? body.worked_solution : '', diagnostic_quiz: Array.isArray(body.diagnostic_quiz) ? body.diagnostic_quiz : [], antx_reward_trigger: typeof body.antx_reward_trigger === 'string' ? body.antx_reward_trigger : 'ANTX micro-drop after a verified academic milestone.', is_complete: false, sort_order: Number(body.sort_order) || 0 }).select().single(); if (error) return NextResponse.json({ error: 'Unable to create topic.' }, { status: 503 }); return NextResponse.json({ topic: data });
  }
  return NextResponse.json({ error: 'Supported actions: seed, publish; kinds: subject, module, topic.' }, { status: 400 });
}
