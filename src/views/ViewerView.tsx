import Header from '../components/Header'
import { useApp } from '../context/AppContext'
import { formatEuro, remainingLabel, statusMeta } from '../lib/format'
import type { Product } from '../lib/types'

export default function ViewerView() {
  const { state, loading } = useApp()

  return (
    <div className="min-h-dvh">
      <Header title="Inventario" />
      <main className="mx-auto max-w-3xl px-4 py-4">
        {loading && !state && <p className="text-center text-slate-400">Caricamento…</p>}
        {state && state.products.length === 0 && (
          <p className="text-center text-slate-400">Nessun prodotto configurato.</p>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {state?.products.map((p) => (
            <ViewerCard key={p.id} product={p} />
          ))}
        </div>
      </main>
    </div>
  )
}

function ViewerCard({ product }: { product: Product }) {
  const meta = statusMeta(product.status)
  return (
    <div className={`rounded-2xl border-2 bg-white p-4 shadow-sm ${meta.card}`}>
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-semibold leading-tight text-slate-800">{product.name}</h2>
        {meta.icon && <span className="text-lg leading-none">{meta.icon}</span>}
      </div>
      <p className="mt-3 text-4xl font-extrabold tabular-nums text-slate-900">
        {remainingLabel(product)}
      </p>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-slate-500">{formatEuro(product.price)}</span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.badge}`}>
          {meta.label}
        </span>
      </div>
    </div>
  )
}
