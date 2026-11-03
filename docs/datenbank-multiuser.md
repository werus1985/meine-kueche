# Datenbankstruktur: mehrbenutzerfähig und zukunftssicher

Stand: 2026-10-23  
Bezugsstand: `supabase/migrations/20261023115740_remote_schema.sql`, `index.html`

## 1. Kurzfazit

Die aktuelle Struktur vermischt drei Konzepte, die getrennt werden müssen:

| Konzept | Bedeutung | Gehört in |
|---|---|---|
| **Benutzer** | angemeldete Person (`auth.users.id`) | `profiles`, `user_id` |
| **Haushalt** | gemeinsamer Datenbereich mehrerer Benutzer | `household_id` |
| **Urheber** | wer einen Datensatz angelegt/geändert hat | `created_by`, `updated_by` |

`owner_id` ist derzeit eine Mischung aus allen drei Konzepten. Genau dadurch entstehen die Redundanzen und die Probleme beim Teilen eines Haushalts.

Wenn du mit „jeder User soll eine `owner_id` haben“ die Identität des Benutzers meinst: Die steckt bereits in `auth.users.id`. Ein zusätzliches `owner_id` in `profiles` wäre redundant. In Fachtabellen ist `created_by` das richtige Feld, wenn du festhalten willst, wer etwas angelegt hat. `owner_id` als Berechtigungsfeld gibt es im Zielmodell nicht mehr.

**Ziel in einem Satz:** Jede fachliche Tabelle hängt über `household_id` an genau einem Haushalt. Der Zugriff wird über eine Mitgliedschaftstabelle mit Rollen/Rechten geregelt. `owner_id` verschwindet aus den Fachtabellen; `created_by` bleibt höchstens als Audit-Feld.

Wichtig: Ein Benutzer kann in mehreren Haushalten Mitglied sein (die App erlaubt heute bis zu fünf). Deshalb ist eine **n:m-Mitgliedschaftstabelle** nötig – nicht eine `household_id`-Spalte am Benutzer.

---

## 2. Ist-Zustand

### 2.1 Tabellen

| Tabelle | Aktueller Mandant | Probleme |
|---|---|---|
| `kitchen_households` | `owner_id` | Haushalt gehört genau einem Benutzer; keine Mitglieder, keine Rollen |
| `kitchen_items` | `owner_id` + `household_id` | `household_id` ist `text`, nullable und **ohne Foreign Key**; `owner_id` widerspricht dem Haushaltsgedanken |
| `kitchen_categories` | `owner_id` + `household_id` | `owner_id` redundant; RLS erlaubt nur dem Haushalts-Eigentümer den Zugriff, nicht Mitgliedern |
| `kitchen_household_locations` | `owner_id` + `household_id` | `owner_id` redundant; `household_id` ohne Foreign Key |
| `kitchen_units` | `owner_id` | benutzerweit statt haushaltsweit; unklar, ob das gewollt ist |
| `kitchen_unit_steps` | **global** | keine `owner_id`, keine `household_id`; alle angemeldeten Benutzer teilen und ändern dieselben Schrittgrößen |
| `kitchen_category_settings` | `owner_id` | benutzerweit; doppelte Spalten `category`/`category_name` und `warning_days`/`yellow_days` |
| `kitchen_quick_filter_sets` | `owner_id` | eine Zeile pro Benutzer; die App schreibt sogar in fremde Zeilen (siehe unten) |
| `storage.objects` (Bucket `product-photos`) | Pfad `{user_id}/…` | Policies erlauben jedem angemeldeten Benutzer Zugriff auf **alle** Fotos |

### 2.2 Kritische Sicherheitsprobleme (sofort beheben)

Diese Punkte sind unabhängig vom Umbau und sollten zuerst korrigiert werden. Durch permissive RLS-Policies (`using (true)`) werden die eigentlich restriktiven Policies ausgehebelt, weil sich Policies pro Befehl mit `OR` verknüpfen.

1. **`kitchen_items`: „Shared access for authenticated users“**
   - `supabase/migrations/20261023115740_remote_schema.sql:245-249`
   - `FOR ALL USING (true) WITH CHECK (true)`
   - Folge: **Jeder angemeldete Benutzer kann alle Artikel aller Benutzer lesen, ändern und löschen.** Die Policies `owner_id = auth.uid()` sind dadurch wirkungslos.

2. **`kitchen_quick_filter_sets`: `USING (true)`**
   - `supabase/migrations/20261023115740_remote_schema.sql:257-261`
   - Folge: Alle Schnellfilter aller Benutzer sind lesbar und änderbar.
   - Verstärkend im Client: `index.html:2034-2066` liest alle Zeilen und schreibt in die `owner_id` der **ersten fremden Zeile**. Das ist ein Cross-Tenant-Write.

3. **`kitchen_unit_steps`: `USING (true)` auf allen Befehlen**
   - `supabase/migrations/20261023115740_remote_schema.sql:263-282`
   - Folge: Ein Benutzer ändert die Schrittgrößen für alle anderen Benutzer.

4. **Storage-Policies für `product-photos`**
   - `supabase/migrations/20261023115740_remote_schema.sql:290-309`
   - Folge: Jeder angemeldete Benutzer kann alle Produktfotos lesen, überschreiben und löschen.
   - Zusätzlich prüfen, ob der Bucket `public` ist. Wenn ja: auf **private** stellen.

5. **`anon` hat weitreichende Grants**
   - z. B. `TRUNCATE`, `REFERENCES`, `TRIGGER` (`remote_schema.sql:315-427`)
   - RLS schützt nicht vor `TRUNCATE`. Über PostgREST ist das zwar nicht direkt erreichbar, aber es verstößt gegen Least Privilege.

6. **Kein Foreign Key auf `kitchen_items.household_id` und `kitchen_household_locations.household_id`**
   - Folge: verwaiste Datensätze, falsche Haushalts-IDs, kein Cascade beim Löschen eines Haushalts.

### 2.3 Strukturelle Probleme

