import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setUser(session?.user ?? null)
        setIsLoading(false)
      } catch (error) {
        console.error('Failed to get initial session:', error)
        setIsLoading(false)
      }
    }

    getInitialSession()

    // Listen for auth changes
    let subscription: any
    supabase.auth.onAuthStateChange((event: string, session: any) => {
      setUser(session?.user ?? null)
      setIsLoading(false)
    }).then((sub) => {
      subscription = sub
    })

    return () => {
      if (subscription?.data?.subscription) {
        subscription.data.subscription.unsubscribe()
      }
    }
  }, [])

  const signInWithEmail = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { data, error }
  }

  const signUpWithEmail = async (email: string, password: string, metadata?: any) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata
      }
    })
    return { data, error }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    return { error }
  }

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    signInWithEmail,
    signUpWithEmail,
    signOut,
  }
}
