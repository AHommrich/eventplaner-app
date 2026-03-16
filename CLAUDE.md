# Hochzeits-App — André & Tabea Hommrich

React Native / Expo App für Hochzeitsgäste. Gäste erhalten eine Einladungskarte mit QR-Code — Scan = Login. Kein Passwort, kein Account.

## Kommunikation
- Immer auf **Deutsch** antworten
- Kurz und direkt, kein Blabla
- Offene Fragen **vor** der Implementierung auflisten
- Kein `git push` ohne explizite Aufforderung ("alles auf git" oder "push")

---

## Tech Stack

| | |
|---|---|
| Framework | Expo SDK 54 + Expo Router v6 (file-based routing) |
| Sprache | TypeScript |
| Styling | NativeWind v4 + Tailwind CSS v3 |
| HTTP | Axios mit Bearer-Interceptor (`lib/api.ts`) |
| Auth-Storage | expo-secure-store |
| Icons | @expo/vector-icons (Ionicons) |
| i18n | i18n-js + LanguageContext (`lib/LanguageContext.tsx`) |

## Wichtige Dependency-Versionen (Expo Go SDK 54 — NICHT ändern!)
```
react-native-screens: ~4.16.0
react-native-reanimated: ~4.1.1
react-native-gesture-handler: ~2.28.0
react-native-safe-area-context: ~5.6.0
```
Diese müssen exakt mit Expo Go's native modules übereinstimmen — sonst JSI-Crash.

## npm installs
Immer `--legacy-peer-deps` verwenden (React 19 peer dep conflicts).

## Node
Node 20 required — `nvm use` im Projektroot ausführen.

---

## Backend

| | |
|---|---|
| Framework | Laravel 12 + Sanctum |
| Staging | `https://beta.hommrich.app` ← immer gegen Staging entwickeln |
| Production | `https://hommrich.app` |
| Config | `constants/env.ts` → `API_BASE` |

Staging-Tokens funktionieren NICHT auf Production (separate Datenbanken).

### Test-Tokens (Staging)
- Familie Caspari (4 Gäste): `zkcZnmgxwH4Kmy27pTxjgNkbGvPvNIte`
- Solo-Gast: `GbuyIYNTncT9tflws9vFcezcuFUyQvOE`

### Implementierte API-Endpoints
| Endpoint | Methode | Zweck |
|---|---|---|
| `/api/auth/qr/{token}` | GET | QR-Login |
| `/api/auth/logout` | DELETE | Logout (Bearer) |
| `/api/photos` | GET | Fotos laden |
| `/api/photos` | POST | Foto hochladen (multipart/form-data) |
| `/api/guest/me` | GET | Eingeloggten Gast + Gruppe laden |
| `/api/event/info` | GET | Event-Infos + RSVP-Deadline |
| `/api/guest/rsvp` | POST | Eigene RSVP setzen `{ attending: bool }` |
| `/api/guest/{id}/rsvp` | POST | RSVP für Gruppenmitglied setzen |
| `/api/guest/rsvp/revoke` | POST | Rücknahme einer Absage beantragen |

### Geplante Endpoints (noch nicht gebaut)
- `GET /api/event/menu`
- `POST /api/guest/menu`

### Auth-Flow
1. QR scan → `GET /api/auth/qr/{token}`
2. Response: `{ type: 'solo'|'family', family_name, guests[] }`
3. Bottom-Sheet öffnet sich immer:
   - `guests.length === 1` (Solo): Sprachauswahl + "Weiter"-Button
   - `guests.length > 1` (Familie): Titel + Namensliste + Sprachauswahl unten
4. Session in SecureStore speichern → navigate to `/` (index entscheidet weiter)
5. `index.tsx` prüft `rsvp_status` via `GET /api/guest/me`:
   - `null` → `/rsvp` (Onboarding-RSVP)
   - `accepted_pending` / `accepted` → `/(tabs)/home`
   - declined/revocation → `/declined`
6. Tokens laufen nie ab (bis Logout)
7. Sprachauswahl wird in SecureStore unter `app_language` gespeichert (Standard: `de`)

---

## Projektstruktur

```
app/
  _layout.tsx          Root-Stack, LanguageProvider
  index.tsx            Welcome/Redirect — prüft Session + rsvp_status, leitet weiter
  scan.tsx             QR-Scanner + DEV-Token-Input
  rsvp.tsx             Onboarding-RSVP (direkt nach erstem Login, vor Tab-Nav)
  declined.tsx         Abgesagt-Screen (Rücknahme beantragen oder Logout)
  (tabs)/
    _layout.tsx        Bottom Tab Bar — blendet RSVP-Tab aus wenn accepted
    home.tsx           Begrüßungsscreen
    rsvp.tsx           RSVP-Tab (sichtbar nur bei accepted_pending)
    photos.tsx         Fotogalerie + Upload + Auto-Refresh (30s)
    settings.tsx       Logout + Sprachauswahl

lib/
  api.ts               Axios-Instanz, Bearer-Interceptor
  auth.ts              saveSession / getSession / clearSession
  guest.ts             fetchGuestMe / fetchEventInfo / postRsvp / postGroupRsvp / postRevoke + Typen
  i18n.ts              i18n-js Setup (de/en, Fallback: de)
  LanguageContext.tsx  useLanguage() Hook, Persistenz via SecureStore

locales/
  de.ts                Deutsche Übersetzungen
  en.ts                Englische Übersetzungen

constants/
  theme.ts             ALLE Design-Tokens (Farben, Spacing, Radius) — Single Source of Truth
  env.ts               API_BASE — hier auf Production umstellen wenn go-live

```

## Wichtige Patterns

**Übersetzungen** — immer `useLanguage()` Hook, nie hardcodierte Strings:
```tsx
const { t } = useLanguage();
<Text>{t('home.welcome', { name: 'André' })}</Text>
```

**API-Calls** — immer `lib/api.ts` importieren (Bearer wird automatisch angehängt):
```tsx
import api from '../../lib/api';
const res = await api.get('/api/...');
```

**RSVP-Logik** — Absagen immer mit `Alert.alert` Bestätigungsdialog absichern (eigene Absage = Zugriffsverlust, Gruppenabsage = Zugriffsverlust für das Mitglied). Translations: `rsvp.declineConfirmTitle/Own/Member/Button`.

**Design** — immer `constants/theme.ts` oder Tailwind-Klassen aus `tailwind.config.js`, nie hardcodierte Farben/Werte.

**NativeWind Setup** (nicht anfassen):
- `babel.config.js`: `jsxImportSource: 'nativewind'` — KEIN `nativewind/babel` Preset
- `metro.config.js`: `withNativeWind(config, { input: './global.css' })`

---

## Sprachen
- Standard: Deutsch
- Unterstützt: Deutsch + Englisch
- Umschaltbar: beim Login (Bottom-Sheet nach QR-Scan) + jederzeit in den Settings
- Gespeichert in SecureStore unter `app_language`
- Hook: `useLanguage()` → `{ t, language, setLanguage }`

## GitHub
`https://github.com/AHommrich/eventplaner-app.git`