- **Redundanz:** `owner_id` in jeder Tabelle, obwohl der Haushalt bereits den Mandanten bestimmt.
- **Inkonsistenz:** `kitchen_items` nutzt `household_id` als `text` ohne FK; `kitchen_categories` hat einen FK. Gleiche Daten, unterschiedliche Regeln.
- **Doppelte Spalten:** `kitchen_category_settings.category` und `category_name` sowie `warning_days` und `yellow_days` können auseinanderlaufen. Der Unique-Index auf `category_name` greift bei `NULL` nicht.
- **Globale Tabellen ohne Mandant:** `kitchen_unit_steps` ist weder Benutzer- noch Haushalts-spezifisch.
- **Text-IDs:** `id text` wird vom Client erzeugt (`index.html:2274`). Das ist offline-freundlich, aber ohne Format-Constraint und ohne Kollisionsschutz über Mandanten hinweg. Besser: `uuid` (der Client kann `crypto.randomUUID()` nutzen).
- **Zeitstempel vom Client:** `updated_at` wird beim Upsert vom Client gesetzt. Ein Client kann damit die Konfliktlogik manipulieren. `updated_at` sollte serverseitig per Trigger gesetzt werden.
- **Soft Delete als Boolean:** `deleted boolean` verhindert keine Wiederauferstehung, hat aber keinen Zeitpunkt für Aufräumjobs. Besser `deleted_at timestamptz`.
- **Client-seitige Limits:** „maximal 5 Haushalte“ steht nur in `index.html:2210`; die Datenbank erzwingt nichts.
- **Lokaler Speicher nicht benutzerspezifisch:** `localStorage`-Keys wie `kueche-v1-items` (`index.html:2005-2006`) gelten für alle Konten auf demselben Gerät. Beim Kontowechsel können Daten des vorherigen Benutzers angezeigt oder in das neue Konto hochgeladen werden.
- **Gefährlicher Full-Sync:** `pushCloud()` liest alle Zeilen ohne Haushaltsfilter und löscht Cloud-Haushalte, die lokal nicht vorkommen (`index.html:2698`). In einem Mehrbenutzer-Haushalt würde ein Mitglied potenziell den Haushalt eines anderen „aufräumen“. Das muss durch explizite Operationen ersetzt werden.

---

## 3. Zielmodell

### 3.1 Grundprinzipien

1. **Ein Mandant pro Fachzeile:** `household_id` ist `not null` und hat einen Foreign Key.
2. **Zugriff über Mitgliedschaft:** `household_members(user_id, household_id, role)`.
3. **Rechte über Rollen:** `household_roles` enthält die Berechtigungen; RLS prüft Rechte, nicht Rollennamen.
4. **`owner_id` entfällt.** Ein „Eigentümer“ ist eine Rolle in `household_members`.
5. **`created_by`/`updated_by` sind Audit, keine Autorisierung.**
6. **Benutzerspezifische Daten** bekommen `user_id` (nicht `owner_id`).
7. **IDs als `uuid`**, serverseitige Zeitstempel, echte Foreign Keys.

### 3.2 Beziehungen

```
auth.users 1 ─── 1 profiles
auth.users 1 ─── n household_members n ─── 1 households
                                      │
                                       ├── 1 ─── n kitchen_items
                                       ├── 1 ─── n kitchen_products
                                      ├── 1 ─── n kitchen_categories
                                      ├── 1 ─── n kitchen_locations
                                      ├── 1 ─── n kitchen_units
                                      ├── 1 ─── n kitchen_category_settings
                                      └── 1 ─── n kitchen_quick_filters

household_members.role ─── 1 household_roles
household_roles 1 ─── n household_role_permissions? (hier: Rechte direkt als Boolean-Spalten)
kitchen_products 1 ─── n kitchen_items

auth.users 1 ─── n kitchen_quick_filter_preferences n ─── 1 kitchen_quick_filters (optional)
auth.users 1 ─── n kitchen_unit_preferences (persönliche Schrittgrößen, optional)
```

### 3.3 Tabellen im Zielbild

#### `profiles`
Benutzerprofil, 1:1 zu `auth.users`. Kein `household_id` am Profil, weil ein Benutzer in mehreren Haushalten sein kann.

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

#### `households`
Der gemeinsame Datenbereich. **Kein `owner_id`.**

```sql
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 80),
  external_lookup_enabled boolean not null default true,
  gemini_api_key text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

`external_lookup_enabled` steuert, ob beim Anlegen unbekannter Barcodes eine
externe Produktdatenbank (Open Food Facts) gefragt werden darf. Lokal
bekannte Produkte werden nie extern gesucht.

`gemini_api_key` ist der optionale **gemeinsame KI-Key** des Haushalts. Alle
Mitglieder können ihn lesen und nutzen (bewusst geteilt), ändern dürfen ihn
nur Eigentümer über die bestehende `manage_household`-Policy.

#### `user_ai_settings`
Persönlicher Gemini-API-Key pro Nutzer (Bring your own Key). Bewusst **nicht**
in `profiles`, weil Haushaltsmitglieder die Profile gegenseitig lesen dürfen.
Die Tabelle ist strikt selbst-gesperrt: Jeder sieht und ändert nur seine
eigene Zeile.

```sql
create table public.user_ai_settings (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  gemini_api_key text not null check (length(btrim(gemini_api_key)) between 10 and 200),
  updated_at     timestamptz not null default now()
);
```

Rangfolge bei einer KI-Anfrage: persönlicher Key → gemeinsamer Haushalts-Key →
Hinweis in der Oberfläche. Einen serverweiten Fallback gibt es nicht.

#### `household_roles`
Zentrale Rechte-Definition. Damit ist „nur lesen, nicht schreiben“ ein Datenwert und keine Code-Änderung.

```sql
create table public.household_roles (
  key text primary key,                 -- 'owner', 'editor', 'viewer'
  name text not null,
  can_read boolean not null default true,
  can_write boolean not null default false,
  can_manage_members boolean not null default false,
  can_manage_household boolean not null default false
);
```

Empfohlene Startwerte:

| Rolle | Lesen | Schreiben | Mitglieder verwalten | Haushalt verwalten |
|---|---|---|---|---|
| `owner` | ja | ja | ja | ja |
| `editor` | ja | ja | nein | nein |
| `viewer` | ja | nein | nein | nein |

Später kannst du weitere Rechte ergänzen, z. B. `can_manage_categories`, ohne die RLS-Struktur zu ändern.

#### `household_members`
Die zentrale Zuordnung Benutzer ↔ Haushalt.

```sql
create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer' references public.household_roles(key),
  joined_at timestamptz not null default now(),
  invited_by uuid references auth.users(id),
  primary key (household_id, user_id)
);
create index household_members_user_idx on public.household_members(user_id);
```

Regeln:
- Der Ersteller eines Haushalts wird automatisch `owner`.
- Der letzte `owner` darf nicht entfernt oder herabgestuft werden (Trigger).
- Ein Benutzer kann mehrere Haushalte haben; die App zeigt sie als Auswahl.

#### `household_invites`
Einladungen per E-Mail/Token. Verhindert, dass jemand beliebige Benutzer ohne Zustimmung hinzufügt.

```sql
create table public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  email text not null,
  role text not null default 'viewer' references public.household_roles(key),
  token_hash text not null unique,
  invited_by uuid not null references auth.users(id),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
