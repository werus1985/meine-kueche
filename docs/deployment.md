# Deployment: Vercel + Supabase (kostengünstig)

Ziel: Die App läuft unter einer eigenen Domain, Daten in der EU, automatische
Deploys aus GitHub. Kosten: Vercel Hobby (0 €) + Supabase Free (0 €) +
Domain (~12 €/Jahr) + optional Backblaze B2 für Backups (Free-Tier).

## 1. Voraussetzungen

- GitHub-Repository mit diesem Stand (`main` als Produktionsbranch)
- Supabase-Account (<https://supabase.com>)
- Vercel-Account (<https://vercel.com>, Login über GitHub)
- Domain (z. B. bei INWX/Cloudflare/Hetzner)
- SMTP-Anbieter für Auth-Mails, z. B. Resend (<https://resend.com>, 3.000
  Mails/Monat gratis)

## 2. Supabase-Projekt anlegen

1. Neues Projekt, **Region: EU** (z. B. Frankfurt), starkes DB-Passwort.
2. Unter *Project Settings → API Keys* notieren:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - **Publishable key** (`sb_publishable_…`) → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Secret key** (`sb_secret_…`, vollständig über das Auge-Symbol) →
     `SUPABASE_SERVICE_ROLE_KEY` (nur server-seitig!)
   - Die Legacy-Keys (`anon`/`service_role`) funktionieren weiterhin, werden
     aber **Anfang 2027 abgeschaltet** – deshalb die neuen Keys verwenden.
3. Unter *Project Settings → Database* die Verbindungsdaten (Session Pooler)
   für Migrationen und Backups bereithalten.

## 3. Datenbank-Schema einspielen

Lokal einmal gegen eine frische DB prüfen:

```bash
cd /pfad/zu/meine-kueche
supabase db reset          # wendet alle Migrationen lokal an
```

Dann gegen das Cloud-Projekt:

```bash
supabase link --project-ref <projekt-ref>
supabase db push
```

Die Migrationen legen Tabellen, RLS, Storage-Bucket (`product-photos`, privat),
Funktionen und die Einladungs-/Registrierungsfunktionen an.

## 4. Auth in Supabase konfigurieren

*Authentication → URL Configuration*

- **Site URL:** `https://<domain>`
- **Redirect URLs:**
  - `https://<domain>/auth/callback`
  - `https://<domain>/auth/callback**`
  - Preview-Deploys: `https://*-<team>.vercel.app/**` (optional)

*Authentication → Providers → Email*

- **Confirm email:** an
- **Secure email change:** an (Bestätigung an alte **und** neue Adresse)
- Passwort-Mindestlänge: 8 (die App prüft zusätzlich)

*Authentication → SMTP*

- Resend (oder anderer Anbieter): Host `smtp.resend.com`, Port 465/587,
  Benutzer `resend`, Passwort = API-Key, Absender z. B. `noreply@<domain>`
- Danach Testmail über „Passwort vergessen“ auslösen.

*Authentication → Rate Limits* prüfen (E-Mails pro Stunde).

## 5. Vercel-Projekt

1. **Add New → Project** → GitHub-Repo importieren.
2. **Root Directory:** `web` (die Next-App liegt im Unterordner).
3. Framework: Next.js (automatisch erkannt), Build `npm run build`.
4. **Environment Variables** (Production + Preview):

   | Name | Wert |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<projekt>.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable key (`sb_publishable_…`) |
   | `NEXT_PUBLIC_SITE_URL` | `https://<domain>` |
   | `AI_KEYS_SECRET` | `openssl rand -base64 32` |
   | `SUPABASE_SERVICE_ROLE_KEY` | Secret key (`sb_secret_…`, nur server) |

5. **Region:** `fra1` (Frankfurt) – passt zur Supabase-EU-Region.
6. Deploy starten.

### Vercel-spezifische Grenzen (bereits im Code berücksichtigt)

- Request-Body max. 4,5 MB → Fotos werden im Browser auf 4 MB verkleinert.
- Funktionslaufzeit max. 60 s → `maxDuration = 60`, Gemini-Budget 25 s.

## 6. Domain verbinden

1. Vercel → *Settings → Domains* → Domain hinzufügen.
2. DNS beim Anbieter setzen (A/CNAME nach Vercel-Anleitung), ggf. `www`.
3. Warten, bis das Zertifikat ausgestellt ist (HTTPS automatisch).
4. `NEXT_PUBLIC_SITE_URL` auf die endgültige Domain prüfen und neu deployen.
5. Redirect-URLs in Supabase auf die Domain anpassen (siehe Schritt 4).

HSTS ist ab Produktion automatisch gesetzt (siehe `next.config.ts`).

## 7. Backup (Supabase Free hat keine automatischen Backups)

1. Backblaze-B2-Bucket anlegen (z. B. `meine-kueche-backups`, EU-Region) und
   einen Application Key mit Schreibrechten erstellen.
2. GitHub → *Settings → Secrets and variables → Actions*:
   - `SUPABASE_DB_URL` (Session-Pooler-URL mit Passwort)
   - `B2_ENDPOINT`, `B2_BUCKET`, `B2_KEY_ID`, `B2_APP_KEY`
3. Der Workflow `.github/workflows/db-backup.yml` läuft nächtlich und lädt
   `meine-kueche-<datum>.dump` hoch. Ohne `SUPABASE_DB_URL` wird er sauber
   übersprungen.
4. Im B2-Bucket eine Lifecycle-Regel setzen (z. B. 30 Tage aufbewahren).
5. Wiederherstellung testen: `pg_restore --clean --no-owner -d <db> <dump>`.

## 8. Monitoring

- Uptime-Check auf `https://<domain>/api/health` (200 = App + DB erreichbar).
  Der tägliche Aufruf verhindert außerdem das Pausieren des Free-Projekts.
- Vercel-Logs und Supabase-Logs im Blick behalten.

## 9. Abnahme nach dem ersten Deploy

- [ ] Login als bestehender Nutzer, Logout, Login
- [ ] Einladung erstellen → Link öffnen → Konto anlegen → annehmen
- [ ] Passwort-Reset-Mail anfordern und Link öffnen
- [ ] E-Mail-Änderung anfordern (Bestätigungsmails ankommen)
- [ ] Artikel anlegen/bearbeiten/löschen, Foto hochladen (> 4 MB Foto wird
      verkleinert)
- [ ] KI-Chat mit eigenem Gemini-Key (Einstellungen → Profil)
- [ ] Zweiter Haushalt: Nutzer B sieht keine Daten von Haushalt A
- [ ] `curl -I https://<domain>`: CSP, HSTS, `X-Frame-Options`, kein
      `X-Powered-By`
- [ ] `https://<domain>/robots.txt` → `Disallow: /`
- [ ] Backup-Workflow manuell starten (Actions → Run workflow)

## 10. Betrieb / Fallstricke

- **`AI_KEYS_SECRET` nie ändern/verlieren** – sonst sind gespeicherte
  Gemini-Keys nicht mehr lesbar (Nutzer müssen sie neu eintragen).
- **`NEXT_PUBLIC_*`** wirken zur Build-Zeit: nach Änderungen neu deployen.
- **Supabase Free** pausiert nach 7 Tagen Inaktivität; der Health-Check
  verhindert das.
- **Registrierung** ist nur per Einladung; Supabase-Signup bleibt technisch
  aktiv (bewusste Entscheidung). Bei Bedarf später abschalten und Einladungen
  über die Admin-API verschicken.
- **Vercel Hobby** ist nur für nicht-kommerzielle Projekte.
