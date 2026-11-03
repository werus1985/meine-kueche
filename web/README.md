# Meine Küche – Web-App

Mehrbenutzerfähige Next.js-App für Küchenvorräte, Einkaufsliste und Haushaltsverwaltung.

Die bestehende PWA (`../index.html`) bleibt vorerst bestehen. Diese App ist der
neue, saubere Nachfolger und nutzt dasselbe Supabase-Projekt mit dem
Mehrbenutzer-Schema.

## Voraussetzungen

- Node.js 20+ (getestet mit Node 26)
- Ein Supabase-Projekt
- Supabase CLI (optional, für Migrationen)

## Einrichtung

1. Abhängigkeiten installieren:

   ```bash
   cd web
   npm install
   ```

2. Umgebungsvariablen anlegen:

   ```bash
   cp .env.example .env.local
   ```

   Werte aus dem Supabase-Dashboard (Project Settings → API) eintragen:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://<projekt>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   AI_KEYS_SECRET=<openssl rand -base64 32>
   SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
   ```

   `AI_KEYS_SECRET` (32 Byte, Base64) verschlüsselt die gespeicherten
   Gemini-Keys mit AES-256-GCM. Der Wert bleibt ausschließlich auf dem Server
   und **muss** über die gesamte Laufzeit gleich bleiben – geht er verloren,
   sind die gespeicherten Keys nicht mehr lesbar und müssen neu eingetragen
   werden.

   `SUPABASE_SERVICE_ROLE_KEY` wird **nur** für die Kontolöschung benötigt
   (Auth-User entfernen) und bleibt ebenfalls server-only. Fehlt er, zeigt die
   Löschfunktion einen Hinweis; alles andere läuft ohne ihn.

   Für die KI gibt es **keinen serverweiten Key** mehr: Jeder Nutzer
   hinterlegt seinen eigenen Gemini-API-Key unter *Einstellungen → Profil*,
   optional gibt es einen gemeinsamen Haushalts-Key unter
   *Einstellungen → Haushalt*. Der Key wird verschlüsselt gespeichert,
   serverseitig verwendet und nie an den Browser ausgeliefert.

3. Datenbank aufbauen (siehe unten).

4. Entwicklungsserver starten:

   ```bash
   npm run dev
   ```

   App: <http://localhost:3000>

## Datenbank

Die Migration `../supabase/migrations/20261023120000_multiuser_schema.sql`
setzt das Schema **neu auf**. Sie löscht das bisherige `public`-Schema
inklusive aller Prototypdaten. Das ist für den aktuellen Stand bewusst so
abgestimmt.

```bash
# im Repository-Hauptordner
supabase link --project-ref <projekt-ref>
supabase db push
```

Alternativ die Datei im Supabase SQL Editor ausführen. Die vollständige
Referenz liegt unter `../docs/sql/10_zielschema_multiuser.sql`, die
Entscheidungen und Hintergründe unter `../docs/datenbank-multiuser.md`
(inkl. Abschnitt zu Produktgruppen, Triggern und RPCs).

Nach dem Push:

- In **Authentication → URL Configuration** die Site-URL und
  `http://localhost:3000/auth/callback` als Redirect-URL eintragen.
- E-Mail-Bestätigung kann für den Prototyp deaktiviert werden
  (Authentication → Providers → Email). Ohne Bestätigung funktioniert die
  Anmeldung sofort.

## Funktionen

### Vorrat & Einkauf (Startseite)

- **Eine Ansicht, zwei Modi:** `/items` ist die Startseite. Ein großer
  geteilter Schalter („Vorräte | Einkauf“) wechselt zwischen den Modi; auf
  dem Handy zusätzlich per Wischgeste. Im Vorrat sind die Akzente grün, im
  Einkauf wechseln sie auf Blau – inklusive Kopfzeile, Sidebar, KI- und
  +-Button. Beim Wechsel bleiben aufgeklappte Gruppen, Notiz-Entwürfe und die
  Scrollposition erhalten (beide Listen bleiben gemountet).
- **Sticky-Suche:** Suchfeld und Filter-Symbol schweben leicht transparent
  über der Liste und bleiben beim Scrollen sichtbar.
