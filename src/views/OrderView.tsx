import { useMemo, useState } from 'react'
import Header from '../components/Header'
import { useApp } from '../context/AppContext'
import { confirmOrder } from '../lib/api'
import { formatEuro, remainingLabel, statusMeta } from '../lib/format'
import type { Product } from '../lib/types'

export default function OrderView() {
  const { state, session, applyState, loading } = useApp()
  const [order, setOrder] = useState<Record<number, number>>({})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  const products = state?.products ?? []

  const setQty = (product: Product, next: number) => {
    const max = product.remaining // null = illimitato
    let value = Math.max(0, next)
    if (max !== null) value = Math.min(value, max)
    setMessage(null)
    setOrder((o) => {
      const copy = { ...o }
      if (value === 0) delete copy[product.id]
      else copy[product.id] = value
      return copy
    })
  }

  const { totalPieces, totalEuro, lines } = useMemo(() => {
    let pieces = 0
    let euros = 0
    const l: { product_id: number; qty: number }[] = []
    for (const p of products) {
      const qty = order[p.id] ?? 0
      if (qty > 0) {
        pieces += qty
        euros += qty * p.price
        l.push({ product_id: p.id, qty })
      }
    }
    return { totalPieces: pieces, totalEuro: euros, lines: l }
  }, [order, products])

  const cancel = () => {
    setOrder({})
    setMessage(null)
  }

  const confirm = async () => {
    if (!session || lines.length === 0 || busy) return
    setBusy(true)
    setMessage(null)
    try {
      const next = await confirmOrder(session.pin, lines)
      applyState(next)
      setOrder({})
      setMessage({ text: `Ordine confermato — ${formatEuro(totalEuro)}`, ok: true })
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : 'Errore', ok: false })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-dvh pb-28">
      <Header title="Cassa" />
      <main className="mx-auto max-w-3xl px-4 py-4">
        {loading && !state && <p className="text-center text-slate-400">Caricamento…</p>}
        {message && (
          <p
            className={`mb-3 rounded-lg px-4 py-2 text-center text-sm font-medium ${
              message.ok ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'
            }`}
          >
            {message.text}
          </p>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {products.map((p) => (
            <OrderCard
              key={p.id}
              product={p}
              qty={order[p.id] ?? 0}
              onChange={(n) => setQty(p, n)}
            />
          ))}
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <div className="flex-1">
            <p className="text-xs text-slate-500">
              {totalPieces} {totalPieces === 1 ? 'pezzo' : 'pezzi'}
            </p>
            <p className="text-2xl font-extrabold tabular-nums text-slate-900">
              {formatEuro(totalEuro)}
            </p>
          </div>
          <button
            type="button"
            onClick={cancel}
            disabled={lines.length === 0 || busy}
            className="rounded-xl bg-slate-100 px-4 py-3 font-semibold text-slate-700 active:bg-slate-200 disabled:opacity-40"
          >
            Cancella
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={lines.length === 0 || busy}
            className="rounded-xl bg-emerald-600 px-6 py-3 font-bold text-white active:bg-emerald-700 disabled:opacity-40"
          >
            {busy ? '…' : 'Conferma'}
          </button>
        </div>
      </div>
    </div>
  )
}

function OrderCard({
  product,
  qty,
  onChange,
}: {
  product: Product
  qty: number
  onChange: (next: number) => void
}) {
  const meta = statusMeta(product.status)
  const disabled = product.status === 'sold_out'
  const atMax = product.remaining !== null && qty >= product.remaining

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border-2 bg-white p-3 shadow-sm ${meta.card} ${
        qty > 0 ? 'ring-2 ring-emerald-400' : ''
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <h2 className="truncate text-sm font-semibold text-slate-800">{product.name}</h2>
          {meta.icon && <span className="text-sm">{meta.icon}</span>}
        </div>
        <p className="text-xs text-slate-500">
          {formatEuro(product.price)} &middot; rim. {remainingLabel(product)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(qty - 1)}
          disabled={disabled || qty === 0}
          className="h-11 w-11 rounded-xl bg-slate-100 text-2xl font-bold text-slate-700 active:bg-slate-200 disabled:opacity-30"
        >
          &minus;
        </button>
        <span className="w-8 text-center text-xl font-bold tabular-nums">{qty}</span>
        <button
          type="button"
          onClick={() => onChange(qty + 1)}
          disabled={disabled || atMax}
          className="h-11 w-11 rounded-xl bg-emerald-600 text-2xl font-bold text-white active:bg-emerald-700 disabled:opacity-30"
        >
          +
        </button>
      </div>
    </div>
  )
}
