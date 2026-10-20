# Meine Küche – kostenlose Kücheninventar-PWA

Ein kleiner, deutschsprachiger Handy-Web-App-Prototyp mit Vorräten, Mindesthaltbarkeit, Warnhinweisen und Einkaufsliste.

## Sofort testen
Öffne `index.html` in einem modernen Browser. Die Vorräte und Einkaufsliste werden lokal im Browser gespeichert. Ohne Cloud-Konfiguration werden sie **nicht** zwischen Geräten synchronisiert.

## Auf dem Handy installieren
Für die PWA-Installation muss die App über HTTPS oder localhost bereitgestellt werden; das Öffnen einer lokalen HTML-Datei reicht für Installations- und Offline-Funktionen nicht immer aus.

Kostenlose einfache Hosting-Möglichkeiten sind z. B. GitHub Pages oder Netlify:
1. Lade alle Dateien aus diesem Ordner in ein neues Repository oder ein statisches Hosting-Projekt hoch.
2. Veröffentliche den Ordner als statische Website.
3. Öffne die HTTPS-Adresse auf dem Handy.
4. iPhone: Safari → Teilen → „Zum Home-Bildschirm“.
5. Android: Chrome → Menü ⋮ → „App installieren“ oder „Zum Startbildschirm hinzufügen“.

## Cloud-Synchronisierung über Supabase (kostenloser Einstieg)
Die Cloud-Synchronisierung benötigt ein Supabase-Projekt. Ohne diese einmalige Einrichtung bleibt die App lokal.

1. Erstelle ein Projekt unter https://supabase.com/.
2. Öffne im Projekt den SQL Editor und führe den Inhalt von `supabase.sql` aus.
3. Öffne Project Settings → API (oder Connect) und kopiere die Project URL und den publishable/anon key.
4. Öffne deine veröffentlichte App, klappe „Cloud-Sync konfigurieren“ auf und trage beide Werte ein.
5. Erstelle ein Konto mit E-Mail und Passwort. Wenn Supabase E-Mail-Bestätigung verlangt, bestätige zuerst die Mail und melde dich danach an.
6. Öffne die App auf jedem Handy und melde dich mit demselben Konto an.

**Datenschutz:** Verwende nur den öffentlichen publishable/anon key, niemals einen `service_role`- oder geheimen Schlüssel im Browser. Die Tabelle ist durch Row Level Security geschützt; jeder angemeldete Nutzer kann nur seine eigenen Datensätze lesen und ändern. Wer sich mit demselben Konto anmeldet, sieht dieselben Daten.

## Aktuelle Grenzen des Prototyps
- Ablaufwarnungen erscheinen beim Öffnen der App; echte Push-Mitteilungen im Hintergrund sind noch nicht implementiert.
- Synchronisierung ist beim Anmelden und nach Änderungen eingebaut; bei gleichzeitiger Bearbeitung auf mehreren Geräten ist dies noch kein ausgefeiltes Konfliktmanagement.
- Der Browser muss Internetzugriff haben, damit Cloud-Sync funktioniert.
- Der Prototyp verwendet eine einfache E-Mail-/Passwort-Anmeldung.
- Änderungen, die offline auf mehreren Geräten gemacht werden, werden nicht automatisch intelligent zusammengeführt.

## Dateien
- `index.html` – App und UI
- `manifest.webmanifest` – PWA-Metadaten
- `sw.js` – grundlegender Offline-Cache
- `icon.svg` – App-Icon
- `supabase.sql` – Datenbanktabelle und Sicherheitsregeln


## Neue Funktionen: Kategorien und Suche
Unter „Eigene Kategorien verwalten“ kannst du Kategorien anlegen und löschen. Beim Löschen werden Lebensmittel der Kategorie nach „Allgemein“ verschoben. Über das Suchfeld kannst du den Vorrat nach Produktname, Kategorie oder Lagerort durchsuchen und mit dem Kategorienfilter einschränken. Wenn Supabase bereits eingerichtet ist, führe die aktualisierte `supabase.sql` erneut aus, damit die Spalte `category` ergänzt wird. Kategorien werden auf weiteren Geräten übernommen, sobald Lebensmittel mit diesen Kategorien synchronisiert werden; leere Kategorien werden derzeit nicht separat synchronisiert.


## Update: zuverlässiges Löschen über mehrere Geräte
Diese Version speichert Löschungen als Tombstones (`deleted=true`), damit ein anderes Handy einen entfernten Artikel nicht wieder hochlädt. Bei einem bestehenden Supabase-Projekt muss die Spalte einmalig ergänzt werden. Öffne SQL Editor und führe nur diese Abfrage aus:

```sql
alter table public.kitchen_items
add column if not exists deleted boolean not null default false;
```

Die App-Dateien danach auf GitHub Pages aktualisieren. Bereits gelöschte alte Testartikel, die vorher wieder aufgetaucht sind, können weiterhin als normale Datensätze in der Cloud stehen; lösche sie nach dem Update erneut in der App.
