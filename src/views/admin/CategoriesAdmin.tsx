import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { deleteCategory, setOrder, upsertCategory } from '../../lib/api'
import type { Category } from '../../lib/types'

export default function CategoriesAdmin() {
  const { state, session, applyState } = useApp()
  const [editing, setEditing] = useState<Category | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const categories = [...(state?.categories ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)
  )

  const run = async (fn: () => Promise<import('../../lib/types').AppState>) => {
    try {
      applyState(await fn())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore')
    }
  }

  const move = (index: number, dir: -1 | 1) => {
    if (!session) return
    const next = [...categories]
    const j = index + dir
    if (j < 0 || j >= next.length) return
    ;[next[index], next[j]] = [next[j], next[index]]
    run(() => setOrder(session.pin, 'category', next.map((c) => c.id)))
  }

  const remove = (cat: Category) => {
    if (!session) return
    if (!confirm(`Eliminare la categoria "${cat.name}"? I prodotti resteranno (senza categoria).`)) return
    run(() => deleteCategory(session.pin, cat.id))
  }

  return (
    <div className="space-y-3">
      {error && <p className="rounded bg-red-100 px-3 py-2 text-sm text-red-700">{error}</p>}

      {editing === 'new' ? (
        <CategoryEditor onClose={() => setEditing(null)} />
      ) : (
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white active:bg-emerald-700"
        >
          + Nuova categoria
        </button>
      )}

      <ul className="space-y-2">
        {categories.map((cat, i) =>
          editing !== 'new' && editing?.id === cat.id ? (
            <li key={cat.id}>
              <CategoryEditor category={cat} onClose={() => setEditing(null)} />
            </li>
          ) : (
            <li
              key={cat.id}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3"
            >
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="px-1 text-slate-400 disabled:opacity-20"
                >
                  &#9650;
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === categories.length - 1}
                  className="px-1 text-slate-400 disabled:opacity-20"
                >
                  &#9660;
                </button>
              </div>
              <p className="flex-1 font-medium text-slate-800">{cat.name}</p>
              <button
                type="button"
                onClick={() => setEditing(cat)}
                className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium active:bg-slate-200"
              >
                Modifica
              </button>
              <button
                type="button"
                onClick={() => remove(cat)}
                className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600 active:bg-red-100"
              >
                Elimina
              </button>
            </li>
          )
        )}
        {categories.length === 0 && (
          <li className="py-2 text-center text-sm text-slate-400">Nessuna categoria.</li>
        )}
      </ul>
    </div>
  )
}

function CategoryEditor({ category, onClose }: { category?: Category; onClose: () => void }) {
  const { session, applyState } = useApp()
  const [name, setName] = useState(category?.name ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    if (!session || !name.trim()) {
      setError('Il nome è obbligatorio')
      return
    }
    setBusy(true)
    setError(null)
    try {
      applyState(
        await upsertCategory(session.pin, {
          id: category?.id,
          name: name.trim(),
          sort_order: category?.sort_order ?? 0,
        })
      )
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 rounded-xl border-2 border-emerald-300 bg-white p-4">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nome categoria"
        className="w-full rounded-lg border border-slate-300 px-3 py-2"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-lg bg-slate-100 py-2 font-medium active:bg-slate-200"
        >
          Annulla
        </button>
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="flex-1 rounded-lg bg-emerald-600 py-2 font-semibold text-white active:bg-emerald-700 disabled:opacity-40"
        >
          Salva
        </button>
      </div>
    </div>
  )
}
