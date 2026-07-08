# Polish-Sweep + Store-Release-Plan

> **Status: PLAN-ONLY, entstanden am 2026-07-05.**
> Nichts wurde bisher umgesetzt. Nachfolger-Plan zu [`REFACTOR_PLAN.md`](REFACTOR_PLAN.md)
> nach Abschluss der 12 Refactor-Phasen. Ziel: Store-Release
> (TestFlight external + Play Closed Testing) bis **~1. September 2026**.
>
> Basis: Bewertung des Repos am 2026-07-05 durch einen Review-Agent
> (Senior Architect / QA / Security / DSGVO). Der Review hatte
> Executive-Summary "solide, portfolio-fähig, mit einer Handvoll Drifts +
> fehlender Store-Vorbereitung". Dieser Plan schließt diese Lücken.

---

## 🛑 Git-Regel (unverändert aus [`REFACTOR_PLAN.md`](REFACTOR_PLAN.md))

**Der Agent führt NIEMALS git-Aktionen selbstständig aus.**
Am Ende jedes Tasks: Agent schreibt Files → produziert die 3-Zeilen-Commit-
Message als Text → André commited und pusht selbst → bestätigt "next" → Agent
macht weiter.

---

## Kontext: Was ist der Ausgangszustand?

**Bereits erledigt (Refactor-Plan 12 Phasen):**

- Strict TypeScript, Expo SDK 54, NativeWind v4
- Clean Layers: `constants/theme.ts` + `EventThemeContext` + `useLanguage()`
- Bearer-Interceptor in `lib/api.ts`, Session in `expo-secure-store`
- DSGVO Art. 13/15/17 als eigene Screens, Art. 6/7 via `ConsentGate`
- 10 Google Fonts lokal gebündelt (kein CDN)
- CI: Lint + Typecheck + Test-Coverage mit Threshold-Enforcement
- `no-tracking`-Regressionstest verhindert Tracking-SDK-Schmuggel
- README (DE + EN), CLAUDE.md, ARCHITECTURE.md, dependencies.md, storage-keys.md, e2e.md, showcase/
- Maestro E2E-Skelett (lokal, nicht in CI)

**Gefundene Drifts (Review 2026-07-05):**

1. **Domain-Story unklar dokumentiert.** Expo Go / Dev → `beta.hommrich.app` ist Absicht,
   Store-Build → `eveplan.de` ist Absicht (siehe `eas.json`), aber die Doku
   (`dependencies.md`, `README.md`, `SECURITY.md`, `no-tracking.test.ts` Kommentar)
   erwähnt nur `hommrich.app`. Kein Bug, aber inkonsistente Erzählung.
2. **`camera_scan` Consent existiert nur in der Doku.** `CLAUDE.md` und
   `docs/ARCHITECTURE.md:119` behaupten, `scan.tsx` sei mit
   `<ConsentGate purpose="camera_scan">` gewrappt. `lib/consents.ts:16` kennt
   den Key nicht (nur `photo_upload | photo_game`), `scan.tsx` importiert
   keinen ConsentGate. Entscheidung: Consent additiv einführen (Option A).
3. **Boilerplate-Reste** (`/App.tsx`, `/index.ts`) — funktional inaktiv
   (`package.json.main = expo-router/entry`), aber verwirrend im Root.
4. **`app.json` iOS `LSApplicationQueriesSchemes`-Duplikat** (`comgooglemaps`
   zweimal).
5. **Test-Tokens committet** in `CLAUDE.md:60-61` — laut Doku "lokal, nicht
   Staging", aber Prinzip: nicht in öffentliches Repo.

**Fehlt komplett für Store-Release:**

- Impressum (§ 5 DDG, Pflicht in DE)
- UGC-Moderation (Apple Guideline 1.2 — Report + Block + Contact)
- iOS `NSCameraUsageDescription` + `NSPhotoLibraryUsageDescription` in `app.json`
- Öffentliche HTML-Datenschutzerklärung (aktuell nur JSON-Endpoint)
- App-Store-Assets (Screenshots, Beschreibungen, Icon 1024)
- Age-Rating- + Data-Safety-Fragebogen-Antworten
- Reviewer-Login (Apple/Google haben keinen QR-Code!)
- Release-/Rollback-Playbook

**Bewusst NICHT in diesem Plan (Follow-ups):**

- Sentry / Error-Monitoring (Preisrecherche EU-Region zuerst — André)
- `drinks.tsx` in Komponenten aufteilen (1210 LOC)
- Maestro in CI
- `app/`-Coverage über 61 % (braucht WebView/Multipart-Harness)

---

## ⚠️ Entscheidungen, die vor Start geklärt werden müssen

