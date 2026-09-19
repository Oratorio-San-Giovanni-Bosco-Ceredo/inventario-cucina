import type { Category, Product } from './types'

export interface ProductGroup {
  /** null = prodotti senza categoria. */
  category: Category | null
  products: Product[]
}

const byOrder = (a: { sort_order: number; name: string }, b: { sort_order: number; name: string }) =>
  a.sort_order - b.sort_order || a.name.localeCompare(b.name)

/**
 * Raggruppa i prodotti per categoria, ordinando categorie e prodotti per
 * sort_order. I prodotti senza categoria finiscono in un gruppo finale.
 * @param includeEmpty se true mantiene anche le categorie senza prodotti.
 */
export function groupByCategory(
  products: Product[],
  categories: Category[] = [],
  includeEmpty = false
): ProductGroup[] {
  const sortedCats = [...(categories ?? [])].sort(byOrder)
  const byCat = new Map<number, Product[]>()
  const uncategorized: Product[] = []

  for (const p of products) {
    if (p.category_id == null) {
      uncategorized.push(p)
    } else {
      const list = byCat.get(p.category_id) ?? []
      list.push(p)
      byCat.set(p.category_id, list)
    }
  }

  const groups: ProductGroup[] = []
  for (const c of sortedCats) {
    const prods = (byCat.get(c.id) ?? []).sort(byOrder)
    if (prods.length || includeEmpty) groups.push({ category: c, products: prods })
  }
  if (uncategorized.length) {
    groups.push({ category: null, products: uncategorized.sort(byOrder) })
  }
  return groups
}
