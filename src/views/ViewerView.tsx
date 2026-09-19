import Header from '../components/Header'
import CategorySection from '../components/CategorySection'
import { useApp } from '../context/AppContext'
import { formatEuro, remainingLabel, statusMeta } from '../lib/format'
import { groupByCategory } from '../lib/grouping'
import type { Product } from '../lib/types'

export default function ViewerView() {
  const { state, loading } = useApp()
  const groups = state ? groupByCategory(state.products, state.categories) : []

  return (
    <div className="min-h-dvh">
      <Header title="Inventario" />
      <main className="mx-auto max-w-6xl px-4 py-4">
        {loading && !state && <p className="text-center text-slate-400">Caricamento…</p>}
        {state && state.products.length === 0 && (
          <p className="text-center text-slate-400">Nessun prodotto configurato.</p>
        )}
        {groups.map((g) => (
          <CategorySection key={g.category?.id ?? 'none'} title={g.category?.name ?? 'Senza categoria'}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {g.products.map((p) => (
                <ViewerCard key={p.id} product={p} />
              ))}
            </div>
          </CategorySection>
        ))}
      </main>
    </div>
  )
}

function ViewerCard({ product }: { product: Product }) {
  const meta = statusMeta(product.status)
  return (
    <div className={`flex flex-col rounded-2xl border-2 bg-white p-4 shadow-sm ${meta.card}`}>
      <h2 className="text-sm font-semibold leading-tight text-slate-800">{product.name}</h2>
      <p className="mt-3 text-4xl font-extrabold tabular-nums text-slate-900">
        {remainingLabel(product)}
      </p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-xs text-slate-500">{formatEuro(product.price)}</span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${meta.badge}`}>
          {meta.label}
        </span>
      </div>
    </div>
  )
}
