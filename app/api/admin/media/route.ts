import { NextRequest, NextResponse } from 'next/server';
import { uploadIntroVideo } from '@/app/admin/actions';
export const runtime = 'nodejs';
export async function POST(request: NextRequest) { try { const result = await uploadIntroVideo(await request.formData()); return NextResponse.json(result); } catch (error) { const message = error instanceof Error ? error.message : 'Upload failed'; const status = message === 'Admin access required' ? 403 : 400; return NextResponse.json({ error: message }, { status }); } }
