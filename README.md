# Familienplaner 🏡

Termine, Hausübungen, Schularbeiten und ToDos für die ganze Familie, als App am Handy (PWA) mit Push-Erinnerungen und Google-Kalender-Sync.

**Funktionen**
- **Heute**: Termine des Tages, Schularbeiten der Woche, fällige HÜs und ToDos auf einen Blick
- **Termine**: Monatskalender, Termine pro Person (Farbe), Erinnerung X Minuten/Stunden vorher, Zwei-Wege-Sync mit dem Google-Familienkalender
- **Schule**: Hausübungen, Schularbeiten und Tests pro Kind und Fach, Erinnerung X Tage vorher
- **ToDos**: einmalig oder wiederkehrend (täglich, wöchentlich, alle 2 Wochen, monatlich), zuweisbar; beim Abhaken springt ein wiederkehrendes ToDo aufs nächste Datum
- **Familie**: Mitglieder (Eltern/Kinder), Einladungscode, Push aktivieren, Google-Kalender verbinden
- Login für alle mit „Mit Google anmelden"

**Technik:** React + Vite + TypeScript (PWA), Supabase (Postgres, Auth, Realtime, Edge Functions), Hosting auf Vercel.

## Sofort ausprobieren (Demo-Modus)

Ohne `.env` läuft die App im Demo-Modus: Daten bleiben nur im Browser.

```bash
npm install
npm run dev
```

## Einrichtung (einmalig, alles kostenlos)

### 1. Supabase
1. Auf https://supabase.com ein Projekt anlegen, Region **Frankfurt (eu-central-1)**.
2. Im **SQL Editor** nacheinander `supabase/migrations/0001_init.sql` und `0002_google_calendar.sql` ausführen.
3. Unter **Database → Replication** Realtime für `events`, `school_items`, `todos`, `members` einschalten.
4. Unter **Project Settings → API** die Project-URL und den `anon`-Key notieren.

### 2. Google Cloud (Login + Kalender)
1. https://console.cloud.google.com → neues Projekt „Familienplaner".
2. **APIs & Services → Library** → „Google Calendar API" aktivieren.
3. **OAuth consent screen**: Typ „External", App-Name „Familienplaner", Scopes `…/auth/calendar` hinzufügen, danach **„Publish app"** (sonst laufen die Kalender-Tokens nach 7 Tagen ab; Google zeigt dann beim Login einen Hinweis „nicht verifiziert", den man mit „Erweitert → Weiter" bestätigt).
4. **Credentials → OAuth client ID** (Web application). Authorized redirect URI: `https://<PROJEKT>.supabase.co/auth/v1/callback`.
5. Client-ID und Secret in Supabase unter **Authentication → Providers → Google** eintragen.
6. In Supabase unter **Authentication → URL Configuration** die Vercel-Adresse als Site URL und Redirect URL eintragen.

### 3. Push-Schlüssel
```bash
npx web-push generate-vapid-keys
```

### 4. Edge Functions
```bash
npx supabase login
npx supabase link --project-ref <PROJEKT>
npx supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:du@example.com \
  GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... APP_TIMEZONE=Europe/Vienna
npx supabase functions deploy send-reminders --no-verify-jwt
npx supabase functions deploy google-calendar-sync
```
Dann unter **Database → Extensions** `pg_cron` und `pg_net` aktivieren und die zwei `cron.schedule`-Zeilen am Ende von `0002_google_calendar.sql` (mit eingesetzter Projekt-ID und Service-Role-Key) im SQL Editor ausführen.

### 5. Vercel
1. Auf https://vercel.com mit GitHub anmelden → „Add New Project" → dieses Repo importieren.
2. Environment Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY`.
3. Deploy.

### 6. Aufs Handy (Android)
Adresse in Chrome öffnen → Menü ⋮ → **„App installieren"**. Mit Google anmelden, Familie anlegen, den Einladungscode an die anderen weitergeben. Unter **Familie** auf jedem Handy „Benachrichtigungen aktivieren" tippen und einmal den Google-Kalender verbinden.

## Aufbau
```
src/
  pages/        Heute, Termine, Schule, ToDos, Familie, Login, Kalender (Google)
  lib/          store (Daten, Demo/Supabase), family (Login/Familie), push, reminders, google, recurrence
  sw.ts         Service Worker (Offline + Push)
supabase/
  migrations/   Datenbankschema inkl. Zugriffsregeln (jede Familie sieht nur ihre Daten)
  functions/    send-reminders (Push, alle 5 Min.), google-calendar-sync (alle 15 Min.)
```
