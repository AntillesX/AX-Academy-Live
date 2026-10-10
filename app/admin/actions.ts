'use server';
import { randomUUID } from 'crypto';
import { requireAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase-admin';
export async function uploadIntroVideo(formData: FormData) {
  const admin = await requireAdmin();
  const file = formData.get('file');
  if (!(file instanceof File) || file.type !== 'video/mp4') throw new Error('Only MP4 files are supported');
  if (file.size > 100 * 1024 * 1024) throw new Error('Video must be 100MB or smaller');
  const path = `intro/${randomUUID()}.mp4`;
  const upload = await supabaseAdmin.storage.from('platform-media').upload(path, Buffer.from(await file.arrayBuffer()), { contentType: 'video/mp4', cacheControl: '3600', upsert: false });
  if (upload.error) throw upload.error;
  const { data: publicUrl } = supabaseAdmin.storage.from('platform-media').getPublicUrl(path);
  await supabaseAdmin.from('media_assets').delete().eq('asset_type', 'intro_video');
  const { error } = await supabaseAdmin.from('media_assets').insert({ title: 'AntillesX intro video', file_url: publicUrl.publicUrl, asset_type: 'intro_video', uploaded_by: admin.userId });
  if (error) throw error;
  return { url: publicUrl.publicUrl };
}