| # | Entscheidung | Kategorie | Betrifft | Status |
| - | ------------ | --------- | -------- | ------ |
| E1 | Apple Developer Account ($99/J) aktiv? | Extern / Account | T15, T22, T25, T27 | offen |
| E2 | Google Play Console Account ($25 einm.) aktiv? | Extern / Account | T15, T23, T26, T28 | offen |
| E3 | Support-Email für Store-Listing | Extern / Branding | T15, T20 | offen — Default-Vorschlag: `support@eveplan.de` |
| E4 | Impressum-URL: Wo lebt die Web-Version? | Backend / Legal | T16 | offen — Zielannahme: `https://eveplan.de/impressum` |
| E5 | UGC-Report/Block-Endpoints Backend | Backend / Moderation | T17 | offen — existieren nicht, müssen im Backend-Repo als Task |
| E6 | HTML-Datenschutz-URL für Store-Formular | Backend / Legal | T10 (aus altem Plan) | offen — Zielannahme: `https://eveplan.de/datenschutz` |
| E7 | Content-Rating-Selbsteinschätzung: Drinks-Feature | Store / Legal | T21 | offen — Arbeitshypothese: 12+ / USK 12 |

Bevor T15 (Ende Woche 1) startet, sollten E1–E7 beantwortet oder als
bewusste Annahme in [`docs/STORE_RELEASE.md`](STORE_RELEASE.md) dokumentiert
sein. E4/E5/E6 sind Backend-Tasks und werden separat im Backend-Repo getrackt.

### Bearbeitungsmodus für E1-E7

Diese Punkte sind keine normalen App-Repo-Tickets. Der saubere Modus ist:

- **Entscheidungspunkte**: E1, E2, E3, E7. Codex kann vorbereiten, prüfen und
  dokumentieren; Andre muss final entscheiden bzw. Accounts anlegen.
- **Backend-Punkte**: E4, E5, E6. Codex kann API-Kontrakte,
  Akzeptanzkriterien und App-Integration vorbereiten; Umsetzung braucht das
  Backend-Repo oder ein Backend-Ticket.
- **App-Repo-Punkte**: T15, T16 Client-Teil, T17 Client-Teil, T20, T21. Diese
  koennen im App-Repo umgesetzt werden, sobald die oben genannten Annahmen
  bestaetigt oder als vorlaeufig markiert sind.

### Entscheidungspakete

| # | Naechste Aktion | Vorlaeufige Annahme | Akzeptanzkriterium |
| - | --------------- | ------------------- | ------------------ |
| E1 | Apple Developer Membership pruefen/anlegen; Team-ID und App Store Connect Zugriff in `STORE_RELEASE.md` eintragen. | Account wird fuer `ahommrichs-organization` genutzt. | App Store Connect App kann fuer `com.ahommrichsorganization.eveplan` angelegt werden. |
| E2 | Google Play Console pruefen/anlegen; Package Name und Zugriff in `STORE_RELEASE.md` eintragen. | Android Package Name bleibt Expo/EAS-konform bei `com.ahommrichsorganization.eveplan`. | Play Console App kann fuer den finalen Package Name angelegt werden. |
| E3 | Support-Adresse festlegen und in `SECURITY.md`, Store-Metadaten und Legal-Texten verwenden. | `support@eveplan.de` fuer Store/Support, `security@hommrich.app` nur falls bewusst getrennt. | Eine erreichbare Mailadresse ist in Store-Listing, Privacy/Imprint und Security-Doku konsistent. |
| E4 | Backend-Ticket fuer HTML-Impressum + JSON-Imprint-Endpoint anlegen. | `https://eveplan.de/impressum` und `GET /api/legal/imprint?locale=de\|en`. | URL ist browseroeffentlich erreichbar; App kann Impressum offline-cachen analog Privacy. |
| E5 | Backend-Ticket fuer UGC Report/Block/Contact anlegen; App-Client danach bauen. | Minimaler Moderationsumfang reicht: Foto melden, Gast blockieren/ausblenden, Supportkontakt. | Apple Guideline 1.2 ist mit UI, API und Review Notes belegbar. |
| E6 | Backend-Ticket fuer HTML-Datenschutz anlegen. | `https://eveplan.de/datenschutz`; JSON-Endpoint bleibt fuer App-Inhalte. | Store-Formulare bekommen eine browseroeffentliche Datenschutz-URL. |
| E7 | Store-Fragebogen mit Drinks-Feature konservativ beantworten. | 12+ / USK 12 wegen Alkohol-/Drinks-Kontext ohne Verkauf oder Konsumanreiz. | Age Rating in `STORE_RELEASE.md` dokumentiert; Store-Fragebogen-Antworten sind nachvollziehbar. |

---

## Timeline auf einen Blick

| Woche | Fokus | Deliverable |
| ----- | ----- | ----------- |
| **1** (07.07.–13.07.) | Polish + Store-Prep-Check | T1–T15 committed |
| **2** (14.07.–20.07.) | Impressum + UGC-Moderation + Info.plist | App rechtlich store-tauglich |
| **3** (21.07.–27.07.) | Screenshots + Store-Texte + Fragebögen | Alle Store-Assets fertig |
| **4** (28.07.–03.08.) | Store Setup + erster Prod-Build | Build hochladbar |
| **5** (04.08.–10.08.) | TestFlight Internal + Play Internal Testing | ~5 interne Tester |
| **6** (11.08.–17.08.) | External Review (Apple) + Closed Testing (Play) | Beide Stores approved |
| **7** (18.08.–24.08.) | Externe Tester onboarden + Rechts-Check | Beta läuft |
| **8** (25.08.–31.08.) | Reject-Response-Puffer | Version 1.0 released |

**Realistisches Release-Datum:** ~1. September 2026 (Puffer inklusive 1 Rejection).

