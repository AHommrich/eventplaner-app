# Store Release Readiness

> Status: Arbeitsdatei fuer Store-Metadaten und externe Entscheidungen.
> Entscheidungen aus `docs/POLISH_STORE_RELEASE_PLAN.md` E1-E7 werden hier
> dokumentiert, sobald sie final oder bewusst vorlaeufig sind.

## Accounts & Zugaenge

| Bereich | Status | Notizen |
| ------- | ------ | ------- |
| Apple Developer Program | offen | E1: Membership, Team-ID und App Store Connect Zugriff eintragen. |
| Google Play Console | offen | E2: Console-Zugriff und Zahlungsstatus eintragen. |
| App Store Connect Users | offen | Reviewer-/Admin-Zugaenge hier nicht als Passwort dokumentieren. |
| Play Console Users | offen | Rollen und Owner hier festhalten. |

## Bundle Identifier / Package Name

| Plattform | Wert | Status |
| --------- | ---- | ------ |
| iOS Bundle Identifier | `com.ahommrichsorganization.eveplan` | aus `app.json` uebernommen |
| Android Package Name | `com.ahommrichsorganization.eveplan` | aus `app.json` uebernommen |

## Support-Email + Marketing-URL

| Feld | Wert | Status |
| ---- | ---- | ------ |
| Support-Email | `support@eveplan.de` | vorlaeufige Annahme aus E3 |
| Security-Email | offen | klaeren, ob getrennt von Support-Mail |
| Marketing-URL | `https://eveplan.de` | vorlaeufige Annahme |

## Store IDs

| Feld | Wert | Status |
| ---- | ---- | ------ |
| App Store Connect App-ID | offen | Wird in Woche 4 eingetragen. |
| Google Play App-ID | offen | Wird in Woche 4 eingetragen. |

## Reviewer-Zugang

| Feld | Wert | Status |
| ---- | ---- | ------ |
| Reviewer Login Flow | offen | Apple/Google koennen keine echte Einladung scannen; Demo-Token-Flow vorbereiten. |
| Demo Guest | offen | Nur Beschreibung oder Token-Quelle dokumentieren, keine Secrets commiten. |
| Review Notes | offen | Spaeter mit Impressum/UGC/Privacy-Hinweisen fuellen. |

## Age Rating

| Feld | Wert | Status |
| ---- | ---- | ------ |
| Arbeitshypothese | 12+ / USK 12 | E7: konservativ wegen Drinks-Feature. |
| Begruendung | Kein Alkohol-Verkauf, keine Zahlungsfunktion, kein Konsumanreiz; Drinks sind Event-Logistik. | vorlaeufig |
| Finale Store-Antworten | offen | In T21 ausfuellen. |

## Frageboegen

### Apple App Privacy

| Kategorie | Antwort | Begruendung |
| --------- | ------- | ----------- |
| Data Used to Track You | None | Keine Tracking-SDKs, keine Werbung, keine Third-Party Analytics. |
| Contact Info / Name | Collected, linked to user | Vorname + Nachname werden fuer RSVP, Anzeige und Gruppenlogik genutzt. |
| User Content / Photos | Collected, linked to user | Foto-Galerie und Foto-Spiel-Uploads sind Gastinhalte. |
| Identifiers | Not collected for tracking | QR-/Session-Token bleibt Backend-auth, kein Werbe-Identifier. |
| Usage Data / Analytics | Not collected | Kein Analytics- oder Crash-Reporting-SDK im Runtime-Bundle. |

### Google Data Safety

| Frage | Antwort |
| ----- | ------- |
| Data collected | Name, photos/user content |
| Data shared with third parties | No |
| Data encrypted in transit | Yes, HTTPS |
| Data deletion request available | Yes, in-app Art. 17 erasure flow |
| User can delete uploaded content | Via erasure/support flow; per-photo moderation/delete flow depends on backend |
| Committed to Play Families Policy | n/a, not intended for children |

### Age Rating

- Apple: 12+ as conservative default because the app can contain a drinks
  feature / alcohol references.
