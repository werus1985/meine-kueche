# TODO – Offene Punkte

Stand: nach dem ersten produktiven Deployment (Vercel + Supabase).

**Live:** https://meine-kueche-tawny.vercel.app
**Doku:** [`docs/deployment.md`](docs/deployment.md)

## Sofort / vor dem ersten echten Einsatz

- [ ] **E-Mail-Bestätigung übergangsweise abschalten**
      Supabase → *Authentication → Sign In / Providers → Email* →
      „Confirm email" aus.
      Grund: Ohne eigenes SMTP läuft der Versand über den stark limitierten
      Standard-Versand; Eingeladene könnten sich sonst nicht registrieren.
      Nach Einrichtung von SMTP wieder einschalten.

- [ ] **Backup einrichten** (Supabase Free hat keine automatischen Backups)
      1. Backblaze-B2-Bucket anlegen (EU-Region) + Application Key
      2. GitHub → *Settings → Secrets and variables → Actions*:
         `SUPABASE_DB_URL`, `B2_ENDPOINT`, `B2_BUCKET`, `B2_KEY_ID`, `B2_APP_KEY`
      3. Workflow `.github/workflows/db-backup.yml` einmal manuell starten
      4. Restore testen: `pg_restore --clean --no-owner -d <db> <dump>`
      5. B2-Lifecycle-Regel setzen (z. B. 30 Tage)

- [ ] **Uptime-Monitor** auf `https://meine-kueche-tawny.vercel.app/api/health`
      (z. B. UptimeRobot, täglich). Verhindert zusätzlich das Pausieren des
      Supabase-Free-Projekts nach 7 Tagen Inaktivität.

- [ ] **Login-Test mit echtem Nutzer**: Anmelden → Onboarding → Haushalt
      anlegen → Artikel anlegen → Foto hochladen.

## Demnächst

- [ ] **Registrierung mit Einladung: direkt dem Haushalt beitreten**
      Heute führt der Weg nach der Registrierung über die Einladungsseite
      („Einladung annehmen“); wer sie nicht öffnet, landet im Onboarding und
      muss zuerst einen **eigenen** Haushalt anlegen.
      Ziel: Nach Registrierung/Bestätigung wird die Einladung automatisch
      angenommen – der Haushalt der einladenden Person ist sofort aktiv, das
      Onboarding entfällt.
      Umsetzung: `accept_household_invite(token)` serverseitig in
      `signUpAction` bzw. im `/auth/callback` aufrufen, `next` auf `/items`
      setzen; im Onboarding offene Einladungen anbieten (falls der Link
      verloren geht).

- [ ] **SMTP über Resend einrichten**
      1. Resend-Account, Domain verifizieren (SPF/DKIM/DNS)
      2. Supabase → *Authentication → SMTP*: Host `smtp.resend.com`,
         Port 465, User `resend`, Passwort = API-Key,
         Absender `noreply@<domain>`
      3. „Confirm email" wieder einschalten, „Secure email change" aktivieren
      4. Testen: Einladung, Passwort-Reset, E-Mail-Änderung

- [ ] **Eigene Domain verbinden**
      1. Vercel → *Settings → Domains* → Domain hinzufügen, DNS setzen
      2. `NEXT_PUBLIC_SITE_URL` in Vercel auf die Domain ändern → Redeploy
      3. Supabase → *Authentication → URL Configuration*: Site URL + Redirect
         URLs (`https://<domain>/auth/callback**`)
      4. Domain in Resend als Absender verifizieren

## Später / Features

- [ ] **Phase 2 Rezepte:** Import per Link und Foto
- [ ] E-Mail-Versand für Einladungen direkt aus der App (statt Link kopieren)
- [ ] Offline-Sync / PWA-Feinschliff
- [ ] Weitere KI-Modelle/Anbieter (aktuell Gemini mit eigenem Key)

## Betriebshinweise (nicht ändern/vergessen)

- `AI_KEYS_SECRET` **niemals** ändern oder verlieren – sonst sind die
  gespeicherten Gemini-Keys nicht mehr lesbar.
- `SUPABASE_SERVICE_ROLE_KEY` und `AI_KEYS_SECRET` bleiben geheim
  (Vercel „Sensitive"), niemals mit `NEXT_PUBLIC_` präfixen.
- Supabase-Legacy-Keys (`anon`/`service_role`) werden **Anfang 2027**
  abgeschaltet – die App nutzt bereits die neuen Keys
  (`sb_publishable_…` / `sb_secret_…`).
- Vercel Hobby ist nur für nicht-kommerzielle Projekte.
- Funktions-Region: **fra1** (Frankfurt); keine weiteren Regionen aktivieren.
- Vercel-Limits: Request-Body 4,5 MB (Fotos werden im Browser auf 4 MB
  verkleinert), Funktionslaufzeit 60 s (KI-Budget 25 s).