- **Batch-Löschen im Vorrat:** Unten links schwebt eine Auswahl-Bubble
  (Icon); ein Tipp blendet Checkboxen ein (Gruppenkopf wählt alle Artikel
  der Gruppe, Zeilen einzeln). Sobald etwas ausgewählt ist, erscheint direkt
  daneben eine rote Papierkorb-Bubble – nach Bestätigung werden alle
  ausgewählten Artikel gelöscht.
- **Einkaufsliste aufräumen:** „Liste leeren“ löscht die komplette Liste
  (offen und erledigt, mit Bestätigung). Im Bereich „Erledigt“ steht neben
  „In Vorrat übernehmen“ ein eigener **Löschen**-Button für abgehakte
  Einträge.
- **Filter-Popover:** Ohne Seitenwechsel – Sortierung (Haltbarkeit, Name,
  Zuletzt geändert), Lagerorte (Mehrfachauswahl), Kategorien
  (Mehrfachauswahl + „Auswahl umkehren“), Schnellfilter und Statusfilter.
  Das Filter-Symbol zeigt klar an, wenn Filter aktiv sind; ein ✕ neben dem
  Symbol setzt alles in einem Tap zurück. Statusfilter („Läuft bald ab“,
  „Abgelaufen“) bleiben als eigene Chips in der Kopfzeile.
- **Instant-Filterung:** Alle Artikel werden einmal geladen; Filtern,
  Sortieren und Suchen passiert komplett im Browser – kein Server-Roundtrip
  pro Klick.
- **+-Button:** Unten rechts, Tab-abhängig (Vorrat/Einkauf), mit
  Safe-Area-Abstand fürs iPhone und genug Freiraum am Listenende, damit der
  letzte Artikel nie verdeckt wird.

### Produktgruppen (Barcode-Wissen wiederverwenden)

- **Automatisch per Barcode:** Der erste Artikel mit einem neuen Barcode
  legt das Produktwissen an (Name, Kategorie, Einheit, Foto). Jeder weitere
  Artikel mit diesem Barcode übernimmt alle vier Attribute – beim Scannen
  muss nur noch Menge und MHD eingegeben werden.
- **Ohne Barcode:** Artikel lassen sich beim Anlegen über die
  Produktsuche mit einer bestehenden Gruppe verknüpfen. Ohne Auswahl wird
  **immer eine neue Produktgruppe** angelegt – jeder Artikel gehört zu einer
  Gruppe. Gruppen mit nur einem Artikel verhalten sich im Vorrat wie
  Einzelprodukte (keine aufklappbare Karte).
- **Gruppen im Vorrat:** Artikel derselben Gruppe erscheinen als eine
  aufklappbare Karte mit Foto, Kategorie, **Gesamtmenge** und Anzahl; die
  Zeilen zeigen MHD bzw. relatives Kaufdatum, Menge, Lagerort und Notiz.
  Die Einkaufsliste bleibt bewusst flach.
- **Gruppen bearbeiten:** Der Stift am Gruppenkopf öffnet **nur die
  Gruppendetails**: Name, Foto, Kategorie, Einheit, Barcode und Saisonal.
  Der Stift einer Artikelzeile bearbeitet ausschließlich die Artikel-Felder
  (Menge, MHD, Kaufdatum, Lagerort, Notiz); Name, Foto, Kategorie, Einheit
  und Barcode sind dort gesperrt und nur über den Gruppenkopf änderbar.
  Bei Gruppen mit nur einem Artikel (Einzelkarte) öffnet der Stift weiterhin
  das vollständige Formular inklusive Gruppenattributen. Beim nächsten
  Artikel wird der zuletzt genutzte Lagerort der Gruppe vorgeschlagen.
- **Aufräumen & Saisonales:** Gruppen ohne Artikel verschwinden aus dem
  Vorrat, bleiben aber als Wissen erhalten. Ungenutzte Gruppen werden nach
  **6 Monaten ohne Aktivität** automatisch entfernt (still beim Laden der
  Startseite, inklusive Foto). Saisonale Gruppen lassen sich beim Anlegen,
  im Gruppen-Bearbeiten oder in den Einstellungen mit **„Saisonal“**
  schützen; sie bleiben dauerhaft, bis man sie löscht.
- **Ungenutzte Gruppen verwalten:** Unter
  *Einstellungen → Stammdaten → Produktgruppen* erscheinen alle Gruppen ohne
  Artikel. Sie lassen sich durchsuchen (Name, Kategorie, Barcode), bearbeiten
  und endgültig löschen; geschützte Gruppen sind amber markiert.