---

## Woche 1 — Polish-Sweep

### Tag 1 · Triviales (≈ 1.5 h)

#### T1 · Boilerplate-Leichen löschen

- **Löschen:** `/App.tsx`, `/index.ts`
- **Begründung:** `package.json.main = "expo-router/entry"` → beide Files nicht referenziert. Verifiziert am 2026-07-05.
- **Verify:** `npm run typecheck && npm test`

```
chore: drop unused create-expo-app boilerplate

Legacy App.tsx and index.ts from `create-expo-app` were never wired up —
expo-router/entry is the actual entry point.
```

#### T2 · `app.json` iOS Query-Schemes-Duplikat

- **Ändern in `app.json`:** `"LSApplicationQueriesSchemes": ["comgooglemaps", "comgooglemaps"]` → `["comgooglemaps"]`

```
fix(ios): dedupe LSApplicationQueriesSchemes

Duplicate entry was a copy-paste artefact that App Store review would flag.
```

#### T3 · Test-Tokens aus `CLAUDE.md`

- **`.gitignore` erweitern:** Zeile `CLAUDE.local.md` (oder `*.local.md`) ergänzen.
- **Neue Datei** `/CLAUDE.local.md` (NICHT tracked): enthält die zwei Token-Zeilen aus `CLAUDE.md:60-61`.
- **`CLAUDE.md`** Zeilen 58–61 ersetzen durch:
  ```markdown
  ### Test-Tokens (lokal — NICHT Staging)

  Siehe `CLAUDE.local.md` (nicht committet).
  ```

```
chore(docs): move local test tokens out of tracked CLAUDE.md

Guest tokens for the local Laravel instance now live in the gitignored
CLAUDE.local.md so the public repo carries no credentials.
```

---

### Tag 2 · Domain-Story konsistent machen (≈ 2.5 h)

**Kontext:** Absicht ist:
- Expo Go, EAS Preview → `beta.hommrich.app` (Staging)
- EAS Production (TestFlight, Play Store) → `eveplan.de`
- `hommrich.app` ist Legacy und sollte in der Doku nicht mehr Haupt-Wording sein.

#### T4 · `docs/dependencies.md` präzisieren

- Tabellenspalte "To whom" (Zeile 27): `beta.hommrich.app` (Expo Go / EAS Preview) / `eveplan.de` (EAS Production).
- Summary-Bullets Zeile 101–103: analog anpassen.
- **Neuer Absatz "Warum zwei Backends?"** unter der Netzwerktabelle:
  > Staging (`beta.hommrich.app`) hat eine eigene Datenbank mit lokalen Test-Guests
  > und beschriftetem Log. Store-Builds sprechen `eveplan.de`, weil die Prod-Guest-
  > Tokens dort leben. Ein versehentlich auf Prod gepointeter Staging-Build würde
  > mit 401 abgelehnt — daher ist Staging bewusst der `constants/env.ts`-Default.

```
docs(deps): clarify staging vs. production backend domains

Expo Go / EAS Preview target beta.hommrich.app; EAS production build ships
against eveplan.de. Document both explicitly so audit trail matches config.
```

#### T5 · `README.md` + `README.de.md` Domain-Absatz

- Im "Quick start"-Abschnitt eine Tabelle einfügen:

  | Build-Variante | API_BASE | Zweck |
  | -------------- | -------- | ----- |
  | Expo Go / `npm start` | `beta.hommrich.app` | lokale Entwicklung |
  | `eas build --profile preview` | `beta.hommrich.app` | interne Preview-APKs |
  | `eas build --profile production` | `eveplan.de` | TestFlight / Play Store |

- Zeile "Flip to production only for a release build" ersetzen durch Verweis auf die Tabelle.

```
docs(readme): document dev vs. store backend targets

Add a table making the Expo-Go-vs-store domain split explicit so the
"where do my requests actually go" question is answered on the first page.
```

#### T6 · `SECURITY.md` anpassen

- Scope-Abschnitt (Zeile 31): `hommrich.app and beta.hommrich.app` → `eveplan.de (production) and beta.hommrich.app (staging)`.
- Zeile 18, 70: Staging bleibt `beta.hommrich.app`. Prod-URL beim ersten Vorkommen zusätzlich als `eveplan.de` erwähnen.
- Reporting-Mail (Zeile 12, 97): **Entscheidung E3 einbauen.**

```
docs(security): align scope with actual prod/staging domains

Reflect the beta.hommrich.app (staging) + eveplan.de (production) split
that eas.json actually produces.
```

#### T7 · `no-tracking`-Regressionstest kommentieren

- `tests/regressions/no-tracking.test.ts` Zeile 11: Kommentar erweitern:
  ```
  * must fetch its assets from either the JS bundle or the backend
  * (beta.hommrich.app for staging builds, eveplan.de for production
  * builds — see eas.json + constants/env.ts), never from jsDelivr, ...
  ```
- **Keine Assertion-Änderung** — der Test prüft CDN-Blacklist, nicht Domain-Whitelist.

```
test(regressions): document dual-backend rationale in comment

Comment only — the assertion (CDN blacklist) is unchanged.
```

#### T8 · `constants/env.ts` JSDoc

