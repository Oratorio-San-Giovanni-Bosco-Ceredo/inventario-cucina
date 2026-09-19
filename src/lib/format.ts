import type { Product, ProductStatus } from './types'

const euro = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
})

export function formatEuro(value: number): string {
  return euro.format(value)
}

/** Testo della rimanenza: numero, ∞ oppure 0. */
export function remainingLabel(product: Product): string {
  if (product.is_sold_out) return '0'
  if (product.remaining === null) return '∞'
  return String(product.remaining)
}

interface StatusMeta {
  label: string
  /** Classi Tailwind per il badge di stato (pill). */
  badge: string
  /** Classi Tailwind per il bordo/sfondo della card. */
  card: string
  /** Classe Tailwind per il colore del testo di stato. */
  text: string
}

const META: Record<ProductStatus, StatusMeta> = {
  ok: {
    label: 'Disponibile',
    badge: 'bg-emerald-100 text-emerald-700',
    card: 'border-emerald-200',
    text: 'text-emerald-700',
  },
  infinite: {
    label: 'Illimitato',
    badge: 'bg-sky-100 text-sky-700',
    card: 'border-sky-200',
    text: 'text-sky-700',
  },
  low: {
    label: 'In esaurimento',
    badge: 'bg-amber-100 text-amber-800',
    card: 'border-amber-300 bg-amber-50',
    text: 'text-amber-700',
  },
  sold_out: {
    label: 'Esaurito',
    badge: 'bg-red-100 text-red-700',
    card: 'border-red-300 bg-red-50 opacity-70',
    text: 'text-red-700',
  },
}

export function statusMeta(status: ProductStatus): StatusMeta {
  return META[status]
}