```

Das Token wird nur im Klartext an die E-Mail geschickt; in der Datenbank liegt der Hash.

#### `kitchen_categories` und `kitchen_locations`
Haushaltsweit, mit eindeutigem Namen pro Haushalt (case-insensitiv).

```sql
create table public.kitchen_categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index kitchen_categories_household_name_uidx
  on public.kitchen_categories (household_id, lower(btrim(name)));
```

`kitchen_locations` analog, ggf. mit `sort_order`.

#### `kitchen_units`
Empfehlung: **haushaltsweit**, inklusive `step_size`. Damit sehen alle Mitglieder dieselben Einheiten und Schrittgrößen. Wenn Schrittgrößen persönlich sein sollen, kommt eine separate Tabelle `kitchen_unit_preferences(user_id, unit_id, step_size)` hinzu.

```sql
create table public.kitchen_units (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 40),
  step_size numeric not null default 1 check (step_size > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index kitchen_units_household_name_uidx
  on public.kitchen_units (household_id, lower(btrim(name)));
```

Beim Anlegen eines Haushalts werden die Standardeinheiten (`Stück`, `Packung`, `g`, `kg`, `ml`, `Liter`, `Dose`, `Flasche`) eingefügt.

#### `kitchen_products`
Wiederverwendbares Produktwissen pro Haushalt. Barcode ist optional; wenn vorhanden, ist er pro Haushalt eindeutig. Name, Kategorie, Einheit und Foto sind Gruppeneigenschaften und werden per Trigger auf verknüpfte Artikel gespiegelt. Jeder Artikel gehört zu einer Produktgruppe; Gruppen ohne aktive Artikel bleiben als Wissen erhalten.

```sql
create table public.kitchen_products (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  barcode text check (barcode is null or barcode ~ '^[0-9]{8,14}$'),
  name text not null check (length(btrim(name)) between 1 and 200),
  category_id uuid references public.kitchen_categories(id) on delete set null,
  unit_id uuid references public.kitchen_units(id) on delete set null,
  last_location_id uuid references public.kitchen_locations(id) on delete set null,
  photo_path text,
  seasonal boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index kitchen_products_household_barcode_uidx
  on public.kitchen_products (household_id, barcode) where barcode is not null;
```

`seasonal` schützt eine Gruppe dauerhaft vor der automatischen Aufräumung
(z. B. Weihnachtsgebäck). `last_location_id` ist nur eine Vorgabe für den
nächsten Artikel, kein Gruppenattribut. Menge, MHD, Kaufdatum, Notizen und
Lagerort bleiben pro Artikel; die Einkaufsliste bleibt flach.

##### Trigger und RPCs für Produktgruppen

Die Artikeltabelle hält die Gruppenattribute denormalisiert (schnelle Suchen
und Joins ohne Änderung der bestehenden Queries). Die Produktzeile ist
führend; fünf Trigger und zwei RPCs halten alles konsistent:

| Funktion | Zweck |
| --- | --- |
| `sync_product_fields_on_item` | BEFORE INSERT/UPDATE auf `kitchen_items`: übernimmt Name, Barcode, Kategorie, Einheit und Foto vom Produkt auf den Artikel und validiert die Gruppenzugehörigkeit zum Haushalt. |
| `propagate_product_fields_to_items` | AFTER UPDATE der Gruppenattribute auf `kitchen_products`: verteilt Änderungen auf alle verknüpften Artikel (nur bei tatsächlich abweichenden Werten). |
| `remember_product_location` | AFTER INSERT/UPDATE auf `kitchen_items`: merkt sich den Lagerort des letzten Vorratsartikels einer Gruppe als Vorgabe (`last_location_id`). |
| `validate_product_household_refs` | BEFORE INSERT/UPDATE auf `kitchen_products`: Kategorie/Einheit/Lagerort gehören zum selben Haushalt. |
| `validate_item_household_refs` | prüft zusätzlich `product_id` gegen den Haushalt des Artikels. |
| `find_or_create_kitchen_product(...)` | RPC: legt ein Produkt an oder liefert das existing per (Haushalt, Barcode); Produkte ohne Barcode werden immer neu angelegt (Wiederverwendung dort über die Produktsuche). |
| `update_kitchen_product_item(...)` | RPC: speichert Gruppenattribute und Einzelattribute eines Artikels atomar; prüft vorher die Artikel-Version (optimistisches Sperren). |
| `delete_unused_kitchen_product(...)` | RPC: löscht eine Gruppe **nur ohne aktive Artikel** (Einstellungen) und liefert den Foto-Pfad zum Aufräumen im Storage. |
| `cleanup_unused_kitchen_products(...)` | RPC: räumt verwaiste, nicht-saisonale Gruppen nach einer Inaktivitätsfrist auf (Standard 180 Tage); liefert gelöschte IDs und Foto-Pfade. |

Folgerungen für die Lösch-RPCs: `delete_category` und `delete_unit` setzen
den Fallback zuerst auf den Produkten (der Propagate-Trigger zieht ihn auf
verknüpfte Artikel) und danach nur noch auf Artikeln **ohne** Produktgruppe –
verknüpfte Artikel werden sonst doppelt angefasst und ihre `version` zweimal
erhöht. `delete_location` betrifft Artikel direkt (Lagerort ist kein
Gruppenattribut) und setzt zusätzlich `kitchen_products.last_location_id`.

Produkte haben **keine Delete-Policy** und kein DELETE-Grant: Gruppenwissen
soll erhalten bleiben, auch wenn alle Artikel (soft-)gelöscht sind. Löschen
ist ausschließlich über die beiden Security-Definer-RPCs möglich, die die
Invariante „keine aktiven Artikel“ selbst prüfen. Ein Haushalt kaskadiert
weiterhin inklusive seiner Produkte.


#### `kitchen_recipes`, `kitchen_recipe_ingredients`, `kitchen_recipe_steps`
Rezepte pro Haushalt. Der Kopf enthält Titel, Beschreibung,
**Basis-Portionen**, Quelle (`manual`, `chat`, `link`, `photo`), optionalen
Quell-Link und Foto; Zutaten und Schritte hängen mit Reihenfolge kaskadierend
am Rezept. Portionen werden in der Oberfläche nur skaliert – gespeichert
bleibt die Basis-Portionszahl.

```sql
create table public.kitchen_recipes (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title        text not null check (length(btrim(title)) between 1 and 200),
  description  text not null default '',
  servings     integer not null default 4 check (servings between 1 and 100),
  source       text not null default 'manual'
    check (source in ('manual', 'chat', 'link', 'photo')),
  source_url   text,
  photo_path   text,
  created_by   uuid default auth.uid() references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  unique (household_id, id)
);

create table public.kitchen_recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  recipe_id uuid not null,
  name text not null check (length(btrim(name)) between 1 and 200),
  qty numeric check (qty is null or qty > 0),
  unit text,
  optional boolean not null default false,
  sort_order integer not null default 0,
  foreign key (household_id, recipe_id)
    references public.kitchen_recipes (household_id, id) on delete cascade
);

create table public.kitchen_recipe_steps (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  recipe_id uuid not null,
  text text not null default '',
  sort_order integer not null default 0,
  foreign key (household_id, recipe_id)
    references public.kitchen_recipes (household_id, id) on delete cascade
);
```

#### `kitchen_items`
Nur noch `household_id` als Mandant. Kategorien, Lagerorte und Einheiten als Foreign Keys statt freier Texte.

```sql
create table public.kitchen_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  product_id uuid references public.kitchen_products(id) on delete set null,
  kind text not null check (kind in ('stock', 'shop')),
  name text not null check (length(btrim(name)) between 1 and 200),
  qty numeric check (qty is null or qty >= 0),
  unit_id uuid references public.kitchen_units(id) on delete set null,
  location_id uuid references public.kitchen_locations(id) on delete set null,
  category_id uuid references public.kitchen_categories(id) on delete set null,
  expiry date,
  purchased_at date,
  checked boolean not null default false,
  notes text not null default '',
  photo_path text,
  deleted_at timestamptz,
  version integer not null default 1,
  created_by uuid not null default auth.uid() references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index kitchen_items_household_kind_idx
  on public.kitchen_items (household_id, kind) where deleted_at is null;
create index kitchen_items_household_expiry_idx
  on public.kitchen_items (household_id, expiry) where kind = 'stock' and deleted_at is null;
create index kitchen_items_household_updated_idx
  on public.kitchen_items (household_id, updated_at);
```

Hinweise:
- `qty numeric` statt `text`: Die App kann weiterhin komfortabel parsen, aber die Datenbank hat gültige Zahlen. Wenn freie Mengen wie „nach Bedarf“ nötig sind: `qty numeric` + `qty_note text`.
- `version` ermöglicht optimistisches Sperren: Update nur, wenn die erwartete Version noch stimmt. Das ist bei mehreren Geräten deutlich sicherer als reines Last-Write-Wins.
- `deleted_at` statt `deleted boolean`; Tombstones können nach z. B. 30 Tagen per Job gelöscht werden.
- `category_id`/`location_id` mit `on delete set null` oder – besser – Löschen über eine RPC, die Artikel vorher auf „Allgemein“ verschiebt. `restrict` verhindert versehentlichen Datenverlust.

#### `kitchen_category_settings`
Haushaltsweit, ohne doppelte Spalten.

```sql
create table public.kitchen_category_settings (
  household_id uuid not null references public.households(id) on delete cascade,
  category_id uuid not null references public.kitchen_categories(id) on delete cascade,
  warning_days integer not null default 2 check (warning_days >= 0),
  warning_basis text not null default 'expiry' check (warning_basis in ('expiry', 'purchase')),
  default_sort text not null default 'auto' check (default_sort in ('auto', 'expiry', 'purchase', 'name')),
  updated_at timestamptz not null default now(),
  primary key (household_id, category_id)
);
```

Falls `default_sort` eine persönliche Einstellung sein soll, gehört sie in eine separate Tabelle `user_category_preferences(user_id, category_id, default_sort)`. Warnregeln sind dagegen typischerweise haushaltsweit.

#### `kitchen_quick_filters`
Schnellfilter gehören zum **Haushalt**, nicht zum Benutzer. Das ist die passendere Semantik:

- Sie beziehen sich auf die Kategorien des Haushalts.
- Ein neues Mitglied sieht die vorhandenen Filter sofort und muss sie nicht neu anlegen.
- Es gibt nur eine Quelle der Wahrheit; Filter laufen nicht zwischen Mitgliedern auseinander.
- `viewer` darf sie benutzen, aber nicht ändern; `editor`/`owner` dürfen sie pflegen.

```sql
create table public.kitchen_quick_filters (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name         text not null check (length(btrim(name)) between 1 and 80),
  sort_order   integer not null default 0,
  created_by   uuid default auth.uid() references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (household_id, id)
);

create unique index kitchen_quick_filters_household_name_uidx
  on public.kitchen_quick_filters (household_id, lower(btrim(name)));

create table public.kitchen_quick_filter_categories (
  household_id uuid not null,
  filter_id    uuid not null,
  category_id  uuid not null,
  primary key (filter_id, category_id),
  foreign key (household_id, filter_id)
    references public.kitchen_quick_filters (household_id, id) on delete cascade,
  foreign key (household_id, category_id)
    references public.kitchen_categories (household_id, id) on delete cascade
);
```

Warum eine Zeile pro Filter statt eines JSONB-Arrays pro Benutzer?

- Zwei Mitglieder können gleichzeitig unterschiedliche Filter bearbeiten, ohne sich gegenseitig zu überschreiben.
- Die Join-Tabelle hält die Kategorie-Referenzen gültig und verhindert Cross-Household-Referenzen.
- Ein gelöschter Filter verschwindet sauber über `on delete cascade`.

Wenn später persönliche Reihenfolge oder Ausblenden gewünscht ist, kommt eine **Präferenz**-Tabelle dazu – ohne die Filter selbst zu duplizieren:

```sql
create table public.kitchen_quick_filter_preferences (
  user_id    uuid not null references auth.users(id) on delete cascade,
  filter_id  uuid not null references public.kitchen_quick_filters(id) on delete cascade,
  sort_order integer,
  hidden     boolean not null default false,
  primary key (user_id, filter_id)
);
```

Das ist der saubere Hybrid: **Inhalt haushaltsweit, Darstellung persönlich.**

#### `external_product_mappings`
Gelerntes Wissen aus externen Produktdatenbanken (Open Food Facts). Wenn ein
unbekannter Barcode einen Treffer liefert, schlägt die App Kategorie und
Einheit vor; speichert der Nutzer den Artikel, merkt sich der Haushalt die
Zuordnung der externen Tags zu seiner Kategorie/Einheit. Beim nächsten
Barcode mit denselben Tags gewinnt dieses gelernte Mapping vor dem
Wörterbuch-Fallback. So wird der externe Lookup mit der Zeit überflüssig.

```sql
create table public.external_product_mappings (
  household_id uuid not null references public.households(id) on delete cascade,
  source       text not null default 'openfoodfacts',
  tag          text not null check (length(btrim(tag)) between 1 and 200),
  category_id  uuid references public.kitchen_categories(id) on delete set null,
  unit_id      uuid references public.kitchen_units(id) on delete set null,
  updated_at   timestamptz not null default now(),
  primary key (household_id, source, tag)
);

create index external_product_mappings_household_idx
  on public.external_product_mappings (household_id);
```

Die Tabelle ist bewusst haushaltsweit (nicht pro Benutzer): Kategorie- und
Einheiten-Zuordnungen sind Stammdaten des Haushalts und sollen für alle
Mitglieder gelten.

#### `kitchen_unit_steps`
Entfällt, wenn `step_size` in `kitchen_units` liegt. Falls persönliche Schrittgrößen gewünscht sind:

```sql
create table public.kitchen_unit_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  unit_id uuid not null references public.kitchen_units(id) on delete cascade,
  step_size numeric not null check (step_size > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, unit_id)
);
```

---

## 4. Row Level Security (RLS)

### 4.1 Hilfsfunktionen

RLS-Policies sollten nicht direkt gegen `household_members` joinen, wenn dieselbe Tabelle selbst geschützt ist (Rekursionsgefahr). Stattdessen `security definer`-Funktionen mit festem `search_path`:

```sql
create or replace function public.is_household_member(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.household_members m
    where m.household_id = p_household_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.has_household_permission(
  p_household_id uuid,
  p_permission text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select case p_permission
      when 'read' then r.can_read
      when 'write' then r.can_write
      when 'manage_members' then r.can_manage_members
      when 'manage_household' then r.can_manage_household
      else false
    end
    from public.household_members m
    join public.household_roles r on r.key = m.role
    where m.household_id = p_household_id
      and m.user_id = auth.uid()
  ), false);
