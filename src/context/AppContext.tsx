import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import * as api from '../lib/api'
import type { AppState, Role } from '../lib/types'

const STORAGE_KEY = 'inventario-cucina.session'
const POLL_MS = 7000

interface Session {
  role: Role
  pin: string
}

interface AppContextValue {
  session: Session | null
  state: AppState | null
  loading: boolean
  error: string | null
  login: (pin: string) => Promise<Role | null>
  logout: () => void
  refresh: () => Promise<void>
  /** Applica uno stato già restituito da una mutazione, senza refetch. */
  applyState: (state: AppState) => void
}

const AppContext = createContext<AppContextValue | null>(null)

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(loadSession)
  const [state, setState] = useState<AppState | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sessionRef = useRef(session)
  sessionRef.current = session

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setSession(null)
    setState(null)
    setError(null)
  }, [])

  const login = useCallback(async (pin: string): Promise<Role | null> => {
    const role = await api.login(pin)
    if (role) {
      const next = { role, pin }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      setSession(next)
    }
    return role
  }, [])

  const refresh = useCallback(async () => {
    const current = sessionRef.current
    if (!current) return
    try {
      const next = await api.getState(current.pin)
      setState(next)
      setError(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Errore di rete'
      setError(msg)
      // PIN non più valido (es. cambiato dall'admin): esci.
      if (/pin/i.test(msg) || /non valido/i.test(msg)) logout()
    }
  }, [logout])

  const applyState = useCallback((next: AppState) => {
    setState(next)
    setError(null)
  }, [])

  // Caricamento iniziale + polling per aggiornamenti tra dispositivi.
  useEffect(() => {
    if (!session) return
    let active = true
    setLoading(true)
    refresh().finally(() => {
      if (active) setLoading(false)
    })
    const id = setInterval(refresh, POLL_MS)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [session, refresh])

  return (
    <AppContext.Provider
      value={{ session, state, loading, error, login, logout, refresh, applyState }}
    >
      {children}
    </AppContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp deve essere usato dentro AppProvider')
  return ctx
}
