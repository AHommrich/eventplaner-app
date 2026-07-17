# eventplaner-app

> **[English version -> `README.md`](README.md)**

[![lint](https://github.com/AHommrich/eventplaner-app/actions/workflows/lint.yml/badge.svg?branch=main)](https://github.com/AHommrich/eventplaner-app/actions/workflows/lint.yml)
[![typecheck](https://github.com/AHommrich/eventplaner-app/actions/workflows/typecheck.yml/badge.svg?branch=main)](https://github.com/AHommrich/eventplaner-app/actions/workflows/typecheck.yml)
[![test](https://github.com/AHommrich/eventplaner-app/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/AHommrich/eventplaner-app/actions/workflows/test.yml)
[![License](https://img.shields.io/badge/License-All%20Rights%20Reserved-red.svg)](LICENSE)

React-Native-/Expo-Companion-App fuer Hochzeitsgaeste und Veranstalter. Gaeste
scannen einmal eine QR-Code-Einladung und bekommen einen kompakten Event-Hub:
RSVP, Ablauf, Countdown und Venue-Navigation, Fotos, Partyspiele und
Datenschutz-Self-Service. Freigegebene Veranstalter koppeln die App ueber einen
kurzlebigen Einmal-Pairing-QR, wechseln Events, verwalten Notizen/ToDos und Fotos
und erhalten optional Aufgaben-Benachrichtigungen.

Dieses Repository ist als Portfolio-/Showcase-Projekt oeffentlich. Das
Production-Backend ist separat, Gastzugang laeuft ueber QR-/Bearer-Tokens, und
echte Eventdaten sind nicht Teil dieses Repositories.

## Highlights

- Ein Scanner erkennt automatisch Gast-Einladungen und Veranstalter-Pairing-QRs.
- Passwortloses Gast-Login mit zweistufigem Familien-Picker.
- Isoliertes Veranstalter-Geraetepairing per kurzlebigem Einmal-QR.
- Active-Event-Management fuer Notizen/ToDos und galerieuebergreifendes Foto-Loeschen.
- Datenschutzminimierte Aufgaben-Pushes ohne Task- oder Gastinhalt auf dem Sperrbildschirm.
- Backend-gesteuertes Theme, Event-Copy und Feature-Flags.
- DSGVO-orientierte Datenschutz-Oberflaechen direkt in der App.
- Lokal gebuendelte Fonts, keine Font-CDN-Abhaengigkeit zur Laufzeit.
- Gemeinsame API-/Auth-Schicht mit gegenseitig exklusiven Guest-/Organizer-Sessions in SecureStore.
- Jest-Abdeckung fuer Library- und Screen-Verhalten plus kleine
  Maestro-Smoke-Suite fuer Login/Logout.

## Tech-Stack

| Schicht    | Wahl                                                  |
| ---------- | ----------------------------------------------------- |
| App        | Expo SDK 54, Expo Router v6, React Native             |
| Sprache    | TypeScript, strict mode                               |
| Styling    | NativeWind v4, Tailwind v3, backend-gesteuertes Theme |
| Daten      | Axios-Client mit Actor-Bearer und Event-Scoping       |
| Storage    | `expo-secure-store` fuer Guest-/Organizer-Sessions    |
| Push       | Expo Notifications fuer optionale Veranstalter-Tasks  |
| i18n       | `i18n-js` mit deutschen und englischen Dictionaries   |
| Monitoring | Optionale Sentry-React-Native-Integration             |
| Tests      | Jest, `jest-expo`, React Native Testing Library       |
| E2E        | Lokale Maestro-Smoke-Flows                            |

Die App erwartet ein Laravel-/Sanctum-Backend mit der API-Form aus
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) und
[`docs/showcase/qr-auth.md`](docs/showcase/qr-auth.md).

## Schnellstart

```bash
nvm use
npm install --legacy-peer-deps
npx expo start
```

Expo Go kann die App-UI starten, aber authentifizierte Flows brauchen ein
Backend und einen gueltigen lokalen oder Demo-QR-Token. Echte Gast-Tokens
niemals committen. Fuer lokale Smoke-Tests wird ein Token ueber
`MAESTRO_SOLO_TOKEN` exportiert.

Der Veranstaltermodus braucht zusaetzlich einen frischen Einmal-Pairing-QR aus
einem freigegebenen, verifizierten Web-Account. Echte Remote-Pushes brauchen
einen EAS-Development-/Store-Build mit konfigurierten APNs-/FCM-Credentials;
fuer die UI ohne Push reicht Expo Go weiterhin aus.

Ein direkter nativer Account-Login wird bewusst noch nicht angeboten. Passwort
und die OAuth-Anbieter der Web-App sollen gemeinsam landen, damit reine
OAuth-Konten keinen zweitklassigen Veranstalter-Zugang erhalten.

`API_BASE` nutzt standardmaessig den Staging-Backend-Wert aus
[`constants/env.ts`](constants/env.ts) und kann zur Build-Zeit ueberschrieben
werden:

| Build-Variante                   | API-Base-Verhalten                          |
| -------------------------------- | ------------------------------------------- |
| Expo Go / `npm start`            | Nutzt den Default aus `constants/env.ts`    |
| `eas build --profile preview`    | Nutzt die Preview-EAS-Umgebung              |
| `eas build --profile production` | Nutzt den Production-Override in `eas.json` |

Optionale Monitoring-Variablen:

| Variable                                | Zweck                                            |
| --------------------------------------- | ------------------------------------------------ |
| `EXPO_PUBLIC_SENTRY_DSN`                | Aktiviert Sentry-Runtime-Reporting, wenn gesetzt |
| `EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` | Optionales Tracing-Sampling, Standard ist `0`    |
| `SENTRY_ORG` / `SENTRY_PROJECT`         | Optionale Overrides fuer Source-Map-Upload-Ziel  |
| `SENTRY_AUTH_TOKEN`                     | Geheimer Build-Time-Token, niemals committen     |

## Skripte

| Skript                  | Zweck                         |
| ----------------------- | ----------------------------- |
| `npm start`             | Expo / Metro starten          |
| `npm run ios`           | iOS-Ziel starten              |
| `npm run android`       | Android-Ziel starten          |
| `npm run lint`          | ESLint ausfuehren             |
| `npm run format:check`  | Prettier-Formatierung pruefen |
| `npm run typecheck`     | `tsc --noEmit` ausfuehren     |
| `npm test`              | Jest einmal ausfuehren        |
| `npm run test:coverage` | Jest mit Coverage-Schwellen   |

## Projektstruktur

```text
app/          Expo-Router-Screens
components/   Gemeinsame UI-Wrapper und Controls
constants/    Theme-, Env- und Font-Maps
lib/          API-, Guest-/Organizer-Auth-, Management-, Push- und Privacy-Logik
locales/      Deutsche und englische Uebersetzungen
tests/        Jest-Setup und gespiegelter Testbaum
.maestro/     Lokale E2E-Smoke-Flows
docs/         Architektur, Datenschutz, Tests und Showcase-Notizen
```

## Tests

- Unit- und integrationsartige Screen-Tests laufen ueber Jest.
- Regressionstests schuetzen vor versehentlichen Tracking-SDKs und
  Runtime-CDN-Font-Nutzung.
- Maestro deckt einen kleinen Real-Device-Smoke-Pfad ab: Login und Logout.
- Store-/Native-Release-Schritte sind aus diesem Repository allein bewusst
  nicht voll reproduzierbar, weil Backend-Zugang und Store-Accounts privat
  bleiben.

## Datenschutz und Sicherheit

Gast-Sessions sind bearer-token-basiert und fuer die Event-UX bewusst
langlebig. Der Token liegt in `expo-secure-store` und wird durch
Backend-seitige Event-Cleanup-/Revocation-Prozesse begrenzt. Der Trade-off ist
in [`docs/showcase/qr-auth.md`](docs/showcase/qr-auth.md) dokumentiert.

Veranstalter-Sessions verwenden einen getrennten User-Bearer und schliessen
Gast-Sessions gegenseitig aus. Das Backend autorisiert jede eventbezogene
Management-Anfrage neu. Optionale Expo-Pushes enthalten nur generische Copy
plus technische Event-/Notiz-IDs, niemals Notiztitel/-inhalt, Eventname,
Gastdaten oder zuweisenden User. Push ist explizites Opt-in; Logout/Gerätewiderruf
entfernt das Bearer-gebundene Ziel serverseitig, ein Offline-Logout wird bei einem
späteren App-Start erneut versucht.

Persistente On-Device-Keys stehen in
[`docs/storage-keys.md`](docs/storage-keys.md). Runtime-Dependency-Datenfluesse
sind in [`docs/dependencies.md`](docs/dependencies.md) dokumentiert.
Sicherheitsmeldungen sind in [`SECURITY.md`](SECURITY.md) beschrieben.

## Dokumentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) - Layer-Uebersicht und Flow-Notizen.
- [`docs/showcase/`](docs/showcase/) - kurze Engineering-Narratives fuer Review.
- [`docs/e2e.md`](docs/e2e.md) - E2E-Strategie und Grenzen.
- [`tests/README.md`](tests/README.md) - Begruendung der Testabdeckung.
- [`.maestro/README.md`](.maestro/README.md) - lokale Maestro-Nutzung.

## Bekannte Grenzen

- Das Backend ist ein separates Projekt und fuer authentifizierte Flows noetig.
- Public Builds brauchen echte EAS-/Store-Credentials, die hier nicht enthalten
  sind.
- Remote-Veranstalter-Pushes brauchen konfigurierte APNs-/FCM-Credentials und einen Native-Build.
- E2E ist Smoke-only; tieferes Verhalten wird durch Jest abgedeckt.
- Demo-Daten kommen vom Backend. Die App liefert keinen Offline-Mock-Server mit.

## Lizenz

Alle Rechte vorbehalten. Siehe [`LICENSE`](LICENSE). Oeffentlich einsehbar zu
Portfolio-Zwecken; keine Nutzung, kein Fork und keine Weiterverbreitung ohne
schriftliche Genehmigung.