$$;
```

Wichtig:
- `security definer` + `set search_path` verhindert Manipulation über den Suchpfad.
- Die Funktionen dürfen nicht von `anon` ausführbar sein.
- Die Funktionen umgehen RLS (Eigentümer `postgres`), was hier gewollt ist.
- `stable` hilft dem Planer; zusätzlich `(select auth.uid())` in Policies für bessere Performance.
- `using (true)` ist nur für globale, schreibgeschützte Katalogtabellen wie `household_roles` vertretbar – niemals für Mandantendaten.

### 4.2 Muster-Policies für Fachtabellen

```sql
alter table public.kitchen_items enable row level security;

create policy kitchen_items_select on public.kitchen_items
  for select to authenticated
  using (public.has_household_permission(household_id, 'read'));

create policy kitchen_items_insert on public.kitchen_items
  for insert to authenticated
  with check (public.has_household_permission(household_id, 'write'));

create policy kitchen_items_update on public.kitchen_items
  for update to authenticated
  using (public.has_household_permission(household_id, 'write'))
  with check (public.has_household_permission(household_id, 'write'));

create policy kitchen_items_delete on public.kitchen_items
  for delete to authenticated
  using (public.has_household_permission(household_id, 'write'));
```

Analog für `kitchen_categories`, `kitchen_locations`, `kitchen_units`, `kitchen_category_settings`.

Für `kitchen_quick_filters` gilt: lesen dürfen alle Mitglieder, schreiben nur `can_write`. Die Zuordnungstabelle `kitchen_quick_filter_categories` wird genauso geschützt.

```sql
create policy quick_filters_select on public.kitchen_quick_filters
  for select to authenticated
  using (public.has_household_permission(household_id, 'read'));