- Kommentar oben in der Datei erweitern um konkrete Auflösungslogik:
  ```
  * Default (Expo Go, EAS Preview) → beta.hommrich.app.
  * Overridden by EXPO_PUBLIC_API_BASE in eas.json production → eveplan.de.
  ```

```
docs(env): explain API_BASE resolution per build variant

Make the staging/production split visible at the definition site, not just
in docs/dependencies.md.
```

---

### Tag 3 · DSGVO-Konsistenz (≈ 2.5 h)

#### T9 · `camera_scan` Consent additiv einführen (Option A — bestätigt)

Reihenfolge (ein Commit):

1. `lib/consents.ts`:
   - `ConsentKey` erweitern: `'photo_upload' | 'photo_game' | 'camera_scan'`
   - `ALL_PURPOSES` ergänzen: `['photo_upload', 'photo_game', 'camera_scan']`

2. `locales/de.ts` + `locales/en.ts`:
   - Neuen Block `consents.camera_scan.{title, body, accept, decline, revokedTitle, revokedBody}` — analog zu `photo_upload`.
   - Vorschlag DE:
     - title: "Kamerazugriff für den QR-Scan"
     - body: "Wir brauchen deine Kamera einmal, um deinen Einladungs-QR zu lesen. Es wird kein Bild gespeichert, nichts an Dritte weitergegeben und nichts im Hintergrund aufgezeichnet."
     - accept: "Einverstanden"
     - decline: "Nicht jetzt"

3. `app/scan.tsx`:
   - `useConsentGate` importieren.
   - `useEffect` beim Mount vor `requestPermission()`: `if (!(await ensureConsent('camera_scan'))) { router.back(); return; }`
   - Alternative: `<ConsentGate purpose="camera_scan">` um den ganzen Return wrappen — je nachdem wie die Provider-API es ergibt. Vor Ort entscheiden.

4. `docs/storage-keys.md`:
   - Neue Zeile im Consent-Abschnitt: `consent_camera_scan` — Purpose "Kamera-Zugriff für den QR-Login", Retention: "bis Revoke", Cleared on logout: **No** (analog zu photo_upload).

5. `CLAUDE.md`:
   - Zeile mit `ConsentKey`-Liste auf drei Werte aktualisieren.
   - Beispielblock unter "**ConsentGate**" um camera_scan ergänzen.

6. `docs/ARCHITECTURE.md`:
   - Zeile 119 (Screens-Tabelle, `scan.tsx`-Row) beibehalten — sie ist ab jetzt korrekt.

7. **Tests:**
   - `tests/lib/consents.test.ts`: neuer Fall — `grant/get/revoke` für `camera_scan`.
   - `tests/app/scan.test.tsx`: neuer Fall — Consent-Modal erscheint vor Kamera-Preview beim ersten Mount; wird nicht erneut gezeigt wenn Consent bereits granted.

```
feat(consent): add camera_scan consent gate before camera preview

Aligns the app with the Art. 6/7 pattern already used for photo_upload
and photo_game. Backend not touched — consent lives on device via
SecureStore consent_camera_scan.
```

#### T10 · Follow-up: öffentliche Datenschutz-URL

- `docs/REFACTOR_PLAN.md → Follow-ups` einen Eintrag hinzufügen (oder alternativ direkt in [`STORE_RELEASE.md`](STORE_RELEASE.md), siehe T15):

  > **Public HTML privacy policy on `eveplan.de/datenschutz`** — der In-App-Endpoint
  > `/api/legal/privacy` liefert JSON. Play Console + App Store Connect verlangen
  > eine öffentliche URL. Umsetzung im Backend-Repo (`AHommrich/eventplaner`).

```
docs(plan): follow up on public privacy URL requirement

Store submissions need a browser-openable URL; the current in-app endpoint
is JSON only. Tracked as backend-repo task.
```

---

### Tag 4 · Release-Playbook + a11y (≈ 3 h)

#### T11 · `docs/RELEASE.md` schreiben

Neue Datei mit folgender Struktur:

1. **Preflight-Checkliste** (`typecheck`, `lint`, `test:coverage`, Maestro lokal grün)
2. **Version-Bump** — wann `1.x.y`-Semantik, wann `buildNumber` reicht (`eas.json` `autoIncrement: true` regelt buildNumber automatisch, aber Version im `app.json` muss manuell)
3. **EAS-Build-Kommandos** (Preview → `beta.hommrich.app`, Production → `eveplan.de`)
4. **Smoke-Test-Matrix** vor Store-Upload:
   - iOS: QR-Login solo (echter QR), RSVP setzen, Foto-Upload mit Consent-Modal, Impressum + Datenschutz erreichen, Sprache wechseln, Logout
   - Android: dieselbe Matrix
5. **Rollback:**
   - JS-Only-Regression → `eas update:rollback --branch production`
   - Native-Regression → Store-Rollback (App Store: alte Build wieder aktivieren; Play: Track wieder auf alte Version)
6. **Was NICHT via EAS Update ausrollbar ist:** native Module-Updates, Info.plist-Änderungen, App-Icon, Splash — die brauchen einen neuen Store-Build.

```
docs(release): add release + rollback playbook

Preflight, build commands, smoke-test matrix, rollback strategy.
Missing until now; every release relied on tribal knowledge.
```

