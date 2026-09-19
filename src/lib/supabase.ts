import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!url || !anonKey) {
  // Aiuta a capire subito se manca la configurazione (file .env o secrets di build).
  console.error(
    'Configurazione Supabase mancante: definisci VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.'
  )
}

export const isSupabaseConfigured = Boolean(url && anonKey)

// Nessuna sessione utente di Supabase: l'autenticazione avviene tramite PIN
// verificati dalle funzioni del database. La chiave anon è pubblica per natura.
export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'anon', {
  auth: { persistSession: false, autoRefreshToken: false },
})
