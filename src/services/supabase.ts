import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Retrieve credentials safely from environment secrets
const supabaseUrl: string = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
  '';

const supabasePublishableKey: string = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY) ||
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_PUBLISHABLE_KEY) ||
  '';

let clientInstance: SupabaseClient | null = null;

/**
 * Centralized Supabase client for browser and client-side operations.
 * Uses the public/publishable key only. Never exposes service-role secrets.
 */
export function getSupabaseClient(): SupabaseClient {
  if (!clientInstance) {
    if (!supabaseUrl || !supabasePublishableKey) {
      console.warn('[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY environment variables.');
    }
    clientInstance = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabasePublishableKey || 'placeholder', {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  }
  return clientInstance;
}

export const supabase = getSupabaseClient();
