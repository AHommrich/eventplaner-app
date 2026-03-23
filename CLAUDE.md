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

### Test-Tokens (lokal — NICHT Staging)
- Familie Caspari (4 Gäste): `zkcZnmgxwH4Kmy27pTxjgNkbGvPvNIte`
- Solo-Gast: `GbuyIYNTncT9tflws9vFcezcuFUyQvOE`

### Implementierte API-Endpoints
| Endpoint | Methode | Zweck |
|---|---|---|
| `/api/auth/qr/{token}` | GET | QR-Login Schritt 1 |
| `/api/auth/qr/{token}/select` | POST | QR-Login Schritt 2 (Familie) `{ guest_id }` |
| `/api/auth/logout` | DELETE | Logout (Bearer) |
| `/api/photos` | GET | Fotos laden |
| `/api/photos` | POST | Foto hochladen (multipart/form-data) |
| `/api/guest/me` | GET | Eingeloggten Gast + Gruppe laden |
| `/api/event/info` | GET | Event-Infos + RSVP-Deadline + Theme-Farben |
| `/api/guest/rsvp` | POST | Eigene RSVP setzen `{ attending: bool }` |
| `/api/guest/{id}/rsvp` | POST | RSVP für Gruppenmitglied setzen |
| `/api/guest/rsvp/revoke` | POST | Rücknahme einer Absage beantragen |
| `/api/drinks` | GET | Getränkeliste laden |
| `/api/drinks/log` | POST | Getränk loggen `{ drink_id }` |
| `/api/drinks/stats` | GET | Getränke-Statistiken + Rangliste |

### Geplante Endpoints (noch nicht gebaut)
- `GET /api/event/menu`
- `POST /api/guest/menu`

### EventInfo-Felder (`GET /api/event/info`)
```typescript
name: string
date: string                    // ISO datetime
rsvp_deadline: string
cover_image_url: string | null
venue_name: string | null           // Anzeigename (z.B. "Dernbacher Grillhütte")
venue_address: string | null        // Adresse als Freitext
venue_lat: number | null            // exakte Koordinaten (pixelgenaue Navigation)
venue_lng: number | null
venue_display_mode: 'address' | 'name' | 'both'  // was auf Home anzeigen (default: 'both')
dresscode: string | null
schedule: string | null
// Farbpalette
color_primary / color_secondary / color_tertiary: string | null
// Aufgelöste Farbrollen
color_screen_bg / color_card / color_card_text / color_card_button /
color_card_button_text / color_tab_tint / color_border / color_fab /
color_fab_icon / color_home_text: string | null
color_home_shadow: string           // Hex, default '#000000'
home_shadow_opacity: number         // 0–100, default 50
drink_game_enabled: boolean
drink_game_end_time: string | null
font_heading: string | null
```

### Auth-Flow (zweistufig)
**Schritt 1** — QR scan → `GET /api/auth/qr/{token}`
- Response: `{ type: 'solo'|'family', family_name, guests[] }`
- Solo (`type: 'solo'`): `guests[0].token` ist gesetzt → direkt Session speichern, weiterleiten
- Familie (`type: 'family'`): alle `token`-Felder sind `null` → Namens-Picker anzeigen

**Schritt 2** — Nur Familie: Gast antippt → `POST /api/auth/qr/{token}/select` `{ guest_id }`
- `200` → `{ guest_id, firstname, lastname, token }` → Session speichern, weiterleiten
- `409` → Gast bereits eingeloggt → Alert + Eintrag als `is_active: true` markieren
- `is_active: true` → Eintrag grau + nicht antippbar

**Nach Login:** `index.tsx` prüft `rsvp_status` via `GET /api/guest/me`:
- `null` → `/rsvp` (Onboarding-RSVP)
- `accepted_pending` / `accepted` → `/(tabs)/home`
- declined/revocation → `/declined`

Tokens laufen nie ab (bis Logout). Sprachauswahl in SecureStore unter `app_language` (Standard: `de`).

---

## Projektstruktur

