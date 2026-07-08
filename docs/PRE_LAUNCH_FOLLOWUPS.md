# Pre-Launch Follow-ups

Kompakter Aktionsplan bis zum Go-Live. Alles darunter ist noch **nicht**
erledigt und blockiert oder gefährdet den Wedding-Einsatz und/oder einen
Store-Release.

Verwandte Docs:
[`docs/POLISH_STORE_RELEASE_PLAN.md`](POLISH_STORE_RELEASE_PLAN.md),
[`docs/STORE_RELEASE.md`](STORE_RELEASE.md),
[`docs/RELEASE.md`](RELEASE.md).

---

## 1. Upload-Queue — persistente Offline-Warteschlange für alle Write-Aktionen

**Priorität: KRITISCH.** Ohne diese Schicht verliert der Gast bei kurzem
Netzverlust Fotos, Getränke-Logs und RSVP-Änderungen. Genau der Fall, den
eine Companion-App auf einer Hochzeitslocation abfangen muss. Ziel: der
Nutzer bekommt **keinerlei** Einschränkung, wenn das Netz kurz weg ist, und
die App bleibt stabil.

### Scope

Jede schreibende Aktion muss durch die Queue laufen. Konkret:

- `photo_upload` — multipart, kann groß werden, braucht Speicherplatz-Check
- `photo_game_submit` — analog
- `drink_log` — kleiner JSON-Body, hohes Volumen bei Partys
- `rsvp_own` und `rsvp_group` — semantisch besonders empfindlich, weil die
  Brautpaar-Ansicht davon abhängt
- `photo_report` und `hide_guest_content` — moderations-relevant
- Consent-Widerrufe an das Backend (falls Serverspiegelung eingeführt wird)

### Was gebaut werden muss

- **Persistente Queue** in `expo-secure-store` unter einem neuen Key-Prefix
  (`upload_queue_*`), damit die Warteschlange App-Kill und Reboot überlebt.
  - Neue Storage-Keys in [`docs/storage-keys.md`](storage-keys.md) ergänzen.
- **Job-Union** als getaggter Typ (`type: 'photo_upload' | 'drink_log' | ...`)
  in `lib/uploadQueue.ts`.
- **Worker-Loop** in einem neuen Provider `UploadQueueProvider`:
  - Beim App-Start und bei Reconnect (`NetInfo`) ausführen
  - Sequentiell pro Job-Typ, damit Reihenfolge stabil bleibt
  - Exponential Backoff (5 s → 15 s → 60 s → 5 min → aufgeben mit
    Nutzerhinweis)
  - Idempotenz: Server-seitig `Idempotency-Key` mitgeben, damit Doppel-Sends
    dedupliziert werden → **Backend-Ticket, muss vor Client-Rollout stehen**
- **Bild-Uploads**:
  - Vor dem Enqueue lokal in eine App-eigene Datei kopieren
    (`FileSystem.copyAsync`), damit der Nutzer das Original löschen kann,
    ohne dass die Queue bricht
  - Nach erfolgreichem Upload temporäre Datei wieder löschen
  - Speicher-Cap (z. B. max. 200 MB queue) + älteste zuerst löschen mit
    Nutzerhinweis, wenn erreicht
- **UI-Sichtbarkeit**:
  - Kleine Pill/Badge im Header, wenn Jobs pending sind
    ("2 Uploads in Warteschlange")
  - Fehler-Alert erst, wenn ein Job endgültig aufgegeben wird — nicht bei
    jedem Retry
  - Aufgegebene Jobs im Settings-Screen als „Fehlgeschlagene Uploads"
    manuell wieder aufnehmbar
- **Tests**:
  - `tests/lib/uploadQueue.test.ts` — Enqueue, Persist, Retry, Backoff,
    Idempotency-Key, Storage-Cap, aufgeben nach n Versuchen
  - Bestehende Screen-Tests (`photos.test.tsx`, `tabs-drinks.test.tsx`,
    `tabs-rsvp.test.tsx`) auf Queue-Aufruf umstellen
