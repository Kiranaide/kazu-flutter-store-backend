import { createClient } from '@supabase/supabase-js';
import type { Context } from 'hono';

export const createSupabaseClient = (c: Context) => {
  const supabaseUrl = c.env.SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = c.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials not configured');
  }

  return createClient(supabaseUrl, supabaseKey);
};
