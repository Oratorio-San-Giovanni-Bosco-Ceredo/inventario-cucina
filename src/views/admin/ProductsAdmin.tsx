import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { deleteProduct, upsertProduct } from '../../lib/api'
import { formatEuro } from '../../lib/format'
import type { Ingredient, Product, RecipeItem } from '../../lib/types'

export default function ProductsAdmin() {
  const { state, session, applyState } = useApp()
  const [editing, setEditing] = useState<Product | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const products = state?.products ?? []
  const ingredients = state?.ingredients ?? []

  const remove = async (p: Product) => {
    if (!session) return
    if (!confirm(`Eliminare il prodotto "${p.name}"?`)) return
    try {
      applyState(await deleteProduct(session.pin, p.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore')
    }
  }

  if (ingredients.length === 0) {
    return (
      <p className="rounded-xl bg-amber-100 px-4 py-3 text-sm text-amber-800">
        Aggiungi prima almeno un ingrediente: i prodotti si basano sugli ingredienti.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {error && <p className="rounded bg-red-100 px-3 py-2 text-sm text-red-700">{error}</p>}

      {editing === 'new' ? (
        <ProductEditor ingredients={ingredients} onClose={() => setEditing(null)} />
      ) : (
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white active:bg-emerald-700"
        >
          + Nuovo prodotto
        </button>
      )}

      <ul className="space-y-2">
        {products.map((p) =>
          editing !== 'new' && editing?.id === p.id ? (
            <li key={p.id}>
              <ProductEditor product={p} ingredients={ingredients} onClose={() => setEditing(null)} />
            </li>
          ) : (
            <li key={p.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-800">
                    {p.name} {p.is_sold_out && <span className="text-red-600">· esaurito</span>}
                  </p>
                  <p className="text-sm text-slate-500">
                    {formatEuro(p.price)} &middot; soglia {p.low_stock_threshold} &middot;{' '}
                    {p.recipe.length} ingredienti
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(p)}
                    className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium active:bg-slate-200"
                  >
                    Modifica
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(p)}
                    className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600 active:bg-red-100"
                  >
                    Elimina
                  </button>
                </div>
              </div>
            </li>
          )
        )}
      </ul>
    </div>
  )
}

function ProductEditor({
  product,
  ingredients,
  onClose,
}: {
  product?: Product
  ingredients: Ingredient[]
  onClose: () => void
}) {
  const { session, applyState } = useApp()
  const [name, setName] = useState(product?.name ?? '')
  const [price, setPrice] = useState(String(product?.price ?? 0))
  const [threshold, setThreshold] = useState(String(product?.low_stock_threshold ?? 0))
  const [soldOut, setSoldOut] = useState(product?.is_sold_out ?? false)
  const [recipe, setRecipe] = useState<RecipeItem[]>(product?.recipe ?? [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const available = ingredients.filter(
    (i) => !recipe.some((r) => r.ingredient_id === i.id)
  )

  const addIngredient = (id: number) => {
    setRecipe((r) => [...r, { ingredient_id: id, qty_required: 1 }])
  }
  const updateQty = (id: number, qty: number) => {
    setRecipe((r) => r.map((it) => (it.ingredient_id === id ? { ...it, qty_required: qty } : it)))
  }
  const removeItem = (id: number) => {
    setRecipe((r) => r.filter((it) => it.ingredient_id !== id))
  }

  const nameOf = (id: number) => ingredients.find((i) => i.id === id)?.name ?? '?'

  const save = async () => {
    if (!session || !name.trim()) {
      setError('Il nome è obbligatorio')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const next = await upsertProduct(session.pin, {
        id: product?.id,
        name: name.trim(),
        price: Number(price) || 0,
        low_stock_threshold: Number(threshold) || 0,
        is_sold_out: soldOut,
        sort_order: product?.sort_order ?? 0,
        recipe: recipe.map((r) => ({
          ingredient_id: r.ingredient_id,
          qty_required: Number(r.qty_required) || 0,
        })),
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
        placeholder="Nome prodotto"
        className="w-full rounded-lg border border-slate-300 px-3 py-2"
      />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-slate-600">Prezzo (€)</label>
          <input
            type="number"
            inputMode="decimal"
            step="0.10"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="text-sm text-slate-600">Soglia avviso</label>
          <input
            type="number"
            inputMode="numeric"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={soldOut}
          onChange={(e) => setSoldOut(e.target.checked)}
          className="h-5 w-5"
        />
        Segna come esaurito (forza non disponibile)
      </label>

      <div>
        <p className="mb-1 text-sm font-medium text-slate-700">Ricetta (ingredienti necessari)</p>
        <ul className="space-y-2">
          {recipe.map((it) => (
            <li key={it.ingredient_id} className="flex items-center gap-2">
              <span className="flex-1 text-sm text-slate-700">{nameOf(it.ingredient_id)}</span>
              <input
                type="number"
                inputMode="decimal"
                value={it.qty_required}
                onChange={(e) => updateQty(it.ingredient_id, Number(e.target.value))}
                className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-center"
              />
              <button
                type="button"
                onClick={() => removeItem(it.ingredient_id)}
                className="rounded-lg bg-red-50 px-2 py-1 text-sm text-red-600"
              >
                &times;
              </button>
            </li>
          ))}
        </ul>
        {available.length > 0 && (
          <select
            value=""
            onChange={(e) => e.target.value && addIngredient(Number(e.target.value))}
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-600"
          >
            <option value="">+ Aggiungi ingrediente…</option>
            {available.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        )}
      </div>

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
