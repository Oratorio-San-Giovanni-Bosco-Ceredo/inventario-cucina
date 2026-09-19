import { supabase } from './supabase'
import type { AppState, OrderLine, Role } from './types'

/** Estrae un messaggio d'errore leggibile da un errore Supabase/Postgres. */
function fail(error: { message?: string } | null, fallback: string): never {
  throw new Error(error?.message || fallback)
}

/** Verifica il PIN e restituisce il ruolo, oppure null se non valido. */
export async function login(pin: string): Promise<Role | null> {
  const { data, error } = await supabase.rpc('login', { p_pin: pin })
  if (error) fail(error, 'Errore durante il login')
  return (data as Role | null) ?? null
}

/** Stato completo (ingredienti + prodotti con rimanenza calcolata). */
export async function getState(pin: string): Promise<AppState> {
  const { data, error } = await supabase.rpc('get_state', { p_pin: pin })
  if (error) fail(error, 'Impossibile caricare i dati')
  return data as AppState
}

/** Conferma un ordine: scala gli ingredienti in un'unica operazione. */
export async function confirmOrder(pin: string, items: OrderLine[]): Promise<AppState> {
  const { data, error } = await supabase.rpc('confirm_order', {
    p_pin: pin,
    p_items: items,
  })
  if (error) fail(error, 'Impossibile confermare l’ordine')
  return data as AppState
}

// ---- Funzioni admin ----

export async function upsertIngredient(
  pin: string,
  ing: { id?: number; name: string; quantity: number; is_infinite: boolean; sort_order?: number }
): Promise<AppState> {
  const { data, error } = await supabase.rpc('admin_upsert_ingredient', {
    p_pin: pin,
    p_id: ing.id ?? null,
    p_name: ing.name,
    p_quantity: ing.quantity,
    p_is_infinite: ing.is_infinite,
    p_sort_order: ing.sort_order ?? 0,
  })
  if (error) fail(error, 'Impossibile salvare l’ingrediente')
  return data as AppState
}

export async function deleteIngredient(pin: string, id: number): Promise<AppState> {
  const { data, error } = await supabase.rpc('admin_delete_ingredient', {
    p_pin: pin,
    p_id: id,
  })
  if (error) fail(error, 'Impossibile eliminare l’ingrediente')
  return data as AppState
}

export async function upsertProduct(
  pin: string,
  prod: {
    id?: number
    name: string
    price: number
    low_stock_threshold: number
    is_sold_out: boolean
    sort_order?: number
    recipe: { ingredient_id: number; qty_required: number }[]
  }
): Promise<AppState> {
  const { data, error } = await supabase.rpc('admin_upsert_product', {
    p_pin: pin,
    p_id: prod.id ?? null,
    p_name: prod.name,
    p_price: prod.price,
    p_threshold: prod.low_stock_threshold,
    p_is_sold_out: prod.is_sold_out,
    p_sort_order: prod.sort_order ?? 0,
    p_recipe: prod.recipe,
  })
  if (error) fail(error, 'Impossibile salvare il prodotto')
  return data as AppState
}

export async function deleteProduct(pin: string, id: number): Promise<AppState> {
  const { data, error } = await supabase.rpc('admin_delete_product', {
    p_pin: pin,
    p_id: id,
  })
  if (error) fail(error, 'Impossibile eliminare il prodotto')
  return data as AppState
}

export async function setPin(
  adminPin: string,
  role: Role,
  newPin: string
): Promise<void> {
  const { error } = await supabase.rpc('admin_set_pin', {
    p_pin: adminPin,
    p_role: role,
    p_new_pin: newPin,
  })
  if (error) fail(error, 'Impossibile aggiornare il PIN')
}
