# Backend-driven theme engine

**One-liner:** One JSON response reshapes ten screens — colours,
typography, cover art, shadow opacity. The clients have zero hardcoded
brand values.

## The constraint

The client is a wedding-guest app but the code is a **couple-neutral
template**. The same TypeScript bundle needs to render André & Tabea's
wedding today and, in principle, someone else's wedding tomorrow. That
rules out the usual "define your brand palette in `theme.ts` and be done"
approach — the palette has to come from the backend at runtime.

At the same time the app cannot degrade if the backend returns nothing:
Expo Go is used in dev with a stub, guests occasionally launch it
offline, and a partial backend response must not crash the render.

## The layered design

Two independent surfaces:

1. **`constants/theme.ts`** — static tokens. Spacing scale, border radii,
   semantic colours (`error`, `sage`, `muted`) that are the same
   regardless of which wedding is running. Never changes at runtime.
2. **`useEventTheme()`** — dynamic Brand-Palette from
   `GET /api/event/info`. This is the surface every screen actually
   reads from.

The rule in [`CLAUDE.md`](../../CLAUDE.md) is explicit: brand and layout
colours come from `useEventTheme()`; semantic (error / success / muted)
comes from `constants/theme.ts`. Hardcoded hex values inside a screen
are a lint smell, not a coding style choice.

## What the backend actually sends

The `event_info` endpoint returns roughly two dozen colour roles. The
subset a screen actually touches is small — most screens use six or
seven — but the roles are named for their _purpose_ on screen, not for
their position in a palette. So the render code never has to translate
"the primary colour" into "the pill button background":

| Role                      | Purpose                                            |
| ------------------------- | -------------------------------------------------- |
| `screenBg`                | Screen backdrop                                    |
| `card`                    | Card / container fill                              |
| `cardText`                | Text painted on `card`                             |
| `cardButton`              | Button background inside a card                    |
| `cardButtonText`          | Text on that button                                |
| `tabTint`                 | Icon + label colour in the tab bar                 |
| `border`                  | Card outline, divider colour (with alpha suffixes) |
| `fab` / `fabIcon`         | Floating action button (only on photos.tsx)        |
| `homeText` / `homeShadow` | Home cover text + gradient behind it               |

The full role table lives in [`CLAUDE.md`](../../CLAUDE.md); the type
lives in [`lib/EventThemeContext.tsx`](../../lib/EventThemeContext.tsx).

Two roles get their own micro-DSL because they compose with alpha
channels:

```ts
borderColor: colors.border + '33',   // 20 % opacity
borderColor: colors.border + '30',   // divider between rows
borderColor: colors.border + '55',   // segmented-control edge
```

The alpha suffix is picked once per usage, not per screen — grep for
`'33'` in the tree and you'll see it consistently applied.

## The font pipeline

Typography follows the same pattern with an extra wrinkle: the backend
sends only a **key** (`font_heading = 'PlayfairDisplay'`), never a URL.
Client-side, [`constants/fonts.ts`](../../constants/fonts.ts) contains
the fixed map of keys → locally bundled `@expo-google-fonts/*` assets.
The [`ThemedText`](../../components/ThemedText.tsx) component then
transparently swaps the family based on the declared `fontWeight`:

```tsx
<ThemedText style={{ fontWeight: 'bold' }}>{title}</ThemedText>
// → renders with PlayfairDisplay-Bold if backend says so,
//   otherwise with the system bold.
```

Screens never touch `fontFamily` themselves. When the backend picks a
different heading font, every heading in the app changes without a
single line of screen code being edited.

The reason to gate this on a **key** rather than a URL is DSGVO:
Google-Fonts-over-CDN was ruled a data-protection incident by the LG
München in 2022. The client never contacts `fonts.gstatic.com`; the
backend only ever sends a string that the client resolves to a local
asset. See [`docs/showcase/dsgvo-first.md`](dsgvo-first.md) for the
broader "zero runtime CDN" posture.

## Loading & fallback semantics

The theme is fetched inside [`lib/EventThemeContext.tsx`](../../lib/EventThemeContext.tsx)
on app boot AND on every pull-to-refresh (via
[`lib/useRefreshToast.ts`](../../lib/useRefreshToast.ts)). The fallback
behaviour is deliberately loud in some places and quiet in others:

- A field the client uses defensively (`colors.homeText` when there is
  no cover image) is allowed to be `null`; the render just omits the
  text. No crash, no placeholder.
- A field the client _cannot_ work without (`colors.screenBg`) falls
  back to a hardcoded sensible default from `constants/theme.ts`. If
  the backend outage lasts an event, the screens still look coherent.

The trade-off is: any new colour role starts as "not required" on the
client — the backend can be extended without a client update. When a
role earns a proper spot in the design, the fallback is removed and it
becomes mandatory.

## Testing surface

The engine has one non-obvious property test in
[`tests/lib/EventThemeContext.test.tsx`](../../tests/lib/EventThemeContext.test.tsx):
consecutive theme fetches don't stack in memory, and a fetch that
returns a _subset_ of roles resets the rest to fallback. That behaviour
matters because the couple's colour picker in the admin surface can
clear a role individually — the client must not remember yesterday's
value for a role the backend now considers unset.

Everything else is exercised implicitly by the screen tests: they mount
under `EventThemeProvider` with a fixture palette and assert the
rendered role.

## Where to read next

- [`docs/ARCHITECTURE.md § 6 — Design system`](../ARCHITECTURE.md).
- The role table in [`CLAUDE.md`](../../CLAUDE.md) for the full
  variable-to-usage mapping.
- [`lib/EventThemeContext.tsx`](../../lib/EventThemeContext.tsx) for the
  actual fetch + fallback logic (< 200 lines including types).
