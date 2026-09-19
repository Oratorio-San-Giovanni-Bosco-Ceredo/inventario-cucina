-- =============================================================
--  Inventario Cucina - schema database (Supabase / PostgreSQL)
--  Incolla ed esegui TUTTO questo file nell'editor SQL di Supabase.
--  È idempotente: puoi rieseguirlo senza perdere i dati.
-- =============================================================

create extension if not exists pgcrypto;

-- ---------- Tabelle ----------

create table if not exists ingredients (
  id          bigint generated always as identity primary key,
  name        text    not null,
  quantity    numeric not null default 0,
  is_infinite boolean not null default false,
  sort_order  int     not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists products (
  id                  bigint generated always as identity primary key,
  name                text    not null,
  price               numeric not null default 0,
  low_stock_threshold numeric not null default 0,
  is_sold_out         boolean not null default false,
  sort_order          int     not null default 0,
  created_at          timestamptz not null default now()
);

create table if not exists recipe_items (
  product_id    bigint  not null references products(id)    on delete cascade,
  ingredient_id bigint  not null references ingredients(id) on delete cascade,
  qty_required  numeric not null default 1,
  primary key (product_id, ingredient_id)
);

create table if not exists app_pins (
  role     text primary key check (role in ('viewer','editor','admin')),
  pin_hash text not null
);

-- ---------- Sicurezza: nessun accesso diretto alle tabelle ----------
-- Tutto passa dalle funzioni qui sotto, che verificano il PIN.
alter table ingredients  enable row level security;
alter table products     enable row level security;
alter table recipe_items enable row level security;
alter table app_pins     enable row level security;

-- ---------- Helper interni (non esposti all'app) ----------

create or replace function _role_for_pin(p_pin text)
returns text
language sql
security definer
set search_path = public
as $$
  select role from app_pins
  where pin_hash = crypt(p_pin, pin_hash)
  limit 1;
$$;

create or replace function _require_admin(p_pin text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if _role_for_pin(p_pin) is distinct from 'admin' then
    raise exception 'Permesso negato';
  end if;
end;
$$;

-- ---------- API: login e lettura stato ----------

create or replace function login(p_pin text)
returns text
language sql
security definer
set search_path = public
as $$
  select _role_for_pin(p_pin);
$$;

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
              -- porzioni realizzabili = minimo tra (disponibile / richiesto)
              -- sugli ingredienti non infiniti; null se nessun vincolo.
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

-- ---------- API: conferma ordine (scala gli ingredienti) ----------

create or replace function confirm_order(p_pin text, p_items jsonb)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role  text;
  v_sold  text;
  v_short record;
begin
  v_role := _role_for_pin(p_pin);
  if v_role not in ('editor','admin') then
    raise exception 'Permesso negato';
  end if;

  -- Rifiuta se l'ordine contiene un prodotto esaurito.
  select p.name into v_sold
  from jsonb_array_elements(p_items) e
  join products p on p.id = (e->>'product_id')::bigint
  where (e->>'qty')::numeric > 0 and p.is_sold_out
  limit 1;
  if v_sold is not null then
    raise exception 'Prodotto esaurito: %', v_sold;
  end if;

  -- Verifica disponibilità aggregando il fabbisogno per ingrediente.
  select i.name as name, need.needed as needed, i.quantity as quantity
  into v_short
  from (
    select ri.ingredient_id, sum((e->>'qty')::numeric * ri.qty_required) as needed
    from jsonb_array_elements(p_items) e
    join recipe_items ri on ri.product_id = (e->>'product_id')::bigint
    where (e->>'qty')::numeric > 0
    group by ri.ingredient_id
  ) need
  join ingredients i on i.id = need.ingredient_id
  where not i.is_infinite and i.quantity < need.needed
  limit 1;
  if found then
    raise exception 'Ingrediente insufficiente: % (servono %, disponibili %)',
      v_short.name, v_short.needed, v_short.quantity;
  end if;

  -- Applica il consumo agli ingredienti non infiniti.
  update ingredients i
  set quantity = i.quantity - need.needed
  from (
    select ri.ingredient_id, sum((e->>'qty')::numeric * ri.qty_required) as needed
    from jsonb_array_elements(p_items) e
    join recipe_items ri on ri.product_id = (e->>'product_id')::bigint
    where (e->>'qty')::numeric > 0
    group by ri.ingredient_id
  ) need
  where i.id = need.ingredient_id and not i.is_infinite;

  return get_state(p_pin);
end;
$$;

-- ---------- API: gestione ingredienti (admin) ----------

create or replace function admin_upsert_ingredient(
  p_pin text, p_id bigint, p_name text, p_quantity numeric,
  p_is_infinite boolean, p_sort_order int
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
    insert into ingredients(name, quantity, is_infinite, sort_order)
    values (p_name, p_quantity, p_is_infinite, coalesce(p_sort_order, 0));
  else
    update ingredients set
      name = p_name, quantity = p_quantity,
      is_infinite = p_is_infinite, sort_order = coalesce(p_sort_order, 0)
    where id = p_id;
  end if;
  return get_state(p_pin);
end;
$$;

create or replace function admin_delete_ingredient(p_pin text, p_id bigint)
returns json
language plpgsql security definer set search_path = public
as $$
begin
  perform _require_admin(p_pin);
  delete from ingredients where id = p_id;
  return get_state(p_pin);
end;
$$;

-- ---------- API: gestione prodotti (admin) ----------

create or replace function admin_upsert_product(
  p_pin text, p_id bigint, p_name text, p_price numeric,
  p_threshold numeric, p_is_sold_out boolean, p_sort_order int, p_recipe jsonb
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
    insert into products(name, price, low_stock_threshold, is_sold_out, sort_order)
    values (p_name, p_price, p_threshold, p_is_sold_out, coalesce(p_sort_order, 0))
    returning id into v_id;
  else
    update products set
      name = p_name, price = p_price, low_stock_threshold = p_threshold,
      is_sold_out = p_is_sold_out, sort_order = coalesce(p_sort_order, 0)
    where id = p_id;
    v_id := p_id;
  end if;

  -- Sostituisce completamente la ricetta.
  delete from recipe_items where product_id = v_id;
  insert into recipe_items(product_id, ingredient_id, qty_required)
  select v_id, (e->>'ingredient_id')::bigint, (e->>'qty_required')::numeric
  from jsonb_array_elements(coalesce(p_recipe, '[]'::jsonb)) e
  where (e->>'qty_required')::numeric > 0;

  return get_state(p_pin);
end;
$$;

create or replace function admin_delete_product(p_pin text, p_id bigint)
returns json
language plpgsql security definer set search_path = public
as $$
begin
  perform _require_admin(p_pin);
  delete from products where id = p_id;
  return get_state(p_pin);
end;
$$;

-- ---------- API: gestione PIN (admin) ----------

create or replace function admin_set_pin(p_pin text, p_role text, p_new_pin text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform _require_admin(p_pin);
  if p_role not in ('viewer','editor','admin') then
    raise exception 'Ruolo non valido';
  end if;
  if length(p_new_pin) < 4 then
    raise exception 'Il PIN deve avere almeno 4 cifre';
  end if;
  insert into app_pins(role, pin_hash)
  values (p_role, crypt(p_new_pin, gen_salt('bf')))
  on conflict (role) do update set pin_hash = excluded.pin_hash;
end;
$$;

-- ---------- Permessi di esecuzione ----------
-- Gli helper interni non sono richiamabili dall'app.
revoke all on function _role_for_pin(text) from public;
revoke all on function _require_admin(text) from public;
-- L'app (chiave anon) può chiamare solo queste funzioni.
grant execute on function login(text)                                             to anon, authenticated;
grant execute on function get_state(text)                                         to anon, authenticated;
grant execute on function confirm_order(text, jsonb)                              to anon, authenticated;
grant execute on function admin_upsert_ingredient(text, bigint, text, numeric, boolean, int) to anon, authenticated;
grant execute on function admin_delete_ingredient(text, bigint)                   to anon, authenticated;
grant execute on function admin_upsert_product(text, bigint, text, numeric, numeric, boolean, int, jsonb) to anon, authenticated;
grant execute on function admin_delete_product(text, bigint)                      to anon, authenticated;
grant execute on function admin_set_pin(text, text, text)                         to anon, authenticated;

-- ---------- PIN predefiniti (CAMBIALI dopo il primo accesso!) ----------
--   viewer = 1111   editor = 2222   admin = 9999
insert into app_pins(role, pin_hash) values
  ('viewer', crypt('1111', gen_salt('bf'))),
  ('editor', crypt('2222', gen_salt('bf'))),
  ('admin',  crypt('9999', gen_salt('bf')))
on conflict (role) do nothing;

-- ---------- Dati di esempio (solo se il DB è vuoto) ----------
do $$
declare
  v_pane bigint; v_sal bigint; v_ham bigint; v_pep bigint; v_cip bigint;
  v_p1 bigint; v_p2 bigint; v_p3 bigint;
begin
  if (select count(*) from products) = 0 and (select count(*) from ingredients) = 0 then
    insert into ingredients(name, quantity, is_infinite, sort_order) values ('Pane', 0, true, 1) returning id into v_pane;
    insert into ingredients(name, quantity, is_infinite, sort_order) values ('Salamella', 100, false, 2) returning id into v_sal;
    insert into ingredients(name, quantity, is_infinite, sort_order) values ('Hamburger', 50, false, 3) returning id into v_ham;
    insert into ingredients(name, quantity, is_infinite, sort_order) values ('Peperoni', 200, false, 4) returning id into v_pep;
    insert into ingredients(name, quantity, is_infinite, sort_order) values ('Cipolla', 200, false, 5) returning id into v_cip;

    insert into products(name, price, low_stock_threshold, sort_order) values ('Panino salamella', 3.50, 10, 1) returning id into v_p1;
    insert into recipe_items values (v_p1, v_pane, 1), (v_p1, v_sal, 1);

    insert into products(name, price, low_stock_threshold, sort_order) values ('Hamburger', 4.00, 10, 2) returning id into v_p2;
    insert into recipe_items values (v_p2, v_pane, 1), (v_p2, v_ham, 1);

    insert into products(name, price, low_stock_threshold, sort_order) values ('Panino salamella, peperoni e cipolla', 4.50, 10, 3) returning id into v_p3;
    insert into recipe_items values (v_p3, v_pane, 1), (v_p3, v_sal, 1), (v_p3, v_pep, 2), (v_p3, v_cip, 1);
  end if;
end $$;
