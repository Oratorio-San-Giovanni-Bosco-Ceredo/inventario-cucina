import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { setPin } from '../../lib/api'
import type { Role } from '../../lib/types'

const ROLES: { role: Role; label: string }[] = [
  { role: 'viewer', label: 'Visualizzatore' },
  { role: 'editor', label: 'Cassa' },
  { role: 'admin', label: 'Amministratore' },
]

export default function SettingsAdmin() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Imposta un nuovo PIN per ciascun ruolo. Usa PIN diversi tra loro (min. 4 cifre).
      </p>
      {ROLES.map((r) => (
        <PinRow key={r.role} role={r.role} label={r.label} />
      ))}
    </div>
  )
}

function PinRow({ role, label }: { role: Role; label: string }) {
  const { session, logout } = useApp()
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const save = async () => {
    if (!session || value.length < 4) {
      setMsg({ text: 'Il PIN deve avere almeno 4 cifre', ok: false })
      return
    }
    setBusy(true)
    setMsg(null)
    try {
      await setPin(session.pin, role, value)
      setMsg({ text: 'PIN aggiornato', ok: true })
      setValue('')
      // Se ho cambiato il PIN admin che sto usando, devo rientrare.
      if (role === 'admin') {
        setTimeout(logout, 1200)
      }
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Errore', ok: false })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="mb-2 font-medium text-slate-800">{label}</p>
      <div className="flex gap-2">
        <input
          type="tel"
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))}
          placeholder="Nuovo PIN"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2"
        />
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white active:bg-emerald-700 disabled:opacity-40"
        >
          Salva
        </button>
      </div>
      {msg && (
        <p className={`mt-2 text-sm ${msg.ok ? 'text-emerald-700' : 'text-red-600'}`}>
          {msg.text}
        </p>
      )}
    </div>
  )
}
