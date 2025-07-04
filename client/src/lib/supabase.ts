import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Initialize with real config fetched from server
let supabaseInstance: SupabaseClient | null = null

async function getSupabaseClient() {
  if (supabaseInstance) {
    return supabaseInstance
  }

  try {
    console.log('Fetching Supabase configuration...')
    const response = await fetch('/api/supabase-config')
    const config = await response.json()
    
    console.log('Config received:', { url: config.url, hasKey: !!config.anonKey })
    
    if (config.url && config.anonKey) {
      supabaseInstance = createClient(config.url, config.anonKey)
      console.log('Supabase client created successfully')
      return supabaseInstance
    } else {
      throw new Error('Invalid Supabase configuration')
    }
  } catch (error) {
    console.error('Failed to initialize Supabase client:', error)
    throw error
  }
}

// Export auth methods that initialize client on first use
export const supabase = {
  auth: {
    signInWithPassword: async (credentials: { email: string; password: string }) => {
      const client = await getSupabaseClient()
      return client.auth.signInWithPassword(credentials)
    },
    signUp: async (credentials: { email: string; password: string; options?: any }) => {
      const client = await getSupabaseClient()
      return client.auth.signUp(credentials)
    },
    signOut: async () => {
      const client = await getSupabaseClient()
      return client.auth.signOut()
    },
    getSession: async () => {
      const client = await getSupabaseClient()
      return client.auth.getSession()
    },
    onAuthStateChange: async (callback: (event: string, session: any) => void) => {
      const client = await getSupabaseClient()
      return client.auth.onAuthStateChange(callback)
    }
  }
}