- **Doku**:
  - Abschnitt in [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) §8 (Networking)
  - Neue Storage-Keys in [`docs/storage-keys.md`](storage-keys.md)
  - `docs/dependencies.md` um `@react-native-community/netinfo` ergänzen

### Was NICHT im Scope ist

- Kein WebSocket-Push für Live-Sync — die vorhandenen Poll-Intervalle
  reichen
- Kein komplexes Konflikt-Merging — Server bleibt Source-of-Truth, der
  Client verliert bei Widerspruch (und meldet dem Nutzer)

### Abhängigkeit vom Backend

- Alle POST-Endpunkte müssen einen `Idempotency-Key`-Header akzeptieren und
  Duplikate zurückliefern statt neu anzulegen. **Ohne diese Backend-Änderung
  darf der Client-Rollout nicht passieren**, sonst produzieren wir bei
  Retries doppelte RSVPs / doppelte Drink-Logs.

---

## 2. EAS Update — OTA-Hotfixes ohne Store-Resubmit

**Priorität: HOCH.** Ohne OTA sind Bugfixes am Hochzeitstag nicht möglich —
genau der Kontext, in dem sie am dringendsten wären. Long-running
Store-Submits (24–72 h) sind für Hotfixes untauglich.

### Was gebaut werden muss

- `expo-updates` installieren (`npx expo install expo-updates`) — bündelt
  den nativen `EXUpdates`-Client mit
- `app.json`:
  - `runtimeVersion.policy: "appVersion"` — bindet OTA-Bundles an die
    installierte Store-Version, so dass ein neuer Native-Build automatisch
    einen neuen Update-Channel bekommt
  - `updates.url` mit der EAS-URL
- `eas.json`:
  - Neuer Channel `production` und optional `preview` für Test-Updates in
    EAS Preview
- **Update-Trigger** in `app/_layout.tsx`:
  - Beim App-Start `Updates.checkForUpdateAsync()` →
    `Updates.fetchUpdateAsync()` → `Updates.reloadAsync()`
  - Silent, kein UI-Blocker außer beim eigentlichen Reload
  - Auf Fehler schweigend fallen zurück auf das gebundelte JS
- **Skript** `npm run update:hotfix` als Convenience-Wrapper um
  `eas update --branch production --message "..."`
- **Doku**:
  - Neues Kapitel „Wann Store-Submit, wann OTA" in
    [`docs/RELEASE.md`](RELEASE.md)
  - Klare Faustregel: **Native-Änderungen (neue Permissions, neue Plugins,
    geänderte Bundle-ID, neue nativen Dependencies) IMMER Store-Build.
    Alles andere OTA.**
- **Grenzen dokumentieren**:
  - Kein OTA für Consent-Text-Änderungen oder neue Datenerhebung — solche
    Änderungen müssen im nächsten Store-Build sein (Apple/Google-Regel)
- **Rollback-Plan**:
  - `eas update:republish --branch production --group <previous>` als
    dokumentierter Command in `RELEASE.md`

### Abhängigkeit

- Sentry-Sourcemap-Upload für OTA-Bundles: `SENTRY_AUTH_TOKEN` muss als
  EAS-Secret gesetzt sein, sonst bekommen wir minifizierte Stack Traces bei
  einem Hotfix-Bug

---

## 3. Dependency-Audits — Vulnerabilities schließen und dauerhaft überwachen

**Priorität: HOCH.** Aktueller Stand: `npm audit --production` meldet
25 Findings (1 kritisch, 7 hoch, 16 moderat, 1 niedrig), überwiegend
transitiv in der Metro/Expo-CLI-Kette (`ws`, `yaml`, `@expo/config`).

### Einmalige Bereinigung

- `npm audit fix` in einem PR-Zweig testen; wo `--force` nötig wäre, statt
  dessen gezielte Expo-SDK-/Package-Bumps als eigene PRs
- Ergebnis + akzeptierte Rest-Risiken in einem neuen Abschnitt
  „Vulnerability-Status" in [`docs/dependencies.md`](dependencies.md)
  festhalten (Datum, Version, wer akzeptiert)

