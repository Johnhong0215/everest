import { createClient } from '@supabase/supabase-js'

// Initialize with placeholder values
let supabaseClient = createClient('https://placeholder.supabase.co', 'placeholder-key')

// Fetch real configuration from server and update client
async function initializeSupabase() {
  try {
    const response = await fetch('/api/supabase-config')
    if (response.ok) {
      const config = await response.json()
      if (config.url && config.anonKey) {
        supabaseClient = createClient(config.url, config.anonKey)
        console.log('Supabase client initialized with server configuration')
      }
    }
  } catch (error) {
    console.warn('Failed to fetch Supabase configuration from server:', error)
  }
}

// Initialize on module load
initializeSupabase()

export const supabase = new Proxy(supabaseClient, {
  get(target, prop) {
    return target[prop as keyof typeof target]
  }
})