```
app/
  _layout.tsx          Root-Stack, LanguageProvider + EventThemeProvider + BlockedFeaturesProvider
  index.tsx            Welcome/Redirect — prüft Session + rsvp_status, leitet weiter; Galerie-QR-Login
  scan.tsx             QR-Scanner (Kamera) + DEV-Token-Input
  rsvp.tsx             Onboarding-RSVP (direkt nach erstem Login, vor Tab-Nav)
  declined.tsx         Abgesagt-Screen (Rücknahme beantragen oder Logout)
  blocked.tsx          App-Zugang gesperrt (app_blocked)
  (tabs)/
    _layout.tsx        Bottom Tab Bar — blendet RSVP-Tab aus wenn accepted, Drinks-Tab wenn deaktiviert
                       tabBarLabelStyle nutzt colors.fontFamily.regular wenn gesetzt
    home.tsx           Begrüßungsscreen mit Countdown + Cover-Bild + tippbare Venue-Navigation
    rsvp.tsx           RSVP-Tab (sichtbar nur bei accepted_pending)
    photos.tsx         Fotogalerie + Upload + Auto-Refresh (30s)
    drinks.tsx         Getränke-Log (Suche + Akkordeon) + Rangliste
    settings.tsx       Logout + Sprachauswahl

lib/
  api.ts               Axios-Instanz, Bearer-Interceptor; behandelt app_blocked (→ /blocked) + drinks_blocked
  auth.ts              saveSession / getSession / clearSession
  guest.ts             fetchGuestMe / fetchEventInfo / postRsvp / postGroupRsvp / postRevoke + Typen (EventInfo, GuestMe, GroupMember)
  i18n.ts              i18n-js Setup (de/en, Fallback: de)
  LanguageContext.tsx  useLanguage() Hook, Persistenz via SecureStore
  EventThemeContext.tsx useEventTheme() — Farben + EventInfo aus /api/event/info
  BlockedFeaturesContext.tsx useBlockedFeatures() — drinksBlocked State + Polling
  QrFromImage.tsx      WebView-basierter QR-Decoder für Galerie-Bilder
  useRefreshToast.ts   Hook: { refreshing, refreshed, onRefresh } — zentrales Pull-to-Refresh + Toast-Logik

components/
  ThemedText.tsx       Text-Wrapper — wendet fontFamily aus EventTheme an (bold/regular Variante)
  RefreshToast.tsx     Overlay-Toast nach Pull-to-Refresh ("✓ Aktualisiert")

locales/
  de.ts                Deutsche Übersetzungen
  en.ts                Englische Übersetzungen

constants/
  theme.ts             ALLE statischen Design-Tokens (Farben, Spacing, Radius) — Single Source of Truth
  env.ts               API_BASE — hier auf Production umstellen wenn go-live
  fonts.ts             FontKey-Typ + FONT_MAP (8 Google Fonts, lokal gebündelt via @expo-google-fonts)

```

---

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

**RSVP-Logik** — Absagen immer mit `Alert.alert` Bestätigungsdialog absichern. Translations: `rsvp.declineConfirmTitle/Own/Member/Button`.

**Design — zwei Ebenen:**
- `constants/theme.ts` → statische Tokens: Spacing, Radius, semantische Farben (error, sage, muted)
- `useEventTheme()` → dynamische Brand-Farben vom Backend, immer bevorzugen

**Farb-Regel:**
- Brand/Layout → `colors.*` aus `useEventTheme()` (dynamisch vom Backend)
- Semantisch (Fehler, Erfolg, deaktiviert) → `theme.colors.error / .sage / .muted` (statisch)
- NIE hardcodierte Hex-Werte in Screens

**Farbvariablen (EventThemeColors):**
| Variable | Verwendung |
|---|---|
| `colors.primary` | Hauptmarkenfarbe (Akzent) |
| `colors.secondary` | Hintergrundfarbe (Palette) |
| `colors.tertiary` | Kartenfarbe (Palette) |
| `colors.screenBg` | Screen-Hintergrund |
| `colors.card` | Card-Hintergrund |
| `colors.cardText` | Text auf Cards |
| `colors.cardButton` | Button-Hintergrund in Cards |
| `colors.cardButtonText` | Text auf Card-Buttons |
| `colors.border` | Card-Rahmen (`+ '33'`), Zeilen-Divider (`+ '30'`), Toggle-Border (`+ '55'`), Navbar-Top (`+ '33'`) |
| `colors.fab` | FAB-Button Hintergrund (photos.tsx) |
| `colors.fabIcon` | FAB-Icon Farbe (photos.tsx) |
| `colors.tabTint` | Navbar Icons + Labels |
| `colors.homeText` | Text auf Home-Cover (`null` wenn kein Cover/nicht gesetzt) |
| `colors.homeShadow` | Schattenfarbe auf Home-Cover (default `#000000`) |
| `colors.fontFamily` | `{ regular, bold }` — wird von ThemedText automatisch angewendet |