create policy quick_filters_insert on public.kitchen_quick_filters
  for insert to authenticated
  with check (public.has_household_permission(household_id, 'write'));

create policy quick_filters_update on public.kitchen_quick_filters
  for update to authenticated
  using (public.has_household_permission(household_id, 'write'))
  with check (public.has_household_permission(household_id, 'write'));

create policy quick_filters_delete on public.kitchen_quick_filters
  for delete to authenticated
  using (public.has_household_permission(household_id, 'write'));
```

Persönliche Präferenzen (`kitchen_quick_filter_preferences`) sind nur für die eigene `user_id` lesbar und schreibbar; zusätzlich muss man Mitglied des Haushalts sein, zu dem der Filter gehört.

### 4.3 Haushalte und Mitglieder

- `households`: lesbar für Mitglieder; ändern/löschen nur mit `manage_household`.
- `household_members`: lesbar für eigene Mitgliedschaft oder mit `manage_members`; schreiben **nur über RPCs** (siehe unten), damit niemand sich selbst zum Owner macht.
- `household_invites`: lesbar für Einladende/Manager; accepteren über RPC.

### 4.4 RPCs statt direkter schreibender Zugriffe

Diese Operationen sollten als `security definer`-Funktionen laufen, weil sie mehrere Tabellen konsistent ändern und Rechte prüfen müssen:

| RPC | Zweck |
|---|---|
| `create_household(name)` | Haushalt + Owner-Mitgliedschaft + Standardeinheiten atomar anlegen |
| `add_household_member(household_id, email, role)` | Mitglied per E-Mail hinzufügen (nur `manage_members`) |
| `set_member_role(household_id, user_id, role)` | Rolle ändern (nur `manage_members`, letzter Owner geschützt) |
| `remove_household_member(household_id, user_id)` | Mitglied entfernen oder selbst verlassen |
| `create_household_invite(household_id, email, role)` | Einladung erzeugen |
| `accept_household_invite(token)` | Einladung annehmen |
| `delete_household(household_id)` | Nur Owner; löscht per Cascade alle Daten |

Beispiel `create_household`:

```sql
create or replace function public.create_household(p_name text)
returns public.households
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  h public.households;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;

  insert into public.households (name, created_by)
  values (btrim(p_name), auth.uid())
  returning * into h;

  insert into public.household_members (household_id, user_id, role)
  values (h.id, auth.uid(), 'owner');

  -- Standardeinheiten
  insert into public.kitchen_units (household_id, name, step_size, sort_order)
  values
    (h.id, 'Stück', 1, 10),
    (h.id, 'Packung', 1, 20),
    (h.id, 'g', 100, 30),
    (h.id, 'kg', 0.5, 40),
    (h.id, 'ml', 50, 50),
    (h.id, 'Liter', 0.25, 60),
    (h.id, 'Dose', 1, 70),
    (h.id, 'Flasche', 1, 80);

  return h;
