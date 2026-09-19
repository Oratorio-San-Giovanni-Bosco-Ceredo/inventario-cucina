import { useApp } from '../context/AppContext'
import type { Role } from '../lib/types'

const ROLE_LABEL: Record<Role, string> = {
  viewer: 'Visualizzatore',
  editor: 'Cassa',
  admin: 'Amministratore',
}

export default function Header({ title }: { title: string }) {
  const { session, logout, refresh, error } = useApp()
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold text-slate-800">{title}</h1>
          {session && (
            <p className="text-xs text-slate-500">{ROLE_LABEL[session.role]}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => refresh()}
            className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 active:bg-slate-200"
            title="Aggiorna"
          >
            &#x21bb;
          </button>
          <button
            type="button"
            onClick={logout}
            className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 active:bg-slate-200"
          >
            Esci
          </button>
        </div>
      </div>
      {error && (
        <p className="bg-red-50 px-4 py-1 text-center text-xs text-red-600">{error}</p>
      )}
    </header>
  )
}
