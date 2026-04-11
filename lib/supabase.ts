import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://kgxhjcdssbdgolanidzh.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtneGhqY2Rzc2JkZ29sYW5pZHpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MjYxMDIsImV4cCI6MjA5MTUwMjEwMn0.oYce_FKMUq4aP3IzIP5Nz4Lquuv2Me5JPOuGrAZKjTU'

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL o chiave mancante')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)