- **Wissen bleibt:** Löscht man alle Artikel einer Gruppe, verschwindet sie
  aus dem Vorrat – das Produktwissen bleibt für den nächsten Kauf erhalten.
  Produkte können deshalb über die API nicht gelöscht werden.

### Nachkaufen und einlagern

- **Auf die Einkaufsliste:** Der Warenkorb an der Vorratskarte legt die Ware
  auf die Liste. Ist die Menge 0, zeigt er rot „Nachkaufen“; steht die Ware
  bereits auf der Liste, wird er gelb.
- **In den Vorrat übertragen:** Abgehakte Einkaufsartikel werden beim
  Übertragen eingelagert. Existiert ein **leerer** Vorratsartikel derselben
  Produktgruppe (bzw. desselben Namens), wird dieser aufgefüllt statt einen
  zweiten anzulegen: Menge wird addiert, Kaufdatum auf heute gesetzt, MHD vom
  Einkaufsartikel übernommen (sonst geleert, da das alte MHD zur verbrauchten
  Charge gehört), Lagerort übernommen und die Vorratsnotiz beibehalten. Der
  Einkaufsartikel wird danach entfernt. Bei mehreren leeren Zwillingen wird
  der dringendste (frühestes MHD) aufgefüllt.

### Artikel erfassen und bearbeiten

- **Assistent beim Anlegen:** Nach dem + führt ein Schritt-für-Schritt-Ablauf
  durch die nötigen Angaben – es wird nur gefragt, was noch fehlt:
  - **Best Case (Barcode bekannt oder extern erkannt):** 2 Schritte –
    Barcode/Produkt → **Menge & MHD**.
  - **Neues Produkt ohne Treffer:** 3 Schritte –
    Produkt → **Produktdetails** (Kategorie, Einheit, Foto) → Einlagern.
  - **Einkauf:** 2 Schritte – Was kaufst du? → Menge & Notiz.
  Kaufdatum („Heute“) und Lagerort (letzter Lagerort der Gruppe) sind im
  letzten Schritt vorausgefüllt, aber direkt änderbar. Der Name ist immer
  sichtbar und editierbar – auch wenn er aus der Produktdatenbank kommt.
  Bearbeiten bleibt das gewohnte Gesamtformular.
- **Anlegen und Bearbeiten als Fenster:** Beides öffnet als zentriertes,
  scrollbares Modal über der Liste; Suche und Filter bleiben erhalten.
  Direkte URLs (`/items/new`, `/items/[id]/edit`) funktionieren weiterhin
  als Vollseite.
- **Barcode-Produktdaten (optional):** Ist ein Barcode lokal unbekannt,
  fragt der Server (nur beim Anlegen und nur wenn im Haushalt aktiviert)
  **Open Food Facts** nach Name, Kategorie, Einheit und Foto. Treffer werden
  vorbefüllt, bleiben aber korrigierbar. Fehlt dort der Name, wird er im
  Assistenten abgefragt („Name fehlt in der Datenbank“). Ohne Treffer oder
  bei Fehlern geht es still mit manueller Eingabe weiter.
  - **Gelerntes Mapping:** Die gewählte Kategorie/Einheit wird pro Haushalt
    zu den externen Kategorie-Tags gespeichert und beim nächsten Mal zuerst
    verwendet; ein deutsches Schlüsselwörterbuch dient als Fallback.
  - **Foto:** Das externe Foto wird beim Speichern in den eigenen Speicher
    geladen (Best-Effort). Ein eigenes Foto hat immer Vorrang.
  - **Schalter:** „Externe Produktdatenbank nutzen“ unter
    *Einstellungen → Haushalt & Mitglieder*. Lokal bekannte Produkte werden
    nie extern gesucht.
