-- =============================================================
--  Migration 02 - Categorie prodotti + ordinamento
--  Esegui questo file nell'SQL Editor di Supabase DOPO schema.sql.
--  È idempotente: puoi rieseguirlo senza perdere dati.
-- =============================================================

-- 1) Tabella categorie
create table if not exists categories (
  id         bigint generated always as identity primary key,
  name       text not null,
  sort_order int  not null default 0,
  created_at timestamptz not null default now()
);
alter table categories enable row level security;

-- 2) Collega i prodotti a una categoria (opzionale: null = "Senza categoria")
alter table products add column if not exists category_id bigint
  references categories(id) on delete set null;

-- 3) get_state aggiornata: include le categorie e il category_id dei prodotti
create or replace function get_state(p_pin text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role   text;
  v_result json;
begin
  v_role := _role_for_pin(p_pin);
  if v_role is null then
    raise exception 'PIN non valido';
  end if;

  select json_build_object(
    'role', v_role,
    'categories', coalesce((
      select json_agg(json_build_object(
        'id', c.id,
        'name', c.name,
        'sort_order', c.sort_order
      ) order by c.sort_order, c.name)
      from categories c
    ), '[]'::json),
    'ingredients', coalesce((
      select json_agg(json_build_object(
        'id', i.id,
        'name', i.name,
        'quantity', i.quantity,
        'is_infinite', i.is_infinite,
        'sort_order', i.sort_order
      ) order by i.sort_order, i.name)
      from ingredients i
    ), '[]'::json),
    'products', coalesce((
      select json_agg(p_obj order by sort_order, name)
      from (
        select
          pr.sort_order,
          pr.name,
          json_build_object(
            'id', pr.id,
            'name', pr.name,
            'price', pr.price,
            'low_stock_threshold', pr.low_stock_threshold,
            'is_sold_out', pr.is_sold_out,
            'sort_order', pr.sort_order,
            'category_id', pr.category_id,
            'recipe', coalesce((
              select json_agg(json_build_object(
                'ingredient_id', ri.ingredient_id,
                'qty_required', ri.qty_required
              ))
              from recipe_items ri where ri.product_id = pr.id
            ), '[]'::json),
            'remaining', r.remaining,
            'status', case
              when pr.is_sold_out or r.remaining = 0 then 'sold_out'
              when r.remaining is null then 'infinite'
              when pr.low_stock_threshold > 0 and r.remaining < pr.low_stock_threshold then 'low'
              else 'ok'
            end
          ) as p_obj
        from products pr
        cross join lateral (
          select case
            when pr.is_sold_out then 0
            else (
              select min(floor(i.quantity / ri.qty_required))::numeric
              from recipe_items ri
              join ingredients i on i.id = ri.ingredient_id
              where ri.product_id = pr.id
                and not i.is_infinite
                and ri.qty_required > 0
            )
          end as remaining
        ) r
      ) sub
    ), '[]'::json)
  ) into v_result;

  return v_result;
end;
$$;

-- 4) admin_upsert_product con category_id (cambia la firma: drop + create)
drop function if exists admin_upsert_product(text, bigint, text, numeric, numeric, boolean, int, jsonb);

create or replace function admin_upsert_product(
  p_pin text, p_id bigint, p_name text, p_price numeric,
  p_threshold numeric, p_is_sold_out boolean, p_category_id bigint,
  p_sort_order int, p_recipe jsonb
)
returns json
language plpgsql security definer set search_path = public
as $$
declare v_id bigint;
begin
  perform _require_admin(p_pin);
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Il nome è obbligatorio';
  end if;

  if p_id is null then
    insert into products(name, price, low_stock_threshold, is_sold_out, category_id, sort_order)
    values (p_name, p_price, p_threshold, p_is_sold_out, p_category_id, coalesce(p_sort_order, 0))
    returning id into v_id;
  else
    update products set
      name = p_name, price = p_price, low_stock_threshold = p_threshold,
      is_sold_out = p_is_sold_out, category_id = p_category_id,
      sort_order = coalesce(p_sort_order, 0)
    where id = p_id;
    v_id := p_id;
  end if;

  delete from recipe_items where product_id = v_id;
  insert into recipe_items(product_id, ingredient_id, qty_required)
  select v_id, (e->>'ingredient_id')::bigint, (e->>'qty_required')::numeric
  from jsonb_array_elements(coalesce(p_recipe, '[]'::jsonb)) e
  where (e->>'qty_required')::numeric > 0;

  return get_state(p_pin);
end;
$$;

-- 5) Gestione categorie
create or replace function admin_upsert_category(
  p_pin text, p_id bigint, p_name text, p_sort_order int
)
returns json
language plpgsql security definer set search_path = public
as $$
begin
  perform _require_admin(p_pin);
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Il nome è obbligatorio';
  end if;
  if p_id is null then
    insert into categories(name, sort_order) values (p_name, coalesce(p_sort_order, 0));
  else
    update categories set name = p_name, sort_order = coalesce(p_sort_order, 0)
    where id = p_id;
  end if;
  return get_state(p_pin);
end;
$$;

create or replace function admin_delete_category(p_pin text, p_id bigint)
returns json
language plpgsql security definer set search_path = public
as $$
begin
  perform _require_admin(p_pin);
  delete from categories where id = p_id;  -- i prodotti restano (category_id -> null)
  return get_state(p_pin);
end;
$$;

-- 6) Riordino: assegna sort_order in base alla posizione nell'array di id
--    p_kind: 'category' | 'product' | 'ingredient'
create or replace function admin_set_order(p_pin text, p_kind text, p_ids jsonb)
returns json
language plpgsql security definer set search_path = public
as $$
begin
  perform _require_admin(p_pin);
  if p_kind = 'category' then
    update categories c set sort_order = x.ord
    from (select value::bigint as id, (ordinality - 1) as ord
          from jsonb_array_elements_text(p_ids) with ordinality) x
    where c.id = x.id;
  elsif p_kind = 'product' then
    update products p set sort_order = x.ord
    from (select value::bigint as id, (ordinality - 1) as ord
          from jsonb_array_elements_text(p_ids) with ordinality) x
    where p.id = x.id;
  elsif p_kind = 'ingredient' then
    update ingredients i set sort_order = x.ord
    from (select value::bigint as id, (ordinality - 1) as ord
          from jsonb_array_elements_text(p_ids) with ordinality) x
    where i.id = x.id;
  else
    raise exception 'Tipo non valido: %', p_kind;
  end if;
  return get_state(p_pin);
end;
$$;

-- 7) Permessi (chiave anon)
grant execute on function admin_upsert_product(text, bigint, text, numeric, numeric, boolean, bigint, int, jsonb) to anon, authenticated;
grant execute on function admin_upsert_category(text, bigint, text, int) to anon, authenticated;
grant execute on function admin_delete_category(text, bigint)           to anon, authenticated;
grant execute on function admin_set_order(text, text, jsonb)            to anon, authenticated;
