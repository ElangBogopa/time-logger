import { Platform } from 'react-native'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

// Create a storage adapter that works on all platforms
const createStorage = () => {
  if (Platform.OS === 'web') {
    // For web, use localStorage if available (client-side only)
    if (typeof window !== 'undefined' && window.localStorage) {
      return {
        getItem: (key: string) => Promise.resolve(window.localStorage.getItem(key)),
        setItem: (key: string, value: string) => {
          window.localStorage.setItem(key, value)
          return Promise.resolve()
        },
        removeItem: (key: string) => {
          window.localStorage.removeItem(key)
          return Promise.resolve()
        },
      }
    }
    // SSR fallback - no storage
    return {
      getItem: () => Promise.resolve(null),
      setItem: () => Promise.resolve(),
      removeItem: () => Promise.resolve(),
    }
  }
  // Native platforms use AsyncStorage
  const AsyncStorage = require('@react-native-async-storage/async-storage').default
  return AsyncStorage
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: createStorage(),
    autoRefreshToken: true,
    persistSession: Platform.OS !== 'web' || typeof window !== 'undefined',
    detectSessionInUrl: false,
  },
})