- **MHD als Texteingabe:** Statt eines Kalenders ein freies Feld –
  Trennzeichen sind optional und werden beim Tippen automatisch gesetzt
  (`15102026` → 15.10.2026). Die ersten zwei Ziffern zählen als Tag, die
  nächsten zwei als Monat, der Rest als Jahr; `1510` und `15.10.` ergänzen
  das Jahr automatisch (aktuelles Jahr, sonst Folgejahr). Die Maske greift
  nur beim Tippen einzelner Ziffern – diktierte oder selbst getippte Punkte
  (`10.4.2020`) bleiben stehen und werden erst beim Verlassen normalisiert.
  Auch diktierte Wortformen („fünfzehnter zehnter zweitausendsechsundzwanzig“)
  und eingefügte ISO-Daten werden erkannt;
  gültige Eingaben werden beim Verlassen als TT.MM.JJJJ formatiert,
  Ungültiges wird mit Hinweis abgelehnt (auch serverseitig). Ein gesetztes
  MHD lässt sich über das ✕ neben dem Feld wieder entfernen – sowohl beim
  Anlegen als auch beim Bearbeiten.
  **Wichtig:** Der Kamera-Scan benötigt einen sicheren Kontext – `localhost`
  oder HTTPS. Auf dem iPhone über die LAN-IP daher `npm run dev:https`
  verwenden und die selbstsignierte Zertifikatswarnung einmal bestätigen.
- **Kaufdatum:** default „Heute“, Schnelleingabe per „Heute“-Chip und
  ±-Tag-Buttons, Anzeige immer relativ („Heute“, „Vor x Tagen“,
  „In x Tagen“ – bewusst ohne „Gestern“).
- **Menge:** startet bei 0. Antippen des Zahlenfelds markiert den ganzen Wert –
  Tippen ersetzt ihn, Backspace leert ihn. So ist keine Cursorsteuerung nötig,
  die die Nummern-Tastatur (ohne Leertaste) nicht anbietet; die ±-Buttons
  bleiben für kleine Korrekturen.
- **Notizen inline:** „Notiz +“ ist immer sichtbar und öffnet direkt in der
  Karte eine Textarea – schreiben, speichern, entfernen, ohne den
  Bearbeiten-Dialog. Deshalb enthält der Bearbeiten-Dialog kein Notizfeld;
  vorhandene Notizen bleiben beim Speichern unverändert.
- **Barcode:** 8–14 Ziffern; im Artikelformular per Kamera scannen oder
  manuell eingeben. Die Barcode-Suche in der Leiste erkennt bekannte
  Gruppen („Produktgruppe X erkannt …“) und unbekannte Codes („nicht
  gefunden, über + anlegen“).

### Haushalte & Zusammenarbeit

- **Haushalte:** mehrere Haushalte pro Person, Rollen `owner`, `editor`,
  `viewer`, letzter Eigentümer geschützt.
- **Einladungen:** per E-Mail-Adresse, als kopierbarer Link (14 Tage
  gültig). Der Link funktioniert nur mit der eingeladenen Adresse.
  E-Mail-Versand über Resend ist bewusst noch nicht eingebaut.
- **Registrierung nur per Einladung:** Ohne gültigen Einladungslink zeigt
  `/register` nur einen Hinweis. Mit Link wird die eingeladene Adresse
  vorausgefüllt (nicht änderbar) und serverseitig geprüft; nach dem Anlegen
  führt der Weg direkt zur Einladung. Öffentliche Registrierung ist damit
  gesperrt (Supabase-Signup bleibt technisch aktiv, siehe Hosting-Hinweis).
- **Leserechte:** `viewer` sehen alles, können aber nichts ändern –
  zusätzlich zur RLS auch in der UI gesperrt.

### Sonstiges

- **Kategorien direkt im Artikelformular** anlegen und sofort auswählen.
- **Schnellfilter:** Mehrfach-Kategorieauswahl als Filter speichern und in
  der Filter-Leiste wieder aufrufen; Verwaltung in den Stammdaten.
- **KI-Küche als Chat-Overlay:** Das KI-Icon in der Kopfzeile öffnet einen
  Chat über jeder Seite (mobil Bottom-Sheet, Desktop-Drawer). Fragen zu
  Rezepten, fehlenden Zutaten, Produktwissen und Einkaufslisten; fehlende
  Zutaten lassen sich direkt in den Einkauf übernehmen. Der Pfeil blendet
  den Chat aus (Verlauf bleibt) – wieder geöffnet wird er über den
  KI-Button in Kopfzeile/Sidebar; ✕ beendet ihn (Verlauf wird geleert).
- **Eigene KI-Keys:** Jeder Nutzer hinterlegt seinen Gemini-API-Key unter
  *Einstellungen → Profil* (privat, nur für ihn sichtbar). Optional kann ein
  Eigentümer einen gemeinsamen Haushalts-Key hinterlegen, der für Mitglieder
  ohne eigenen Key greift.
