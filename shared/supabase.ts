import { createClient } from '@supabase/supabase-js'

// Frontend environment variables (available in browser)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''

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