#### T12 · a11y-Sweep auf Icon-Buttons

- Grep: `Ionicons name=` in `app/**` — jeder klickbare Icon-Only-Button bekommt `accessibilityLabel={t('a11y.<key>')}` (+ `accessibilityRole="button"` wo TouchableOpacity/Pressable).
- Betroffen (nicht abschließend):
  - `photos.tsx`: Close-X im Modal, FAB-Camera-Button
  - `home.tsx`: Venue-Pin-Icon-Button (openInMaps)
  - `settings.tsx`: alle Chevron-Buttons
  - `photo-game.tsx`: Camera/Reset-Buttons
  - `data-export.tsx`: Share-Icon
- `locales/de.ts` + `en.ts`: neuer Block `a11y.<key>` mit Beschreibungen.

```
feat(a11y): add accessibility labels to icon-only buttons

Screen reader (VoiceOver / TalkBack) support for every Pressable that
renders an Ionicon without a text label.
```

---

### Tag 5 · Store-Prep-Vorprüfung + Grooming (≈ 1.5 h)

#### T13 · Screenshots ins Repo

- `docs/screenshots/` mit 4–6 PNGs füllen (Devices: iPhone 15 Pro, ein Android-Referenzgerät):
  1. Welcome-Screen mit QR-Button
  2. Home mit Countdown + Cover
  3. RSVP-Familie (mit 2–3 Gästen)
  4. Foto-Galerie
  5. Consent-Modal (photo_upload) — Portfolio-Gold
  6. Settings mit sichtbarem DSGVO-Block
- README-Highlight-Abschnitt (`README.md` Zeile 85) verlinken auf die Ordner-Inhalte.

```
docs: add app screenshots referenced in README

Empty placeholder folder is now populated with real captures from the
staging build.
```

#### T14 · `docs/REFACTOR_PLAN.md → Follow-ups` aktualisieren

Neue Follow-ups eintragen:

- **Monitoring / Error-Reporting** — Sentry Self-Hosted (EU) vs. Sentry SaaS (EU-Region) Preisvergleich → Entscheidung → Integration. Owner: André. Timing: nach Store-Release.
- **`drinks.tsx` in Komponenten aufteilen** (1210 LOC → Rangliste, Akkordeon-Item, Suche als eigene Files).
- **Maestro in CI** oder README-Klarstellung "lokal-only".
- **`app/`-Coverage über 61 %** wenn WebView-/Multipart-Harness gebaut wird.

```
docs(plan): refresh follow-ups after polish sweep

Track monitoring, drinks.tsx split, Maestro-CI, coverage floor lift as
post-launch improvements.
```

#### T15 · Store-Prep-Vorprüfung — neue Datei `docs/STORE_RELEASE.md`

Datei anlegen mit folgenden Abschnitten (leer / TODO-Marker, wird über die nächsten Wochen gefüllt):

- **Accounts & Zugänge** — Apple Developer, Google Play Console, App Store Connect Users, Play Console Users
- **Bundle Identifier / Package Name** — iOS: `com.ahommrichsorganization.eveplan` (fixiert), Android: hier festhalten was EAS erwartet
- **Support-Email + Marketing-URL** — Ergebnis von E3
- **App Store Connect App-ID** — wird in Woche 4 eingetragen
- **Google Play App-ID** — wird in Woche 4 eingetragen
- **Reviewer-Zugang** — wird in T27 gefüllt
- **Age Rating** — Ergebnis von E7
- **Datenschutz-URL** — Ergebnis von E6
- **Impressum-URL** — Ergebnis von E4
- **Rechts-Check am** — leer, wird in T30 gefüllt

```
docs(store): initial release readiness checklist

Empty template that gets filled over the next 8 weeks. Central place
for all store-facing metadata that isn't code.
```

---

## Woche 2 — Rechtliches & Compliance-Lücken

**Voraussetzung:** E4, E5, E6 aus dem Entscheidungsblock geklärt und im
Backend-Repo als Tickets angelegt.

#### T16 · Impressum-Screen (§ 5 DDG, Pflicht in DE)

Analog zur `privacy.tsx`-Implementierung:

1. **Backend (Backend-Repo, separater Task):**
   - Endpoint `GET /api/legal/imprint?locale=de|en` liefert JSON mit `sections` analog zu `privacy`.
   - HTML-Route `eveplan.de/impressum` für Store-Formulare.

2. **App-Client:**
   - `lib/legal.ts`: `fetchImprint(locale)`, `readCachedImprint(locale, allowStale)` — Copy-Paste-Analogie zu `fetchPrivacyNotice`.
   - Cache-Key: `legal_imprint_cache_<locale>`.
   - Neuer Screen `app/legal/imprint.tsx` — Copy-Paste-Analogie zu `app/legal/privacy.tsx`.
   - `app/(tabs)/settings.tsx`: neue Zeile "Impressum" **oberhalb** von "Datenschutzerklärung" (übliche Reihenfolge in DE).
   - Translations: `settings.imprint`, `imprint.title`, `imprint.loading`, `imprint.error` in beiden Locales.

3. **Doku:**
   - `docs/storage-keys.md`: `legal_imprint_cache_de` + `_en` in den Cache-Abschnitt.

