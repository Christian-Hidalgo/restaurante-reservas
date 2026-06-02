import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = 'https://jkalfohwvsbugpziopcz.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprYWxmb2h3dnNidWdwemlvcGN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MjgxNjYsImV4cCI6MjA5NDEwNDE2Nn0.XYjHh3D3D6MdWohD27r86hZCLKrKez3manwNoRD2aF0'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storageKey: 'casa-hidalgo-auth',
    storage: window.localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
})