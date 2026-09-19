import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { isSupabaseConfigured } from '../lib/supabase'

export default function Login() {
  const { login } = useApp()
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const press = (digit: string) => {
    if (busy || pin.length >= 8) return
    setError(null)
    setPin((p) => p + digit)
  }

  const backspace = () => {
    if (busy) return
    setError(null)
    setPin((p) => p.slice(0, -1))
  }

  const submit = async () => {
    if (busy || pin.length === 0) return
    setBusy(true)
    setError(null)
    try {
      const role = await login(pin)
      if (!role) {
        setError('PIN non valido')
        setPin('')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore di connessione')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-800">Inventario Cucina</h1>
        <p className="mt-1 text-sm text-slate-500">Oratorio San Giovanni Bosco &middot; Ceredo</p>
      </div>

      {!isSupabaseConfigured && (
        <p className="max-w-xs rounded-lg bg-amber-100 px-4 py-2 text-center text-sm text-amber-800">
          Configurazione mancante: definisci le variabili Supabase.
        </p>
      )}

      <div className="flex h-14 w-64 items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white">
        {pin.length === 0 ? (
          <span className="text-slate-300">Inserisci PIN</span>
        ) : (
          Array.from(pin).map((_, i) => (
            <span key={i} className="h-3 w-3 rounded-full bg-slate-700" />
          ))
        )}
      </div>

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}

      <div className="grid grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <KeyButton key={d} onClick={() => press(d)}>
            {d}
          </KeyButton>
        ))}
        <KeyButton onClick={backspace} variant="muted">
          &larr;
        </KeyButton>
        <KeyButton onClick={() => press('0')}>0</KeyButton>
        <KeyButton onClick={submit} variant="primary" disabled={busy || pin.length === 0}>
          {busy ? '…' : 'OK'}
        </KeyButton>
      </div>
    </div>
  )
}

function KeyButton({
  children,
  onClick,
  variant = 'default',
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  variant?: 'default' | 'primary' | 'muted'
  disabled?: boolean
}) {
  const styles = {
    default: 'bg-white text-slate-800 active:bg-slate-100',
    primary: 'bg-emerald-600 text-white active:bg-emerald-700 disabled:opacity-40',
    muted: 'bg-slate-100 text-slate-500 active:bg-slate-200',
  }[variant]
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`h-20 w-20 rounded-2xl border border-slate-200 text-2xl font-semibold shadow-sm transition ${styles}`}
    >
      {children}
    </button>
  )
}