4. **Tests:**
   - `tests/lib/legal.test.ts`: neue Fälle für `fetchImprint` (happy + stale-fallback).
   - `tests/app/legal-imprint.test.tsx`: happy + failure (analog zu `legal-privacy.test.tsx`).

```
feat(legal): add imprint screen + backend fetch (Sec. 5 DDG)

Legally required for German-market app distribution. Uses the same
backend-served + 24h SecureStore-cached pattern as the privacy notice.
```

#### T17 · UGC-Moderation (Apple Guideline 1.2)

**Bedeutung:** Ohne Report/Block wird die App bei TestFlight External Review
mit hoher Wahrscheinlichkeit abgelehnt.

1. **Backend (Backend-Repo, separater Task):**
   - `POST /api/photos/{id}/report { reason }` — legt Meldung an, Admin sieht sie im Backend-UI.
   - `POST /api/guests/{id}/block` — der aktuelle Guest blockt einen anderen; Backend filtert dessen Fotos aus `/api/photos` für den Blocker.
   - `GET /api/photos` respektiert die Block-Liste.

2. **App-Client:**
   - `app/(tabs)/photos.tsx` Detail-Modal: neue Buttons "Melden" + "Nutzer blockieren" (Icon oder Menü — Vor-Ort-Entscheidung).
   - Bestätigungs-Alert mit `Alert.alert` (analog zu RSVP-Decline-Pattern).
   - Übersetzungen unter `photos.report.*` + `photos.block.*`.

3. **Doku:**
   - `SECURITY.md` erweitern um Abschnitt "Content Moderation" mit Response-Ziel (z.B. "wir prüfen Meldungen innerhalb 48 h").
   - `docs/STORE_RELEASE.md` unter "Apple Guideline 1.2 compliance" die Endpoints + UI-Elemente auflisten.

4. **Tests:**
   - `tests/app/tabs-photos.test.tsx`: neuer Fall — Report-Button feuert POST, Alert erscheint.
   - `tests/app/tabs-photos.test.tsx`: neuer Fall — Block-Button feuert POST, Photo verschwindet aus Liste nach Refresh.

```
feat(photos): add report + block controls for UGC guideline compliance

Apple Guideline 1.2 requires a report mechanism, block capability and
published contact info for any UGC surface. This wires up the client side;
backend endpoints tracked separately.
```

#### T18 · Nutzungsstrings (Info.plist / Android)

- `app.json` unter `ios.infoPlist` ergänzen:
  ```json
  "NSCameraUsageDescription": "eveplan liest deinen Einladungs-QR-Code und erlaubt dir, Fotos für das Hochzeitsalbum aufzunehmen.",
  "NSPhotoLibraryUsageDescription": "eveplan lädt Fotos aus deiner Bibliothek in das Hochzeitsalbum hoch, wenn du das möchtest."
  ```
- Android: `expo-camera` und `expo-image-picker` deklarieren die Permissions automatisch beim Prebuild. Verifizieren:
  ```bash
  npx expo prebuild --clean --platform android
  # kurz in android/app/src/main/AndroidManifest.xml reinschauen, dann prebuild verwerfen (NICHT committen)
  git clean -fd android/
  ```
- **Wichtig:** `/android` und `/ios` sind in `.gitignore` — Prebuild-Output darf **nicht** committet werden.

```
chore(ios): add camera + photo library usage description strings

Required by iOS 10+; missing strings cause a hard crash on first camera
or photo-library access in release builds. Dev builds print a warning
but continue, which is why this was never noticed locally.
```

---

## Woche 3 — App-Store-Assets

#### T19 · Screenshots produzieren (Store-Größen)

- **iOS Pflicht (mind. eine pro Kategorie):**
  - iPhone 6.9" (iPhone 15/16 Pro Max) — 1290×2796 px
  - iPhone 6.5" (Fallback für ältere Geräte) — 1242×2688 px oder 1284×2778 px
  - iPad 13" (weil `supportsTablet: true`) — 2064×2752 px
- **Android:**
  - Phone Screenshots (mind. 2, empfohlen 4–8) — mind. 320px kurze Kante
  - Feature Graphic — 1024×500 px, PNG oder JPG (kritisch: darf keine transparenten Ränder haben)
  - App Icon Store — 512×512 px, PNG
- **Motive:** Vorschlag aus T13 verwenden.
- Ablage: `docs/screenshots/{ios,android}/` mit sprechenden Filenames.

```
docs(store): add store-ready screenshots for iOS + Android

All required device sizes captured against the staging environment
with a demo family (Caspari) so no real guest data appears in the store.
```

#### T20 · Store-Listing-Texte

Neue Datei `docs/STORE_LISTING.md` mit:

- **App-Name:** eveplan
- **Untertitel** (Apple, max 30 Zeichen): z.B. "Deine Hochzeitseinladung"
- **Kurzbeschreibung** (Play Store, max 80 Zeichen): z.B. "Alles für deinen Hochzeitstag – RSVP, Fotos, Programm. Ohne Tracking."
- **Langbeschreibung** (max 4000 Zeichen) — Struktur:
  - Einleitung: was macht die App
  - Feature-Liste (RSVP, Foto-Galerie, Countdown, Getränke-Log, Foto-Spiel)
  - Datenschutz-Absatz (kein Tracking, keine Werbung, DSGVO-konform, Fonts lokal)
  - Wie funktioniert der QR-Login
  - Support-Email
