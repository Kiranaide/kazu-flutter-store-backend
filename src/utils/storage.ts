import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

export const initializeSupabase = (
  supabaseUrl: string,
  supabaseKey: string
): SupabaseClient => {
  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return supabaseClient;
};

export const getSupabaseClient = (): SupabaseClient => {
  if (!supabaseClient) {
    throw new Error('Supabase client not initialized. Call initializeSupabase first.');
  }
  return supabaseClient;
};

export interface UploadResult {
  path: string;
  publicUrl: string;
}

export const uploadFile = async (
  bucketName: string,
  filePath: string,
  file: File | Buffer | ArrayBuffer,
  contentType?: string
): Promise<UploadResult> => {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(filePath, file, {
      contentType,
      upsert: true,
    });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  const publicUrl = generatePublicUrl(bucketName, data.path);

  return {
    path: data.path,
    publicUrl,
  };
};

export const deleteFile = async (
  bucketName: string,
  filePath: string
): Promise<void> => {
  const supabase = getSupabaseClient();

  const { error } = await supabase.storage.from(bucketName).remove([filePath]);

  if (error) {
    throw new Error(`Delete failed: ${error.message}`);
  }
};

export const generatePublicUrl = (bucketName: string, filePath: string): string => {
  const supabase = getSupabaseClient();

  const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath);

  return data.publicUrl;
};

export const uploadProductImage = async (
  file: File | Buffer | ArrayBuffer,
  productId: string,
  fileName: string,
  contentType?: string
): Promise<UploadResult> => {
  const bucketName = process.env.SUPABASE_BUCKET_NAME || 'product-images';
  const filePath = `products/${productId}/${fileName}`;

  return await uploadFile(bucketName, filePath, file, contentType);
};

export const deleteProductImage = async (filePath: string): Promise<void> => {
  const bucketName = process.env.SUPABASE_BUCKET_NAME || 'product-images';

  await deleteFile(bucketName, filePath);
};