- Google / PEGI: PEGI 12 as conservative equivalent.
- Germany / USK: USK 12 as conservative equivalent.
- If the drinks feature is disabled for store launch and no alcohol references
  are visible in screenshots/listing, the rating may be reducible. Keep E7
  open until the final store questionnaire is filled.

## Legal URLs

| Feld | Zielwert | Status |
| ---- | -------- | ------ |
| Datenschutz-URL | `https://eveplan.de/datenschutz` | E6: Backend-Task offen |
| Impressum-URL | `https://eveplan.de/impressum` | E4: Backend-Task offen; App-Screen vorbereitet |
| Kontakt/Support | offen | Haengt an E3. |

## Backend-Tickets

| Ticket | Minimaler Scope | Status |
| ------ | --------------- | ------ |
| Imprint | `GET /api/legal/imprint?locale=de\|en` + `https://eveplan.de/impressum` | Backend offen; App-Client vorbereitet |
| Privacy HTML | `https://eveplan.de/datenschutz` als browseroeffentliche HTML-Seite | offen |
| UGC Report | Foto/Inhalt melden, inklusive Grund und Guest-ID/Auth-Kontext | offen |
| UGC Block | Gast blockieren oder Inhalte des Gasts ausblenden | offen |
| UGC Contact | erreichbarer Supportkontakt fuer Moderationsfaelle | offen |

### Backend Contract Draft

#### Imprint

- `GET /api/legal/imprint?locale=de|en`
- Response-Shape analog zum bestehenden Privacy-JSON, damit der App-Client den
  gleichen Offline-Cache- und Render-Pfad verwenden kann.
- `GET https://eveplan.de/impressum`
- Browseroeffentliche HTML-Seite fuer Store-Formulare und Web-Fallback.

Mindestinhalt fuer DE:

- Anbietername
- ladungsfaehige Anschrift
- E-Mail
- Telefonnummer, falls fuer das finale Impressum vorgesehen
- Verantwortliche Person i.S.d. § 18 MStV nur falls inhaltlich noetig

#### Privacy HTML

- `GET https://eveplan.de/datenschutz`
- Browseroeffentliche HTML-Seite fuer Apple/Google Store-Formulare.
- Inhaltlich synchron zur App-Privacy: RSVP, Fotos, Foto-Spiel,
  Getraenke-Log, Kamera, Fotobibliothek, Consents, Data Export, Erasure.

#### UGC Moderation

Minimaler Scope fuer Apple Guideline 1.2:

- `POST /api/photos/:photoId/report`
- `POST /api/guests/:guestId/block`
- `DELETE /api/guests/:guestId/block`
- `GET /api/guests/blocked`

Report-Payload:

```json
{
  "reason": "inappropriate_content",
  "message": "optional free text"
}
```

Block-Verhalten:

- Blockierte Gaeste werden in Foto-Galerie und Foto-Spiel ausgeblendet.
- Eigene Inhalte bleiben fuer den eingeloggten Gast sichtbar.
- Backend erzwingt die Filterung serverseitig, App filtert nur zusaetzlich fuer
  UX.
- App zeigt einen Supportkontakt fuer Moderationsfaelle an.

### Apple Guideline 1.2 Compliance

Current status: backend + app UI still open.

Required before TestFlight External Review:

- Report content: guest can report a photo or other UGC from the app.
- Block user: guest can hide/block another guest's UGC.
- Moderation contact: support email is visible in the app/store listing.
- Review notes explain where report/block controls live.
- Backend stores reports and enforces block filtering server-side.

## Rechts-Check

Datum: offen

- [ ] Impressum vollstaendig
- [ ] Datenschutzerklaerung vollstaendig
- [ ] AVV mit Backend-Hoster geklaert
- [ ] AVV/Terms mit Expo/EAS geprueft
- [ ] Native Storage-Hinweise aus `docs/storage-keys.md` in Datenschutz uebernommen
- [ ] Nutzungsbedingungen entschieden

## Review History

Noch keine Store-Einreichung.
