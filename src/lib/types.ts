export type Role = 'viewer' | 'editor' | 'admin'

export interface Ingredient {
  id: number
  name: string
  quantity: number
  is_infinite: boolean
  sort_order: number
}

export interface RecipeItem {
  ingredient_id: number
  qty_required: number
}

export type ProductStatus = 'ok' | 'low' | 'sold_out' | 'infinite'

export interface Product {
  id: number
  name: string
  price: number
  low_stock_threshold: number
  is_sold_out: boolean
  sort_order: number
  recipe: RecipeItem[]
  /** Porzioni ancora realizzabili. null = illimitato (ingredienti infiniti). */
  remaining: number | null
  status: ProductStatus
}

export interface AppState {
  role: Role
  ingredients: Ingredient[]
  products: Product[]
}

/** Riga dell'ordine in composizione (solo lato client, non salvata). */
export interface OrderLine {
  product_id: number
  qty: number
}