end;
$$;
```

### 4.5 Storage

Bucket `product-photos` **privat** stellen und den Pfad an den Haushalt binden:

```
product-photos/{household_id}/{item_id}/{uuid}.jpg
```

Policies prüfen dann:

```sql
-- Beispiel: Lesen
create policy "product photos read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'product-photos'
    and public.has_household_permission(
      public.storage_household_id(name),
      'read'
    )
  );
```

`storage_household_id(name)` extrahiert das erste Pfadsegment sicher als UUID (kein Cast-Fehler bei manipulierten Pfaden). Schreiben/Löschen nur mit `write`-Recht. Zusätzlich `owner_id = auth.uid()` für Uploads prüfen, wenn nur der Uploader überschreiben darf.

---

## 5. Migrationsplan (Expand → Migrate → Contract)

Die App ist ein einzelnes HTML-File mit Offline-Speicher. Ein Big-Bang-Umstieg ist möglich, aber die Daten müssen zuerst sauber abgebildet werden.

### Phase 0 – Sofortmaßnahmen (ohne Schema-Umbau)

1. Policy `"Shared access for authenticated users"` auf `kitchen_items` löschen.
2. Quick-Filter-Policies auf `owner_id = auth.uid()` ändern; im Client das Schreiben in fremde `owner_id` entfernen.
3. `kitchen_unit_steps`: entweder Tabelle neu mit `owner_id` aufbauen oder zunächst schreibgeschützt machen.
4. Storage-Policies auf `owner_id = auth.uid()` und Pfadpräfix `{user_id}/` einschränken.
5. `anon`-Grants entziehen; Bucket privat stellen.

Diese Schritte können die aktuelle App kurzfristig einschränken (z. B. wenn sie sich auf die globale Freigabe verlässt). Deshalb Phase 0 und App-Update gemeinsam ausrollen.

Hinweis: Phase 0 stellt die **alte** Semantik „Schnellfilter pro Benutzer“ sicher. Die neue, haushaltsweite Semantik kommt erst mit dem Zielmodell in Phase 3.

### Phase 1 – Neues Schema anlegen

Neue Tabellen parallel anlegen (siehe `docs/sql/10_zielschema_multiuser.sql`). Alte Tabellen bleiben zunächst bestehen.

### Phase 2 – Daten migrieren

1. **Haushalte:** Für jeden bestehenden `kitchen_households`-Datensatz einen neuen Haushalt anlegen (Mapping `old_id text → new_id uuid`).
2. **Mitglieder:** Für jeden alten Haushalt den bisherigen `owner_id` als `owner` in `household_members` eintragen.
3. **Standard-Haushalt:** Für Benutzer mit Artikeln ohne `household_id` einen Haushalt „Mein Haushalt“ anlegen und zuordnen.
4. **Kategorien/Lagerorte:** pro Haushalt deduplizieren (case-insensitiv); IDs mappen.
5. **Artikel:** `household_id` über Mapping setzen; `category`/`location`/`unit` zu IDs auflösen (fehlende Einträge anlegen); `owner_id → created_by`; `deleted → deleted_at`.
6. **Kategorie-Einstellungen:** `category`/`category_name` zusammenführen; `warning_days`/`yellow_days` zusammenführen; pro Haushalt und Kategorie eindeutig machen.
7. **Einheiten:** benutzerweite Einheiten in die Haushalte kopieren (oder bewusst benutzerweit lassen); `unit_steps` in `step_size` überführen.
8. **Schnellfilter:** pro Haushalt zusammenführen. Die bisherigen Benutzer-Filter (JSONB-Array) in einzelne `kitchen_quick_filters`-Zeilen und `kitchen_quick_filter_categories`-Zuordnungen überführen; Filter mit gleichem normalisiertem Namen pro Haushalt deduplizieren und ihre Kategorien vereinigen. `owner_id` entfällt.
9. **Validieren:** Anzahl Zeilen, Summen, Stichproben, keine `NULL`-`household_id`, keine verwaisten FKs.

Für Text→UUID-Mapping eignen sich temporäre Tabellen:

```sql
create temp table household_map (
  old_id text primary key,
  new_id uuid not null default gen_random_uuid()
);

insert into household_map (old_id)
select id from public.kitchen_households;

