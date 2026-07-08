# eventplaner-app

> **[English version → `README.md`](README.md)**

[![lint](https://github.com/AHommrich/eventplaner-app/actions/workflows/lint.yml/badge.svg?branch=main)](https://github.com/AHommrich/eventplaner-app/actions/workflows/lint.yml)
[![typecheck](https://github.com/AHommrich/eventplaner-app/actions/workflows/typecheck.yml/badge.svg?branch=main)](https://github.com/AHommrich/eventplaner-app/actions/workflows/typecheck.yml)
[![test](https://github.com/AHommrich/eventplaner-app/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/AHommrich/eventplaner-app/actions/workflows/test.yml)
[![License](https://img.shields.io/badge/License-All%20Rights%20Reserved-red.svg)](LICENSE)

> **Status: portfolio-ready.** Der 12-Phasen-Refactor aus
> [`docs/REFACTOR_PLAN.md`](docs/REFACTOR_PLAN.md) ist abgeschlossen und
> jeder Follow-up ist geschlossen. Aktive Feature-Arbeit findet hier nicht
> mehr statt — künftige Änderungen kommen als isolierte PRs (Dependabot-
> Bumps, gelegentliche Politur). Für einen Rundgang durch die vier
> Entscheidungen, die den Code geformt haben, starte in
> [`docs/showcase/`](docs/showcase/).

Eine Companion-App für Hochzeitsgäste. Gäste bekommen eine Einladungskarte
mit QR-Code, scannen einmal und landen in einem kompakten Event-Hub — RSVP,
Startseite mit Countdown und Venue-Navigation, Fotogalerie, Foto-Spiel,
Getränke-Log und ein Settings-Tab, der zugleich die DSGVO-Oberflächen
beherbergt (Datenschutzerklärung, Einwilligungen, Datenexport, Löschantrag).
Kein Passwort, kein Account, keine Third-Party-Tracker.

Die App ist der Client zu einem Laravel-12-Backend, das derselbe Autor
unter [github.com/AHommrich/eventplaner](https://github.com/AHommrich/eventplaner)
pflegt. Die Hochzeit ist real, das Paar sind André & Tabea Hommrich, und
der Code wird nach dem in [`docs/REFACTOR_PLAN.md`](docs/REFACTOR_PLAN.md)
dokumentierten Phasen-Refactor öffentlich einsehbar gemacht — zu
Portfolio- und Referenzzwecken.

---

## Inhalt

1. [Highlights](#1-highlights)
2. [Tech-Stack](#2-tech-stack)
3. [Schnellstart](#3-schnellstart)
4. [Skripte](#4-skripte)
5. [Projektstruktur](#5-projektstruktur)
6. [Tests](#6-tests)
7. [DSGVO / Datenschutz](#7-dsgvo--datenschutz)
8. [Dokumentations-Index](#8-dokumentations-index)
9. [Lizenz](#9-lizenz)

---

## 1. Highlights

1. **Passwortloses QR-Login mit zweistufigem Familien-Flow.** Ein
   Einzelgast landet direkt in der App; ein Familien-QR öffnet zuerst einen
   Namens-Picker, bevor die persönliche Session erzeugt wird. Umsetzung:
   [`app/index.tsx`](app/index.tsx), [`app/scan.tsx`](app/scan.tsx),
   [`lib/auth.ts`](lib/auth.ts).
2. **Backend-gesteuertes dynamisches Theme.** Farben, Schriften und
   Event-Texte kommen aus `/api/event/info` und laufen über
   `useEventTheme()` in jeden Screen. „Keine hart codierten Hex-Werte in
   Screens“ ist eine Code-Review-Regel. Umsetzung:
   [`lib/EventThemeContext.tsx`](lib/EventThemeContext.tsx).
3. **DSGVO-Compliance sichtbar in der App, nicht nur auf einer Website.**
   Datenschutzerklärung (Art. 13), explizite zweckgebundene Einwilligungen
   (Art. 6 / 7), JSON-Datenexport (Art. 15) und 30-Tage-Löschfenster
   (Art. 17), jeweils als eigener Screen. Umsetzung:
   [`app/legal/`](app/legal), [`app/consents/`](app/consents),
   [`app/data-export.tsx`](app/data-export.tsx),
   [`app/erasure-pending.tsx`](app/erasure-pending.tsx),
   [`lib/legal.ts`](lib/legal.ts), [`lib/consents.ts`](lib/consents.ts),
   [`lib/erasure.ts`](lib/erasure.ts).
4. **Zehn Google-Fonts lokal gebündelt.** Kein Traffic zu
   `fonts.gstatic.com` zur Laufzeit — bewusste Entscheidung, um genau das
   DSGVO-Problem zu vermeiden, das 2022 das Third-Party-Font-Hotlinking
   erledigt hat. Umsetzung: [`constants/fonts.ts`](constants/fonts.ts) +
   `@expo-google-fonts/*`-Pakete.
5. **Pull-to-Refresh in einer Zeile über alle Tabs.** `useRefreshToast()`
   zentralisiert das „Spinner + Bestätigungs-Toast“-Muster, damit Screens
   es nie manuell verdrahten. Umsetzung:
   [`lib/useRefreshToast.ts`](lib/useRefreshToast.ts).
6. **Tab-Sichtbarkeit über Backend-Flags.** Der Getränke-Tab verschwindet,
   wenn das Paar ihn mitten im Event deaktiviert; der RSVP-Tab
   verschwindet, sobald die Zusage bestätigt ist. Umsetzung:
   [`app/(tabs)/_layout.tsx`](<app/(tabs)/_layout.tsx>),
   [`lib/BlockedFeaturesContext.tsx`](lib/BlockedFeaturesContext.tsx).
7. **Foto-Spiel mit vierstufigem Client-Automat.** Noch keine Aufgabe →
   zugeteilt → eingereicht → erledigt. Umsetzung:
   [`app/(tabs)/photo-game.tsx`](<app/(tabs)/photo-game.tsx>).
8. **Native Maps-Übergabe mit Koordinaten-first-URL.** iOS zeigt einen
   App-Picker (Apple Maps / Google Maps) mit Google-Maps-Fallback auf Apple
   Maps; Android nutzt `geo:lat,lng` — nie `geo:lat,lng?q=<adresse>`, weil
   das `q=` die Koordinaten überschreibt. Umsetzung: `openInMaps` in
   [`app/(tabs)/home.tsx`](<app/(tabs)/home.tsx>).

Screenshots liegen in [`docs/screenshots/`](docs/screenshots), sobald ein
stabiler Staging-Stand aufgenommen ist; der Ordner bleibt beim ersten
Commit leer, damit das Repo keine Platzhalter-Grafiken ausliefert.

---

## 2. Tech-Stack

| Schicht      | Wahl                                                 | Warum                                                                                                                                                   |
| ------------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework    | Expo SDK 54 + Expo Router v6                         | Datei-basiertes Routing hält die Redirect-Matrix (Session → RSVP → Home) nah am Dateibaum.                                                              |
| Sprache      | TypeScript (strict)                                  | Jede Backend-Antwort hat ein Interface, jeder Provider eine Shape.                                                                                      |
| Styling      | NativeWind v4 + Tailwind v3                          | Tailwind-Tokens für Struktur, `useEventTheme()`-Farben für Brand.                                                                                       |
| HTTP         | Axios + Bearer-Interceptor                           | Ein Client in [`lib/api.ts`](lib/api.ts); Screens importieren nie direkt axios.                                                                         |
| Auth-Storage | `expo-secure-store`                                  | Nur Keychain / Keystore — nie AsyncStorage — weil Tokens backend-seitig nicht ablaufen.                                                                 |
| Icons        | `@expo/vector-icons` (Ionicons)                      | Eine Icon-Familie, offline-verfügbar.                                                                                                                   |
| i18n         | `i18n-js` + `LanguageContext`                        | Zwei Locales (DE + EN), beim ersten Start Device-detected, in Settings umschaltbar.                                                                     |
| Test-Runner  | Jest + `jest-expo` + `@testing-library/react-native` | Offizielles Expo-Test-Preset, kein Custom-Transformer.                                                                                                  |
| Fonts        | `@expo-google-fonts/*` (10 Familien)                 | Lokal gebündelt, kein CDN-Traffic.                                                                                                                      |
| Backend      | Laravel 12 + Sanctum                                 | [`AHommrich/eventplaner`](https://github.com/AHommrich/eventplaner); hochzeits-app-spezifische Tokens mit `app_blocked` / `drinks_blocked` Soft-Blocks. |

Fixierte Dep-Versionen für Expo Go SDK 54 (Anfassen crasht die JSI-Bridge —
nicht isoliert hochziehen):

```
react-native-screens: ~4.16.0
react-native-reanimated: ~4.1.1
react-native-gesture-handler: ~2.28.0
react-native-safe-area-context: ~5.6.0
```

---

## 3. Schnellstart

```bash
nvm use                              # Node 20 (`.nvmrc`)
npm install --legacy-peer-deps       # React-19-Peer-Dep-Konflikt-Flag
npx expo start                       # Metro + Expo-Go-Pairing-QR
```

Expo Go auf einem echten Gerät öffnen, Metro-QR scannen und einen der
DEV-Tokens im Scan-Screen (`app/scan.tsx`) verwenden. Produktions-QR-Codes
zeigen auf `https://eveplan.de`; lokale Entwicklungs-Tokens liegen in
`CLAUDE.local.md` (gitignored) und authentifizieren sich weder auf Staging
noch in Produktion.

`API_BASE` liegt in [`constants/env.ts`](constants/env.ts):

| Build-Variante | API_BASE | Zweck |
| --------------- | -------- | ----- |
| Expo Go / `npm start` | `https://beta.hommrich.app` | lokale Entwicklung gegen Staging |
| `eas build --profile preview` | `https://beta.hommrich.app` | interne Preview-Builds |
| `eas build --profile production` | `https://eveplan.de` | TestFlight / Play Store |

---

## 4. Skripte

| Skript                                            | Was es tut                                                                                                        |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `npm start`                                       | `expo start` — Metro + Pairing-QR.                                                                                |
| `npm run ios` / `npm run android` / `npm run web` | Wie oben mit Plattform-Preset.                                                                                    |
| `npm run lint`                                    | ESLint über den Baum. Warnings sind erlaubt — der Verschärfungs-Pfad ist in `docs/REFACTOR_PLAN.md` dokumentiert. |
| `npm run lintfix`                                 | ESLint `--fix`. **Nicht** ungeprüft gegen Prä-Refactor-Code laufen lassen.                                        |
| `npm run format:check`                            | Prettier nur prüfen.                                                                                              |
| `npm run format`                                  | Prettier schreiben. Gleicher „nicht gegen Prä-Refactor“-Vorbehalt.                                                |
| `npm run typecheck`                               | `tsc --noEmit`, strict.                                                                                           |
| `npm test`                                        | Jest ein Lauf.                                                                                                    |
| `npm run test:watch`                              | Jest Watch-Modus.                                                                                                 |
| `npm run test:coverage`                           | Jest mit Coverage; erzwingt die Schwellen pro Ordner aus [`jest.config.js`](jest.config.js).                      |

---

## 5. Projektstruktur

Der komplette Baum mit Begründung pro Datei liegt in
[`CLAUDE.md`](CLAUDE.md) und [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
Kurzfassung:

```
app/                Screens (Expo-Router-Dateirouting)
  legal/            Datenschutzerklärung (Art. 13)
  consents/         Einwilligungsverwaltung (Art. 6 / 7 / 7 (3))
  (tabs)/           Startseite + Tab-Bar (RSVP, Fotos, Foto-Spiel, Getränke, Settings)
components/         Geteilte UI-Wrapper (ThemedText, RefreshToast, ConsentGate)
lib/                Nicht-UI-Module — das „Backend des Clients“ (api, auth, guest, legal, consents, erasure, ...)
constants/          Statische Design-Tokens + Env (`theme.ts`, `env.ts`, `fonts.ts`)
locales/            de + en Übersetzungs-Dictionaries
docs/               ARCHITECTURE, REFACTOR_PLAN, Dep-Audit, Storage-Keys-Audit, E2E-Strategie
tests/              Setup + gespiegelter Test-Baum (Jest)
.maestro/           E2E-Flow-Suite (Maestro) — Login- + Logout-Smoke
scripts/            Einmalige Wartungs-Skripte (jsQR-Vendor-Sync)
```

---

## 6. Tests

- **Unit-Tests** — jedes Modul in `lib/**` und `constants/**` hat eine
  passende `*.test.ts`-Datei. Erzwungene Schwellen: ≥ 90 % Lines und
  Branches in `lib/**`, 100 % in `constants/**`.
- **Screen-Tests** — Happy Path + eine plausible Fehlerroute pro Screen.
  Aktuelle Untergrenze 60 % Lines in `app/**`; das 80 %-Ziel steht in
  [`docs/REFACTOR_PLAN.md → Follow-ups`](docs/REFACTOR_PLAN.md).
- **Regressionen** —
  [`tests/regressions/no-tracking.test.ts`](tests/regressions/no-tracking.test.ts)
  lässt CI fehlschlagen, sobald eine bekannte Analytics- oder Crash-
  Reporting-SDK in `package.json` auftaucht oder ein öffentlicher CDN-
  Hostname im Source-Tree wieder erscheint.
- **Vendor-Sync** —
  [`tests/vendor/jsqr-source-sync.test.ts`](tests/vendor/jsqr-source-sync.test.ts)
  schlägt fehl, wenn die vendored jsQR-Kopie unter
  [`lib/vendor/`](lib/vendor/) vom installierten npm-Paket abweicht.
  Regeneriert via `node scripts/vendor-jsqr.mjs`.
- **End-to-End** — [`.maestro/`](.maestro/) enthält eine kleine
  Maestro-Flow-Suite, die ein echtes Gerät durch den goldenen Login- und
  Logout-Pfad steuert. Design-Rationale in [`docs/e2e.md`](docs/e2e.md),
  Anleitung in [`.maestro/README.md`](.maestro/README.md).

Mehr Detail (was getestet wird und was nicht, warum keine Visual-Snapshots):
siehe [`tests/README.md`](tests/README.md).

---

## 7. DSGVO / Datenschutz

Diese App ist für eine echte Hochzeit in Deutschland gebaut. DSGVO ist hier
keine Checkbox — sie ist Teil des Designs.

- **Art. 13 (Transparenz)** — die Datenschutzerklärung liegt unter
  `Settings → Datenschutzerklärung`. Inhalt kommt aus dem Backend und wird
  24 h in `expo-secure-store` gecached, damit auch der Flugmodus den Text
  zeigt. Umsetzung: [`app/legal/privacy.tsx`](app/legal/privacy.tsx),
  [`lib/legal.ts`](lib/legal.ts).
- **Art. 6 / 7 (Einwilligung)** — jede Verarbeitungs-Oberfläche
  (Foto-Upload, Foto-Spiel-Einreichung, Kamera-Scan) wird von einem
  `ConsentGate` gewrappt, der vor dem OS-Berechtigungsdialog einen
  zweckspezifischen Consent-Modal zeigt. Einwilligungen werden pro Zweck
  mit Zeitstempel gespeichert (der Art. 7 (1)-Nachweis). Umsetzung:
  [`components/ConsentGate.tsx`](components/ConsentGate.tsx),
  [`lib/consents.ts`](lib/consents.ts).
- **Art. 7 (3) (Widerruf)** — `Settings → Einwilligungen verwalten` listet
  jede erteilte Einwilligung mit Zeitstempel und Ein-Tipp-Widerruf. Der
  Widerruf ist genauso einfach wie die Erteilung. Umsetzung:
  [`app/consents/index.tsx`](app/consents/index.tsx).
- **Art. 15 (Auskunft)** — `Settings → Meine Daten exportieren` lädt eine
  JSON-Kopie aller Backend-Daten des Gasts und übergibt sie an
  `expo-sharing`. Die Datei landet nie unverschlüsselt auf der Platte.
  Umsetzung: [`app/data-export.tsx`](app/data-export.tsx).
- **Art. 17 (Löschung)** — `Settings → Konto löschen` plant eine 30-Tage-
  Softlöschung im Backend. Während des Fensters bleibt die App
  ausgeloggt, behält aber genug State für einen Ein-Tipp-Widerruf ohne
  erneutes QR-Scannen. Umsetzung:
  [`app/erasure-pending.tsx`](app/erasure-pending.tsx),
  [`lib/erasure.ts`](lib/erasure.ts).
- **Datensparsamkeit** — erzwungen von
  [`tests/regressions/no-tracking.test.ts`](tests/regressions/no-tracking.test.ts).
  Dokumentiert durch [`docs/dependencies.md`](docs/dependencies.md) (jede
  Runtime-Dep, „phones home?“) und
  [`docs/storage-keys.md`](docs/storage-keys.md) (jeder On-Device-Key).
- **Fonts** — 10 Google Fonts lokal gebündelt, kein CDN-Traffic zur
  Laufzeit. Genau das ist die spezifische Compliance-Falle, die 2022 hart
  eingeschlagen hat; wir reproduzieren sie nicht.

---

## 8. Dokumentations-Index

- [`CLAUDE.md`](CLAUDE.md) — Muster, Farbregeln, Endpoint-Referenz,
  Fallstricke. Für jeden (oder jeden Coding-Agent), der den Baum aufmacht.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — Layer-Diagramm,
  Provider-Baum, Auth-Flow-Sequenz, nicht-offensichtliche Regeln pro
  Screen, DSGVO-Design.
- [`docs/REFACTOR_PLAN.md`](docs/REFACTOR_PLAN.md) — die zwölf Phasen, die
  das Repo in diesen Zustand gebracht haben, plus die laufende Follow-up-
  Liste.
- [`docs/dependencies.md`](docs/dependencies.md) — Datenfluss-Audit pro
  Paket, hinterlegt den „keine Third-Party-Tracker“-Anspruch.
- [`docs/storage-keys.md`](docs/storage-keys.md) — jeder
  `expo-secure-store`-Key: Zweck, Aufbewahrung, „cleared on logout“-Status.
- [`SECURITY.md`](SECURITY.md) — Meldeprozess für Sicherheitslücken.
- [`tests/README.md`](tests/README.md) — was die Jest-Suite testet und warum.
- [`docs/e2e.md`](docs/e2e.md) — End-to-End-Strategie, Layer-Grenzen und
  die Rationale hinter den Maestro-Flows.
- [`.maestro/README.md`](.maestro/README.md) — Maestro-Setup + wie man die
  E2E-Flows lokal ausführt.
- [`docs/showcase/`](docs/showcase/) — Engineering-Narratives für Leser,
  die das Repo kalt aufmachen: die vier Entscheidungen, die es geformt
  haben (DSGVO, Theme-Engine, QR-Auth, Test-Pyramide), samt den
  verworfenen Alternativen.

---

## 9. Lizenz

Alle Rechte vorbehalten. Siehe [`LICENSE`](LICENSE). Öffentlich einsehbar
zu Portfolio-Zwecken; keine Nutzung, kein Fork und keine Weiterverbreitung
ohne schriftliche Genehmigung. Die Hochzeitsfotos und alle
personenbezogenen Daten, die durch die laufende App fließen, sind
selbstverständlich nicht von der Code-Lizenz abgedeckt.