- **Rezepte-Tab:** Rezepte aus dem Chat speichern oder selbst anlegen
  (Titel, Portionen, Zutaten, Schritte, Foto, Quell-Link), bearbeiten und
  löschen. Die Portionen lassen sich in der Ansicht stufenlos umrechnen –
  die Zutatenmengen skalieren live, das Rezept bleibt unverändert.
- **Lösch-Auffangbecken:** Kategorien → „Allgemein“, Lagerorte →
  „Sonstiges“, Einheiten → „Stück“ (über RPCs; verknüpfte Artikel werden
  über die Produkt-Trigger mitgezogen).

## Routen

| Route | Zweck |
| --- | --- |
| `/` | Weiterleitung auf `/items` |
| `/items` | Vorrat & Einkauf: Modi, Sticky-Suche, Filter-Popover, Gruppen, Statusfilter |
| `/items/new`, `/items/[id]/edit` | Anlegen/Bearbeiten (im App-Kontext als Modal, direkt aufgerufen als Vollseite) |
| `/shopping` | Weiterleitung auf `/items?kind=shop` |
| `/scan` | Weiterleitung auf `/items` (Scannen passiert in Suche und Formular) |
| `/recipes` | Rezepte: Liste, Detail, Anlegen/Bearbeiten |
| `/recipes/new`, `/recipes/[id]/edit` | Rezept anlegen/bearbeiten |
| `/recipes/[id]` | Rezeptdetail mit Portionen-Skalierung |
| `/ai` | Weiterleitung auf `/items` (der KI-Chat ist ein Overlay) |
| `/settings` | Stammdaten in einer Seite: Kategorien, Lagerorte, Einheiten, Produktgruppen, Warnregeln, Schnellfilter |
| `/settings/household` | Haushalte, Einladungen und Mitglieder (inkl. `#mitglieder`) |
| `/settings/profile` | Profil, Rolle, Abmelden |
| `/settings/…` (alt) | Alte Unterseiten leiten auf die passende Stammdaten-Sektion weiter |
| `/invite/[token]` | Einladung annehmen |
| `/login`, `/register`, `/onboarding` | Anmeldung, Einladungs-Registrierung und erste Einrichtung |
| `/forgot-password`, `/reset-password` | Passwort zurücksetzen |

## Technik

- Next.js 16 (App Router, React 19, Server Actions, `src/proxy.ts`)
- Tailwind CSS 4
- `@supabase/ssr` mit Cookie-Session und Session-Refresh im Proxy
- Generierte Typen in `src/lib/database.types.ts`
  (`supabase gen types typescript --local --schema public`)
- **Produktgruppen:** Tabelle `kitchen_products` (Barcode optional, unique
  pro Haushalt) plus `kitchen_items.product_id`. Trigger spiegeln
  Gruppenattribute auf die Artikel, merken sich den letzten Lagerort und
  halten Artikel-Daten denormalisiert aktuell; RPCs
  (`find_or_create_kitchen_product`, `update_kitchen_product_item`) fassen
  Anlegen/Bearbeiten atomar zusammen. Details in
  `../docs/datenbank-multiuser.md`.
- **Instant-Filter:** `/items` lädt alle Artikel einmal serverseitig;
  `inventory-workspace.tsx` filtert/sortiert clientseitig und synchronisiert
  die URL per `history.replaceState`.
- **MHD-Eingabe:** `lib/date-input.ts` parst Ziffernfolgen (4/6/8 Stellen),
  deutsche Schreibweisen, ISO-Daten und diktierte Wortformen; das Feld
  `expiry-date-field.tsx` setzt die Punkte automatisch und normalisiert beim
  Verlassen. Die Server Action nutzt denselben Parser.
- Fotos im privaten Bucket `product-photos`, Pfad
  `{household_id}/{item_id_oder_product_id}/{datei}.jpg`. Auslieferung über
  die same-origin Route `/api/photos/...` (kein Mixed Content, wenn die App
  über HTTPS läuft); Altpfade `{user_id}/…` bleiben für den Eigentümer lesbar.

## Sicherheit & Hosting

Schritt-für-Schritt-Anleitung für den Livegang: [`../docs/deployment.md`](../docs/deployment.md).

- **Header/CSP:** `next.config.ts` setzt CSP, HSTS (nur Produktion),
  `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` und
  `Permissions-Policy`; `X-Powered-By` ist abgeschaltet. Die CSP erlaubt
  Supabase (HTTP + WebSocket) und Open-Food-Facts-Bilder, sonst nur eigene
  Quellen.