insert into public.households (id, name, created_by)
select m.new_id, h.name, h.owner_id
from public.kitchen_households h
join household_map m on m.old_id = h.id;
```

### Phase 3 – App umstellen

Siehe Abschnitt 6. Wichtig: erst lesen, dann schreiben, dann löschen.

### Phase 4 – Aufräumen

1. Alte Policies und Tabellen löschen.
2. `owner_id` aus den Fachtabellen entfernen.
3. Constraints `NOT VALID` anlegen und anschließend `VALIDATE CONSTRAINT`.
4. `notify pgrst, 'reload schema';`
5. Backup/Point-in-Time-Recovery prüfen.

---

## 6. Konkrete App-Anpassungen

Die Datenbank allein reicht nicht; diese Stellen in `index.html` müssen mitziehen:

1. **Haushalte laden:** nicht mehr `kitchen_households.select().eq('owner_id', currentUser.id)`, sondern Mitgliedschaften laden:
   ```js
   .from('household_members')
   .select('household_id, role, households(id, name)')
   ```
   Nur Haushalte anzeigen, in denen man Mitglied ist.

2. **Artikel laden:** gezielt pro aktivem Haushalt oder für alle Mitgliedschaften:
   ```js
   .from('kitchen_items')
   .select('*')
   .eq('household_id', activeHousehold)
   .is('deleted_at', null)
   ```
   Kein ungefiltertes `select('*')` mehr.

3. **Schreiben:** `owner_id` aus allen Upserts entfernen. `created_by`/`updated_by` setzt die Datenbank. `household_id` ist Pflicht.

4. **Rollen in der UI:** Bei `viewer` Schaltflächen zum Anlegen/Bearbeiten/Löschen deaktivieren und zusätzlich serverseitig auf 403/RLS-Fehler reagieren. UI-Sperren sind Komfort, keine Sicherheit.

5. **Haushalt anlegen/umbenennen/löschen:** über RPCs, nicht über direktes Upsert/Delete. Insbesondere das Löschen fremder Haushalte durch `pushCloud()` entfernen.

6. **Mitglieder verwalten:** neue UI für Einladen, Rolle ändern, Entfernen; nur für `owner`/`manage_members` sichtbar.

7. **Schnellfilter:** haushaltsweit laden und speichern. Neue Mitglieder sehen die vorhandenen Filter automatisch; nur `editor`/`owner` dürfen sie anlegen/ändern/löschen. Text „für alle Benutzer“ zu „für diesen Haushalt“ korrigieren. Persönliche Reihenfolge/Ausblenden optional über `kitchen_quick_filter_preferences`.

8. **Kategorie-Einstellungen:** pro Haushalt laden und speichern; doppelte Spalten entfernen.

9. **Einheiten/Schrittgrößen:** pro Haushalt (oder bewusst pro Benutzer) laden; `onConflict` an den neuen Schlüssel anpassen.

10. **Storage:** Pfad `{household_id}/{item_id}/{uuid}.jpg`; signed URLs weiterhin kurzlebig; beim Löschen eines Artikels Foto mit löschen.

11. **Lokaler Speicher:** Keys pro Benutzer und ggf. pro Haushalt namespacen, z. B. `kueche-v1-{userId}-items`. Beim Logout lokale Daten des Benutzers entfernen oder zumindest nicht in ein anderes Konto pushen.

12. **Sync:** Delta-Sync über `updated_at`/`version`, explizite Löschoperationen, keine „lösche alles, was lokal fehlt“-Logik. Bei Konflikten `version` prüfen und den Benutzer entscheiden lassen.

13. **Fehlerbehandlung:** RLS-Fehler (`42501`, HTTP 403) klar anzeigen: „Keine Schreibrechte in diesem Haushalt.“

---

## 7. Weitere Empfehlungen

- **Migrationen versionieren:** `supabase migration new <name>`, lokal mit `supabase db reset` testen, dann `supabase db push`. Den Remote-Dump nicht als wiederkehrende Migrationsdatei verwenden.
- **Grants minimieren:** `anon` bekommt keine Tabellenrechte; `authenticated` nur `select/insert/update/delete`, die es braucht. `TRUNCATE`, `REFERENCES`, `TRIGGER` entziehen.
- **Indizes für RLS und Sync:** `household_members(user_id)`, `(household_id, updated_at)`, `(household_id, kind)`, `(household_id, expiry)`.
- **Constraints:** `not null` für `household_id`, `check` für Enums, Unique-Indizes auf `lower(btrim(name))` pro Haushalt.
- **Trigger:** `updated_at` serverseitig; `updated_by` aus `auth.uid()`; letzter Owner schützen; Standardeinheiten bei Haushaltsanlage.
- **Soft Delete:** `deleted_at` + periodischer Purge-Job (z. B. `pg_cron`) statt Boolean.
- **Optimistic Locking:** `version integer`; Update mit `eq('version', expectedVersion)` und bei 0 betroffenen Zeilen Konflikt melden.
- **Realtime:** Wenn Live-Sync gewünscht ist, Supabase Realtime mit RLS nutzen; Abos auf `household_id` filtern.
- **Backups:** Vor der Migration Snapshot ziehen; Point-in-Time-Recovery im Supabase-Plan prüfen.
- **Tests:** RLS mit pgTAP oder Integrationstests prüfen: Owner darf schreiben, Editor darf schreiben, Viewer nur lesen, Fremder sieht nichts.
- **Datenschutz:** `service_role` niemals im Browser; `auth.users`-E-Mails nicht an alle Haushaltsmitglieder ausliefern (nur Profilnamen).
- **Limit „5 Haushalte“:** Wenn es eine Produktregel ist, serverseitig prüfen (Trigger/RPC). Sonst entfernen; Mitgliedschaften sind etwas anderes als selbst angelegte Haushalte.

---

## 8. Entscheidungen, die du treffen musst

1. **Sind Einheiten haushaltsweit oder benutzerweit?** Empfehlung: haushaltsweit, damit alle Mitglieder dieselben Einheiten sehen.
2. **Sind Warnregeln haushaltsweit oder persönlich?** Empfehlung: haushaltsweit; `default_sort` kann persönlich werden.
3. **Sind Schnellfilter persönlich oder haushaltsweit?** Empfehlung: **haushaltsweit**, weil sie sich auf die gemeinsamen Kategorien beziehen und neue Mitglieder sie sofort nutzen sollen. Persönliche Reihenfolge/Ausblenden kann später über `kitchen_quick_filter_preferences` ergänzt werden.
4. **Sollen Mitglieder per E-Mail direkt hinzugefügt oder erst eingeladen werden?** Empfehlung: Einladung mit Token (Datenschutz und Zustimmung).
5. **Sollen Kategorien/Lagerorte beim Löschen Artikel auf „Allgemein“ verschieben?** Empfehlung: ja, über eine RPC; kein stilles `set null`.
6. **Braucht ihr mehrere Eigentümer pro Haushalt?** Das Modell erlaubt es; der letzte Owner wird geschützt.

Wenn du willst, setze ich als nächsten Schritt die Phase-0-Hotfixes und danach das neue Schema inklusive RPCs und einer ersten App-Anpassung um.

---

## 9. Umsetzungsstand

### 9.1 Datenbank

- `supabase/migrations/20261023120000_multiuser_schema.sql` ist die produktive
  Reset-Migration. Sie löscht das bisherige `public`-Schema und baut das
  Zielmodell neu auf. Prototypdaten gehen dabei verloren (so abgestimmt).
- `docs/sql/10_zielschema_multiuser.sql` ist die vollständige Referenz.
- Die Migration entfernt zusätzlich die alten, offenen Storage-Policies
  („Authenticated users can … product photos“). Ohne diesen Schritt hätten
  weiterhin alle angemeldeten Benutzer Zugriff auf alle Fotos.
- `extensions.gen_random_bytes`/`extensions.digest` werden für
  Einladungstokens genutzt; `pgcrypto` liegt in Supabase im Schema
  `extensions`.
- Getestet in einem temporären PostgreSQL 16 mit nachgebautem
  `auth`-/`storage`-Schema: Reset eines Alt-Schemas, Barcode-Validierung,
  Einladung erstellen/annehmen/doppelt ablehnen, falscher Benutzer,
  Mitgliederliste mit/ohne E-Mail, Lösch-Auffangbecken, Schutz von
  „Allgemein“, Einladung widerrufen, Storage-Zugriff für Mitglieder, Fremde
  und Altpfade.

### 9.2 Next.js-App (`web/`)

- Next.js 16, React 19, Tailwind 4, Server Actions, `src/proxy.ts`.
- Supabase-SSR-Session mit Cookie-Refresh im Proxy; Routenschutz für alle
  Seiten außer `/login`, `/register`, `/auth/*`, Manifest und Icons.
- Rollen werden zusätzlich zur RLS in der UI berücksichtigt (`canWrite`,
  `canManageMembers`, `canManageHousehold`).
- Einladungen: `create_household_invite` liefert das Token nur einmal beim
  Erstellen zurück; die App baut daraus einen kopierbaren Link. Später
  gespeicherte Einladungen zeigen nur E-Mail, Rolle und Ablauf, keinen Link.
- Artikel: Soft Delete, optimistisches Locking über `version`, Foto-Upload
  nach `{household_id}/{item_id}/{uuid}.jpg`, signierte URLs zum Anzeigen.
- Einkaufsliste: offene und erledigte Einträge, Abhaken, „In den Vorrat“
  übernimmt den Artikel und setzt `purchased_at` auf heute.
- Barcode: Kamera über `@zxing/browser`, manuelle Eingabe als Fallback;
  Treffer öffnet die Artikelsuche, unbekannte Codes führen direkt in das
  Anlageformular.
- Stammdaten: Kategorien, Lagerorte, Einheiten, Warnregeln und Schnellfilter
  sind haushaltsweit und werden über die RPCs gelöscht/verschoben.

### 9.3 Offene Punkte

1. Migration auf das Remote-Projekt anwenden (`supabase db push`) und
   Redirect-URLs im Supabase-Dashboard setzen.
2. Optionaler E-Mail-Versand für Einladungen (z. B. Resend) – der
   Einladungslink funktioniert bereits ohne Mailversand.
3. Passwort-zurücksetzen-UI und Feinschliff der Auth-Texte.
4. Entscheiden, wann `index.html` und der alte Service Worker abgelöst werden.
5. Persönliche Präferenzen (Filterreihenfolge, Schrittgrößen) nur ergänzen,
   wenn sie wirklich gebraucht werden.

### 9.4 End-to-End-Test (lokal)

Gegen den lokalen Supabase-Stack und `next dev` auf Port 3001 geprüft:

- Registrierung, Onboarding und Anmeldung mit zwei Konten.
- Artikel anlegen (mit Barcode und MHD), bearbeiten und soft-löschen.
- Barcode-Suche und manuelle Eingabe auf `/scan`; unbekannte Codes führen
  ins Anlageformular.
- „Nachkaufen“ erzeugt einen Einkaufslisten-Eintrag, Abhaken und
  „In den Vorrat“ überführen ihn zurück in den Vorrat.
- Kategorien, Lagerorte und Einheiten anlegen, umbenennen und löschen;
  Lösch-Auffangbecken und Schutz von „Allgemein“/„Sonstiges“/„Stück“
  funktionieren.
- Warnregeln und Schnellfilter speichern und löschen.
- Einladung per Link: zweites Konto nimmt an, sieht nur Leserechte, keine
  fremden E-Mail-Adressen und keine Verwaltungsformulare. Server Actions
  lehnen Schreibversuche trotzdem ab.
- Letzter Eigentümer kann weder herabgestuft noch entfernt werden; weitere
  Eigentümer können ernannt werden.
- Einladung zurückziehen, Mitglied entfernen, Profilname und Haushaltsname
  ändern.

Dabei gefunden und behoben:

- `get_household_members` warf „structure of query does not match function
  result type“, weil `auth.users.email` `varchar(255)` ist und die Funktion
  `text` deklariert. Fix: `u.email::text`.
- Die Einheiten- und Lagerort-Seiten zeigten nach dem Löschen keine
  Rückmeldung; sie lesen jetzt `?deleted`/`?error` und zeigen Banner.
- Aktionsmeldungen (z. B. „Name bereits vergeben“) blieben bei einer
  Folgenavigation stehen; die Manager werden über einen `key` pro
  Statusparameter neu eingebunden.
- Dashboard-Tippfehler „Artikele“ korrigiert.

Bewusst nicht geprüft: echter Foto-Upload über die UI (Storage-Policies
wurden separat per SQL getestet) und der Kamera-Scan mit realer Hardware.