**Pull-to-Refresh** — einheitlich über alle Tabs:
```tsx
const { refreshing, refreshed, onRefresh } = useRefreshToast(async () => {
  await loadData();
  loadTheme(); // immer mitladen
});
// RefreshControl: tintColor={colors.tabTint} colors={[colors.tabTint]}
// <RefreshToast visible={refreshed} refreshing={refreshing} />
```

**Spinner beim Tab-Wechsel vermeiden** — Loading-Guard nur wenn noch keine Daten:
```tsx
if (loading && data.length === 0) return <ActivityIndicator ... />;  // drinks
if (loading && !guest) return <ActivityIndicator ... />;             // rsvp
```

**Segmented Control / Tab-Switcher** — gemeinsamer Pill mit `overflow: hidden`:
```tsx
<View style={{ flexDirection: 'row', borderRadius: ..., overflow: 'hidden', borderWidth: 1.5, borderColor: colors.cardText + '40' }}>
  <TouchableOpacity style={{ flex: 1, backgroundColor: active ? colors.cardButton : 'transparent', borderRightWidth: 1, borderRightColor: colors.cardText + '40' }}>
  <TouchableOpacity style={{ flex: 1, backgroundColor: active ? colors.cardButton : 'transparent' }}>
</View>
```

**Button-Disable-Pattern** — volle Farbe = Aktion verfügbar, 0.4 Opacity = bereits erledigt:
```tsx
<TouchableOpacity disabled={alreadyDone} style={{ backgroundColor: theme.colors.sage, opacity: alreadyDone ? 0.4 : 1 }}>
```

**Maps-Navigation** — `openInMaps(event, t)` in `home.tsx`:
- Lat/Lng vorhanden → pixelgenaue Koordinaten-URLs (höchste Priorität)
- Nur Adresse → Geocoding-Query
- iOS: Alert mit App-Auswahl (Karten / Google Maps), Google Maps Fallback auf Apple Maps
- `app.json` hat `LSApplicationQueriesSchemes: ['comgooglemaps']` für `canOpenURL`
- URL-Formate: Apple Maps `maps://?ll=lat,lng&q=label`, Google Maps `comgooglemaps://?q=lat,lng&zoom=16`, Android `geo:lat,lng?q=lat,lng(label)`
- `geo:lat,lng?q=adresse` NICHT verwenden — `q=adresse` überschreibt Koordinaten!

**Venue-Anzeige** (home.tsx) — gesteuert durch `venue_display_mode`:
- `'name'`: venue_name + Pin-Icon, tappbar (wenn Navigationsdaten vorhanden)
- `'address'`: Adresse + Pin-Icon, tappbar
- `'both'`: venue_name oben, darunter Adresse + Pin-Icon — ein gemeinsamer Button, ein Icon
- Kein Navigationsdaten → venue_name als plain Text, kein Icon
- Dresscode: Label "Dresscode:" + Zeilenumbruch + Wert, opacity 0.7

**Home-Screen Schatten** (Cover-Modus):
- Konfigurierbar via `color_home_shadow` + `home_shadow_opacity` (0–100)
- Kein LinearGradient — einfacher `View` mit `backgroundColor + opacity`
- Sitzt zwischen Cover-Bild und Text-Content (`pointerEvents="none"`)

**Fonts** — 8 Google Fonts lokal gebündelt (`@expo-google-fonts/*`), DSGVO-konform (kein CDN zur Laufzeit). Backend liefert `font_heading` Key, `ThemedText` wendet automatisch regular/bold Variante an. Tab-Bar Labels erhalten Font via `tabBarLabelStyle: { fontFamily: colors.fontFamily.regular }`.

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
