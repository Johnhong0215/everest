import { createClient } from '@supabase/supabase-js'

// Check if we're in a browser environment (for client-side) or Node.js (for server-side)
const isClient = typeof window !== 'undefined'

// Get environment variables with fallbacks
const supabaseUrl = isClient 
  ? (import.meta as any)?.env?.VITE_SUPABASE_URL || '' 
  : process.env.SUPABASE_URL || ''

const supabaseAnonKey = isClient 
  ? (import.meta as any)?.env?.VITE_SUPABASE_ANON_KEY || '' 
  : process.env.SUPABASE_ANON_KEY || ''

// Server-side environment variables (only available on server)
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// Client for frontend use (with anon key)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Admin client for server-side operations (with service role key)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Types for Supabase Auth
export interface SupabaseUser {
  id: string
  email?: string
  user_metadata?: {
    firstName?: string
    lastName?: string
    name?: string
    avatar?: string
  }
  created_at?: string
}