- **Keywords** (Apple, max 100 Zeichen, kommasepariert): "Hochzeit,RSVP,Einladung,Wedding,Gast,Fotos"
- **What's new** (Version 1.0): "Erste Version von eveplan."
- **Support-URL** — Ergebnis von E3
- **Marketing-URL** — leer oder `eveplan.de`
- **Beides in DE + EN** unter separaten Abschnitten.

```
docs(store): draft store-listing copy (DE + EN)

Titles, subtitles, short + long descriptions, keywords, support URL —
ready to paste into App Store Connect + Play Console in week 4.
```

#### T21 · Age Rating + Data Safety vorbereiten

In `docs/STORE_RELEASE.md` unter "Fragebögen" festhalten (damit du sie beim
Ausfüllen 1:1 kopieren kannst):

**Apple App Privacy (Nutrition Label):**
- Data linked to you:
  - Contact Info → Name (Vorname + Nachname, für Anzeige)
  - User Content → Photos (Foto-Galerie + Foto-Spiel-Uploads)
- Data used to track you: **None**
- Analytics: **None**
- Third-party analytics: **None**

**Google Data Safety Form:**
- Data collected: Name, Photos (both linked, not shared with third parties)
- Data encrypted in transit: Yes (HTTPS)
- Data can be deleted: Yes (in-app via Art. 17 Erasure)
- Committed to Play Families Policy: n/a (nicht für Kinder gedacht)

**Age Rating:**
- Apple: 12+ (wegen Alcohol-References im Drinks-Feature)
- Google: PEGI 12 (analog); USK 12 (analog)
- **Alternative:** wenn das Drinks-Feature per default disabled ist bei Store-Launch, könnte 4+ / USK 0 gehen. **Entscheidung E7.**

```
docs(store): prepare privacy + age-rating questionnaire answers

Cheat-sheet so App Store Connect + Play Console forms get consistent
answers on the first attempt.
```

---

## Woche 4 — Store-Setup + erster Test-Build

#### T22 · App Store Connect Setup

- App-Eintrag anlegen mit Bundle-ID `com.ahommrichsorganization.eveplan`.
- Metadaten aus T20 einpflegen.
- App-Icon 1024×1024 hochladen (aus `assets/icon.png` — Größe verifizieren).
- Screenshots aus T19 hochladen.
- Privacy Policy URL (`eveplan.de/datenschutz`) + Support-URL eintragen.
- Age-Rating-Fragebogen aus T21 ausfüllen.
- **Kein Commit** — reine Web-Aktion.

`docs/STORE_RELEASE.md` aktualisieren mit der App Store Connect App-ID.

#### T23 · Google Play Console Setup

- App-Eintrag anlegen.
- Store-Listing aus T20.
- Data Safety Form aus T21.
- Grafiken aus T19.
- **Internal Testing Track** einrichten (bis 100 Tester, kein Google-Review).
- **Kein Commit.**

`docs/STORE_RELEASE.md` aktualisieren mit der Play App-ID.

#### T24 · Erster EAS Production Build

- `app.json` Version verifizieren: `1.0.0`.
- `eas.json` `autoIncrement: true` regelt buildNumber ✓ (bereits so konfiguriert).
- `eas build --profile production --platform all`
- Auf beiden Plattformen manuell smoke-testen — Matrix aus T11 anwenden.

**Falls Bug gefunden:** zurück zu Woche 1-Style-Fix + neuer Build. Version bleibt
`1.0.0`, buildNumber inkrementiert automatisch.

---

## Woche 5 — Internal Testing

#### T25 · TestFlight Internal (Apple)

- Interne Tester (André, Tabea, 2–3 vertraute Personen) über Apple-ID einladen.
- **Kein Review nötig.**
- Feedback über TestFlight-Kommentare oder eigene Mail-Runde sammeln.

#### T26 · Play Internal Testing

- Tester über Mail oder Google-Gruppe einladen.
- **Kein Review nötig.**
- Bei Regressionen: Fix im Repo → neuer Build → `versionCode` inkrementiert automatisch.

**Bug-Iteration:** rechne mit 1–2 kleinen Fix-Runden. Jeweils als
`fix: <problem>`-Commit + neuer Build.

---

## Woche 6 — External Beta vorbereiten

#### T27 · TestFlight External Review beantragen

**Braucht Apple-Review** (~24–48 h, gelegentlich mehr).

**Häufige Reject-Gründe für unsere Konstellation und Vorbeugung:**

1. **UGC-Moderation** → adressiert durch T17.
2. **Datenschutzerklärung nicht erreichbar** → adressiert durch T10/T16 (öffentliche URL).
3. **Reviewer kann sich nicht einloggen** — Apple-Reviewer haben keinen echten QR-Code. **Muss:**
   - In App Store Connect → App Review Information → Notes:
     - Anleitung: "Öffnen Sie `eveplan.de/reviewer` in Safari, scannen Sie den dort abgebildeten QR mit der eveplan-App, oder verwenden Sie im DEV-Modus nicht verfügbar — nutzen Sie stattdessen Token `<reviewer-token>` (siehe Screenshot)."
     - **Alternative:** Backend liefert einen zeitlich begrenzten Reviewer-Token, der in den Notes steht. Backend-Task.
   - Screenshot des QR beilegen.

