# Inventario Cucina

App web (desktop + mobile) per gestire l'inventario della cucina e comporre ordini,
con inventario basato sugli **ingredienti**: la disponibilità di ogni prodotto è
calcolata automaticamente dagli ingredienti che lo compongono.

## Ruoli (accesso con PIN)

- **Visualizzatore** — vede solo prodotti e quantità rimanente.
- **Cassa (editor)** — compone un ordine (+/−), vede il totale in € e conferma: gli
  ingredienti vengono scalati. L'ordine non viene salvato.
- **Amministratore** — gestisce ingredienti (quantità, "illimitato"), prodotti
  (prezzo, ricetta, soglia di avviso, "esaurito") e i PIN.

Simboli stato prodotto: 🔴 esaurito · ⚠️ in esaurimento (sotto soglia) · ∞ illimitato.

## Stack

- Frontend: React + Vite + Tailwind (build statica).
- Backend: Supabase (PostgreSQL). Nessun account utente: i PIN sono verificati da
  funzioni del database; le tabelle non sono accessibili direttamente (RLS attiva).
- Hosting: GitHub Pages (gratuito).

---

## 1) Configurare Supabase (gratis)

1. Vai su https://supabase.com → accedi con GitHub → **New project** (piano Free).
2. A progetto creato, apri **SQL Editor** → **New query**, incolla tutto il contenuto
   di [`supabase/schema.sql`](supabase/schema.sql) e premi **Run**.
   - Crea tabelle, funzioni, PIN predefiniti e dati di esempio.
   - **PIN iniziali:** visualizzatore `1111`, cassa `2222`, admin `9999`.
     Cambiali dall'app (Admin → PIN) dopo il primo accesso.
3. In **Project Settings → API** copia:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public key** → `VITE_SUPABASE_ANON_KEY`

## 2) Sviluppo in locale

```bash
cp .env.example .env      # inserisci URL e anon key
npm install
npm run dev
```

## 3) Deploy su GitHub Pages (gratis)

1. Su GitHub, apri la repo → **Settings → Pages** → *Build and deployment* →
   **Source: GitHub Actions**.
2. **Settings → Secrets and variables → Actions → Variables** → aggiungi due
   *Repository variables*:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Fai push su `main`: il workflow builda e pubblica automaticamente.
   URL finale: `https://<owner>.github.io/inventario-cucina/`

> Nota: se cambi il nome della repo, aggiorna `base` in `vite.config.ts`.

## Note

- La chiave anon è pubblica per natura: la sicurezza è garantita da PIN + RLS +
  funzioni `security definer`. Adatta a uno stand/sagra, non a dati sensibili.
- Il piano Free di Supabase mette in pausa il progetto dopo ~1 settimana di totale
  inattività; i dati restano, basta riaprire il progetto dalla dashboard.
