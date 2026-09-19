import { useState } from 'react'
import Header from '../components/Header'
import IngredientsAdmin from './admin/IngredientsAdmin'
import ProductsAdmin from './admin/ProductsAdmin'
import SettingsAdmin from './admin/SettingsAdmin'

type Tab = 'products' | 'ingredients' | 'settings'

const TABS: { id: Tab; label: string }[] = [
  { id: 'products', label: 'Prodotti' },
  { id: 'ingredients', label: 'Ingredienti' },
  { id: 'settings', label: 'PIN' },
]

export default function AdminView() {
  const [tab, setTab] = useState<Tab>('products')

  return (
    <div className="min-h-dvh">
      <Header title="Gestione" />
      <div className="sticky top-[57px] z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-1 py-3 text-sm font-semibold transition ${
                tab === t.id
                  ? 'border-b-2 border-emerald-600 text-emerald-700'
                  : 'text-slate-500'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <main className="mx-auto max-w-3xl px-4 py-4">
        {tab === 'products' && <ProductsAdmin />}
        {tab === 'ingredients' && <IngredientsAdmin />}
        {tab === 'settings' && <SettingsAdmin />}
      </main>
    </div>
  )
}