**Umsetzung im Repo:**
- `docs/STORE_RELEASE.md`: neuer Abschnitt "App Review Notes" mit fertigem Text zum Einfügen in App Store Connect.
- Falls Reviewer-Token-Ansatz gewählt: Backend-Task in Backend-Repo tracken.

```
docs(store): add reviewer instructions + demo-token flow

Apple reviewers cannot scan the real invitation QR — this documents the
alternative login path they should follow, plus a placeholder screenshot.
```

#### T28 · Play Closed Testing

- Von Internal auf Closed Testing hochstufen (bis 100 Tester, öffentlich einladbar per Link).
- Google prüft ab hier — meist innerhalb 24 h.
- Bei Reject-Reasons: dokumentieren in `docs/STORE_RELEASE.md` unter "Play Review History".

---

## Woche 7 — Rollout + Rechtsprüfung

#### T29 · Externe Testnutzer einladen

- Apple: nach TestFlight-Approval den öffentlichen Test-Link teilen.
- Google: Closed-Testing-Link teilen.
- Feedback-Kanal: eine Mailadresse (aus E3) + optional Google Form für strukturiertes Feedback.

#### T30 · Rechts-Sanity-Check

Selbst durchgehen oder — bei Budget — von einem Anwalt für IT-Recht prüfen lassen:

- [ ] **Impressum vollständig** — Name, ladungsfähige Adresse, Kontakt (Telefon + Mail), verantwortliche Person i.S.d. § 18 MStV (nur wenn journalistisch, hier eher nein).
- [ ] **Datenschutzerklärung** — alle Verarbeitungen benannt (RSVP, Fotos, Getränke-Log, Foto-Spiel, Erasure, Consents, Kamera, Fotobibliothek), Rechtsgrundlagen (Art. 6 Abs. 1 lit. a/b/f), Betroffenenrechte, Kontaktweg für DSGVO-Anfragen.
- [ ] **AVV mit Backend-Hoster** — welcher Hoster? Ist ein AVV unterzeichnet?
- [ ] **AVV mit Expo/EAS?** — technisch relevant weil Build-Server Zugriff auf Bundle-Assets haben. In der Regel decken Expo's Terms das ab; prüfen.
- [ ] **Cookies/Local Storage in Native App** — kein Cookiebanner nötig (native), aber `docs/storage-keys.md`-Inhalt in Kurzform in die Datenschutzerklärung übernehmen.
- [ ] **Nutzungsbedingungen** — nice-to-have, für rein private Hochzeits-App nicht zwingend, für Store-Auftritt aber sauber.

Ergebnisse in `docs/STORE_RELEASE.md` unter "Rechts-Check am `<Datum>`" mit Checklisten-Status festhalten.

---

## Woche 8 (Puffer) — Rejection-Response

Realistisch: mindestens **1× Rejection** bei TestFlight External Review, meist
für kleinere Formalien. Puffer für:

- Reject-Reason abarbeiten (Code-Fix oder Metadata-Fix)
- Neuen Build hochladen (buildNumber automatisch)
- Erneutes Review beantragen
- Rechts-Check-Ergebnisse einarbeiten wenn nötig

**Wenn keine Rejection kommt:** Puffer für Bug-Reports der Beta-Tester nutzen
oder für einen Follow-up beginnen.

---

## Follow-ups nach Store-Launch (nicht in diesem Plan)

- **Sentry / Error-Monitoring** — Preisrecherche EU-Region (Sentry SaaS EU vs. self-hosted). Owner: André. Anschließend: eigener Refactor-Zyklus.
- **`drinks.tsx` (1210 LOC) in Komponenten aufteilen** — Rangliste, Akkordeon-Item, Suchleiste als eigene Files.
- **Maestro in CI** — oder README-Klarstellung "lokal-only".
- **`app/`-Coverage über 61 %** — braucht WebView-/Multipart-Harness.
- **Analytics-freies Nutzer-Feedback** — z.B. rein clientseitige Rating-Prompt nach Wedding-Termin.
- **In-App-Updates** (Play Store) — Google's In-App-Update-API, damit Nutzer nicht zu alten Versionen zurückfallen.

---

## Wenn morgen weitergemacht wird

**Startpunkt:** Woche 1, Tag 1, **T1**.

Vorher noch: **E1–E7 klären** und in [`STORE_RELEASE.md`](STORE_RELEASE.md)
festhalten (die Datei entsteht in T15, für die Klärung reichen aber Notizen).
Ohne E1–E3 kann Woche 4 nicht starten; ohne E4–E6 kann Woche 2 nicht starten.

Alle 30 Tasks sind so geschnitten, dass jeder Task **einen einzelnen Commit
produziert** und ohne die anderen mergen kann. Wenn ein Task blockiert wird,
kann der nächste ohne Umbau vorgezogen werden — außer T22/T23 (die brauchen
die Assets aus T19/T20) und T27/T28 (die brauchen alles davor).