### Kontinuierliche Überwachung

- Neuer CI-Job `.github/workflows/audit.yml`:
  - `npm audit --production --audit-level=high` als Hard-Gate
  - Läuft bei Push + PR + weekly cron
  - Bricht ab bei neuen High/Critical
- `.github/dependabot.yml` (oder Renovate) für npm-Ecosystem:
  - Wöchentlich, gruppierte Expo-Bumps, gruppierte React-Native-Bumps,
    Rest einzeln
  - Auto-Merge nur für patch-Bumps in devDependencies

### Supply-Chain-Zusatz

- Der bestehende Regressions-Test
  [`tests/regressions/no-tracking.test.ts`](../tests/regressions/no-tracking.test.ts)
  läuft weiter — er ist unabhängig von `npm audit` und darf nicht
  aufgeweicht werden, wenn ein Bump neue transitive Deps mitbringt
- Bei jedem Bump manuell prüfen, ob `docs/dependencies.md` noch stimmt
  (Runtime-Deps + „phones home?"-Spalten)

### Doku

- README-Sektion „Security" um „wöchentliche Dependabot-Bumps + CI-Audit-Gate"
  ergänzen

---

## 4. Weiteres vor Live-Gang — nach Dringlichkeit

Alle Punkte darunter sind kleiner als die drei Kernpunkte, aber müssen
**vor** dem echten Hochzeitstag und/oder dem Store-Release erledigt sein.

### 4.1 Kritisch (Blocker für den Wedding-Live-Einsatz)

- [ ] **Fallback-Impressum + Fallback-Datenschutzerklärung statisch im
      Bundle** — für den Fall „erster Start ohne Netzverbindung". Aktuell
      wirft [`lib/legal.ts`](../lib/legal.ts) den Axios-Error weiter, wenn
      kein Cache existiert. Statischer Textinhalt in
      `constants/legal-fallback.ts` (de + en), in `app/legal/*.tsx` als
      letzter Fallback einbinden. Rechtlich für DE relevant.
- [ ] **Produktions-Sentry-DSN in EAS-Secrets** setzen
      (`EXPO_PUBLIC_SENTRY_DSN`, optional `SENTRY_AUTH_TOKEN` für
      Sourcemaps). Einmalige Verifikation über den vorhandenen
      `captureSentryTestError()`-Button im Settings-Screen.
- [ ] **End-to-End-Smoke auf echtem iOS- + Android-Gerät** gegen
      `https://eveplan.de`:
  - Solo-Login → RSVP → Home → Foto-Upload → Consent-Widerruf → Erasure
    → Recovery
  - Family-Login mit 4 Gästen (Caspari-Testfall lokal) → 409 auf zweitem
    Gerät verifizieren
  - Flugmodus mit gequeuten Uploads → Reconnect → Queue leert sich
- [ ] **Backend-Datenschutzerklärung + Impressum live verifiziert** unter
      `/api/legal/*` gegen `eveplan.de`. Muss dieselben Sections wie in
      `lib/legal.ts::PrivacySection` zurückliefern.
- [ ] **App-Icon + Splash + Adaptive-Icons final** auf allen Zielauflösungen
      pixelgenau am echten Device prüfen (Assets sind in `assets/`
      vorhanden).

### 4.2 Hoch (Store-Release-Blocker, nicht Wedding-Live-Blocker)

- [ ] **Store-Screenshots erstellen** — Pflicht für Store-Einreichung:
  - iPhone 6.7" (Pflicht), 6.5" (empfohlen), ggf. 5.5"
  - Android: mindestens Phone-Portrait in 2–3 Auflösungen; optional Tablet
  - Anonymisierte Test-Daten verwenden (Demo-Familie mit fiktiven Namen)
  - Motive: Welcome/Login → Home mit Cover → Foto-Gallerie → RSVP →
    Consent-Modal → Settings mit DSGVO-Reihen
- [ ] **Portfolio-Screenshots** in [`docs/screenshots/`](screenshots)
      einchecken (2–3 anonymisierte Stück), damit ein Reviewer/Bewerber-Blick
      auf das Repo sofort sieht, wie die App aussieht, ohne selbst starten
      zu müssen. Kann parallel zu den Store-Screenshots aus demselben
      Recording gewonnen werden.
- [ ] **Store-Metadaten aus [`docs/STORE_RELEASE.md`](STORE_RELEASE.md)
      schließen**: Apple-Developer- und Play-Console-Zugänge,
      App-Store-Connect-/Play-Console-App-IDs, Support-Mail
      `support@eveplan.de`, Marketing-URL, Age Rating final (12+ / USK 12).
- [ ] **Reviewer-Demo-Zugang**: Apple + Google können keinen echten QR
      scannen. Optionen:
  - DEV-Token-Input im TestFlight-/Play-Internal-Build unter einem
    Feature-Flag exponieren
  - Oder Demo-Gast im Backend anlegen und Token in den Review-Notes
    hinterlegen (nicht im Repo)
- [ ] **App Store Privacy + Google Data Safety-Formulare** ausgefüllt
      (Vorlagen sind in `docs/STORE_RELEASE.md` schon vorbereitet).
- [ ] **`ITSAppUsesNonExemptEncryption: false`** ist bereits in `app.json`
      gesetzt — final gegen die Apple-Encryption-Frage abgleichen und in
      Store-Notes dokumentieren.

### 4.3 Mittel (Companion-Qualität, kurz vor oder unmittelbar nach Live)

- [ ] **Push-Notifications-MVP** (Expo Push, ein Broadcast-Topic für alle
      akzeptierten Gäste). Backend-Endpunkt + Client-Registrierung +
      Consent-Key `push_notifications` als vierter `ConsentKey`.
- [ ] **Deep-Link-Handling** verifizieren: `eventplaner://` scheme
      funktioniert auf iOS + Android, Universal-Link-Fallback in `app.json`
      optional ergänzen.
- [ ] **Foto-Detail-Modal**: Pinch-to-Zoom auf Android auf realem Gerät
      testen (aktuell nur mit ScrollView-`maximumZoomScale`, was auf Android
      nicht immer greift).
- [ ] **Barrierefreiheits-Pass** durch alle Tab-Screens mit VoiceOver +
      TalkBack. Fehlende `accessibilityLabel` + `accessibilityRole`
      nachziehen.

### 4.4 Niedrig (nach Live-Gang okay)

- [ ] **Bundle-Diet**: Prüfen, ob die 10 Google-Fonts alle in den Store-Build
      müssen oder ob die Auswahl backend-seitig auf 3–4 „aktiv genutzt"
      eingeschränkt werden kann.
- [ ] **Screen-Coverage** von 60/48 auf ≥ 80 % — Upload-Harness für
      `photos.tsx` und `photo-game.tsx`.
- [ ] **Certificate-Pinning** für `beta.hommrich.app` + `eveplan.de`
      (Overkill für die Bedrohungslage, aber Portfolio-plus).

---

## Reihenfolge zum Abarbeiten

1. **Backend-Idempotenz für Uploads klären** (blockiert Punkt 1)
2. **Punkt 3** (Audit-Cleanup + CI-Gate) — kürzeste Zeit, sofortiger
   CI-Grün-Effekt
3. **Punkt 2** (EAS Update) — muss stehen, bevor der erste TestFlight-Build
   hochgeht, sonst fehlt der OTA-Rollback-Pfad
4. **Punkt 1** (Upload-Queue) — größter Change, eigener PR, mit Tests +
   Doku in einem Rutsch
5. **Section 4.1** als Live-Gang-Gate
6. **Section 4.2** als Store-Release-Gate (Screenshots + Reviewer-Zugang
   parallel starten, weil Screenshots aus dem echten Build kommen)
7. **Section 4.3 + 4.4** im Nachgang, teilweise als OTA-Hotfixes möglich
