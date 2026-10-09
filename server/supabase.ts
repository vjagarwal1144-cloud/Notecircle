import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim() || '';
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SECRET_KEY?.trim() || process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()) || '';

let serverClientInstance: SupabaseClient | null = null;

/**
 * Server-side centralized Supabase client.
 * Connects directly using environment secrets. Never hardcodes secrets or logs credentials.
 */
export function getServerSupabase(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  if (!serverClientInstance) {
    serverClientInstance = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }

  return serverClientInstance;
}

export interface SupabaseHealthResult {
  connected: boolean;
  configured: boolean;
  latencyMs: number;
  authStatus?: string;
  authVersion?: string;
  error?: string;
}

/**
 * Internal connection-health check.
 * Verifies that NoteCircle can communicate with the configured Supabase instance
 * without creating fake, mock, or demo records.
 */
export async function checkSupabaseHealth(): Promise<SupabaseHealthResult> {
  if (!supabaseUrl || !supabaseKey) {
    return {
      connected: false,
      configured: false,
      latencyMs: 0,
      error: 'VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY is not configured in environment secrets.'
    };
  }

  const startTime = Date.now();

  try {
    // 1. Health check via Auth service endpoint (GoTrue)
    const healthUrl = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/health`;
    const res = await fetch(healthUrl, {
      headers: {
        apikey: supabaseKey
      }
    });

    const latencyMs = Date.now() - startTime;

    if (res.ok) {
      const body = await res.json().catch(() => ({})) as any;
      return {
        connected: true,
        configured: true,
        latencyMs,
        authStatus: body.name || 'GoTrue',
        authVersion: body.version || undefined
      };
    } else {
      return {
        connected: false,
        configured: true,
        latencyMs,
        error: `Supabase returned HTTP status ${res.status}`
      };
    }
  } catch (err: any) {
    return {
      connected: false,
      configured: true,
      latencyMs: Date.now() - startTime,
      error: err?.message || 'Network error communicating with Supabase'
    };
  }
}
