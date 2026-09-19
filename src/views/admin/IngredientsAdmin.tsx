import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { deleteIngredient, upsertIngredient } from '../../lib/api'
import type { Ingredient } from '../../lib/types'

/** Soglia sotto la quale un ingrediente è considerato "in esaurimento". */
const LOW_STOCK = 10

interface StockMeta {
  /** Classi bordo/sfondo della riga. */
  row: string
  /** Colore del testo della disponibilità. */
  text: string
  /** Descrizione della disponibilità. */
  label: string
}

/** Stile e descrizione in base alla disponibilità dell'ingrediente. */
function stockMeta(ing: Ingredient): StockMeta {
  if (ing.is_infinite)
    return { row: 'border-sky-500 bg-sky-50', text: 'text-sky-700', label: '∞ illimitato' }
  if (ing.quantity <= 0)
    return { row: 'border-red-500 bg-red-50', text: 'text-red-700', label: 'Esaurito' }
  if (ing.quantity < LOW_STOCK)
    return {
      row: 'border-amber-500 bg-amber-50',
      text: 'text-amber-700',
      label: `${ing.quantity} disponibili · in esaurimento`,
    }
  return { row: 'border-slate-200 bg-white', text: 'text-slate-500', label: `${ing.quantity} disponibili` }
}

export default function IngredientsAdmin() {
  const { state, session, applyState } = useApp()
  const [editing, setEditing] = useState<Ingredient | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const ingredients = [...(state?.ingredients ?? [])].sort((a, b) =>
    a.name.localeCompare(b.name, 'it')
  )

  const remove = async (ing: Ingredient) => {
    if (!session) return
    if (!confirm(`Eliminare "${ing.name}"? Verrà rimosso anche dalle ricette.`)) return
    try {
      applyState(await deleteIngredient(session.pin, ing.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore')
    }
  }

  return (
    <div className="space-y-3">
      {error && <p className="rounded bg-red-100 px-3 py-2 text-sm text-red-700">{error}</p>}

      {editing === 'new' ? (
        <IngredientEditor onClose={() => setEditing(null)} />
      ) : (
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white active:bg-emerald-700"
        >
          + Nuovo ingrediente
        </button>
      )}

      <ul className="space-y-2">
        {ingredients.map((ing) =>
          editing !== 'new' && editing?.id === ing.id ? (
            <li key={ing.id}>
              <IngredientEditor ingredient={ing} onClose={() => setEditing(null)} />
            </li>
          ) : (
            <li
              key={ing.id}
              className={`flex items-center justify-between rounded-xl border-2 px-4 py-3 ${stockMeta(ing).row}`}
            >
              <div>
                <p className="font-medium text-slate-800">{ing.name}</p>
                <p className={`text-sm font-medium ${stockMeta(ing).text}`}>{stockMeta(ing).label}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(ing)}
                  className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium active:bg-slate-200"
                >
                  Modifica
                </button>
                <button
                  type="button"
                  onClick={() => remove(ing)}
                  className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600 active:bg-red-100"
                >
                  Elimina
                </button>
              </div>
            </li>
          )
        )}
      </ul>
    </div>
  )
}

function IngredientEditor({
  ingredient,
  onClose,
}: {
  ingredient?: Ingredient
  onClose: () => void
}) {
  const { session, applyState } = useApp()
  const [name, setName] = useState(ingredient?.name ?? '')
  const [quantity, setQuantity] = useState(String(ingredient?.quantity ?? 0))
  const [infinite, setInfinite] = useState(ingredient?.is_infinite ?? false)
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
      const next = await upsertIngredient(session.pin, {
        id: ingredient?.id,
        name: name.trim(),
        quantity: infinite ? 0 : Number(quantity) || 0,
        is_infinite: infinite,
        sort_order: ingredient?.sort_order ?? 0,
      })
      applyState(next)
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
        placeholder="Nome ingrediente"
        className="w-full rounded-lg border border-slate-300 px-3 py-2"
      />
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={infinite}
          onChange={(e) => setInfinite(e.target.checked)}
          className="h-5 w-5"
        />
        Illimitato (nessun limite di quantità)
      </label>
      {!infinite && (
        <div>
          <label className="text-sm text-slate-600">Quantità disponibile</label>
          <input
            type="number"
            inputMode="numeric"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </div>
      )}
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
