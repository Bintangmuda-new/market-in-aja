// ============================================================
// Market-In Aja — Supabase Storage Helpers
// Images are compressed on-device before upload.
// ============================================================
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from './client';
import { MAX_IMAGE_WIDTH_PX, MAX_IMAGE_QUALITY } from '@constants/index';

export async function compressAndUploadImage(
  localUri: string,
  bucket: 'product-images' | 'avatars',
  filePath: string,
): Promise<string> {
  // 1. Compress on the client side to save mobile data
  const compressed = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: MAX_IMAGE_WIDTH_PX } }],
    { compress: MAX_IMAGE_QUALITY, format: ImageManipulator.SaveFormat.JPEG },
  );

  // 2. Fetch as blob
  const response = await fetch(compressed.uri);
  const blob = await response.blob();

  // 3. Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, blob, {
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (error) throw new Error(`[Storage] Upload failed: ${error.message}`);

  // 4. Return the public URL
  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
  return urlData.publicUrl;
}