- **Session-Cookies:** `secure` ist in Produktion aktiv (HTTPS nötig),
  `sameSite=lax`, `httpOnly=false` (Supabase-Browser-Client).
- **Uploads:** Fotos werden im Browser auf max. 4 MB verkleinert
  (`lib/image.ts`, Canvas/JPEG) – passt unter das 4,5-MB-Limit von Vercel.
  Serverseitig gilt dasselbe Limit (`MAX_PHOTO_BYTES`).
- **KI:** Gemini hat 15 s pro Versuch und 25 s Gesamtbudget; der App-Bereich
  setzt `maxDuration = 60` (Vercel-Hobby-Maximum).
- **KI-Keys verschlüsselt:** `user_ai_settings.gemini_api_key` und
  `households.gemini_api_key` liegen als AES-256-GCM-Chiffrat (`v1.<iv>.<tag>.<cipher>`)
  in der Datenbank. Altbestand im Klartext wird beim nächsten Speichern
  automatisch verschlüsselt.
- **Suchmaschinen:** `public/robots.txt` sperrt alles (`Disallow: /`).
- **Registrierung:** nur per Einladung – die Prüfung passiert serverseitig
  (`get_invite_signup`, absichtlich für `anon` freigegeben). Tabellen bleiben
  für `anon` gesperrt; die beiden weiteren erreichbaren Funktionen prüfen
  `has_household_permission`.
- **Auth-Mails:** Passwort-Reset (`/forgot-password` → Link →
  `/reset-password`) und E-Mail-Änderung (*Einstellungen → Profil*) laufen über
  Supabase. Dafür im Dashboard **Site URL** und **Redirect URLs**
  (`https://<domain>/auth/callback**`) hinterlegen und SMTP (z. B. Resend)
  einrichten. Lokal landen die Mails in Mailpit (`http://127.0.0.1:54324`).
- **E-Mail-Wechsel:** Bestätigung an die neue Adresse, mit „Secure email
  change" zusätzlich an die alte. Erst nach der Bestätigung wird die Adresse
  geändert; offene Einladungen gelten weiterhin für die alte Adresse.
- **Datenexport:** `/api/export` liefert Profil, Mitglieder und alle Daten des
  aktiven Haushalts als JSON-Download – ohne KI-Keys.
- **Kontolöschung:** im Profil mit Bestätigungswort; löscht eigene Haushalte
  inklusive Fotos und den Auth-User (Service-Role-Key, nur serverseitig).
  Alleineigentum mit weiteren Mitgliedern blockiert die Löschung.
- **Produktion:** `NEXT_PUBLIC_SITE_URL` auf die echte Domain setzen; sie
  wird für Bestätigungs-/Reset-Links verwendet.

## Skripte

```bash
npm run dev        # Entwicklung (HTTP)
npm run dev:https  # Entwicklung über HTTPS (nötig für den Kamera-Scan auf dem iPhone)
npm run build      # Produktionsbuild
npm run start      # Produktionsserver
npm run lint       # ESLint
```

Für `dev:https` liegen selbstsignierte Zertifikate unter `certificates/`
(gitignored). Auf dem iPhone einmalig „Details → Website besuchen“ wählen.
Das Skript übergibt das Zertifikat zusätzlich als `--experimental-https-ca`:
Damit vertraut der Dev-Server seinem eigenen Zertifikat und interne Fetchs
(Server Actions mit `redirect()`) laufen ohne TLS-Fehler – sonst kostet jeder
Redirect eine fehlgeschlagene Anfrage und eine zusätzliche Runde im Browser.
Nach einem WLAN-IP-Wechsel Zertifikat neu erzeugen:

```bash
cd web
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout certificates/localhost-key.pem \
  -out certificates/localhost.pem -days 365 \
  -subj "/CN=meine-kueche.local" \
  -addext "subjectAltName=DNS:localhost,DNS:meine-kueche.local,IP:127.0.0.1,IP:$(ipconfig getifaddr en0)"
```

## Noch nicht enthalten

- Automatischer E-Mail-Versand für Einladungen (Resend o. ä.)
- Offline-Sync und Push-Benachrichtigungen
- Feingranulare persönliche Filter-/Einheiten-Einstellungen
- KI-Bilder oder Produktdatenbank-Anbindung (Open Food Facts)
