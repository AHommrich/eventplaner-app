import type { PrivacyNotice } from '../lib/legal';

const FALLBACK_UPDATED_AT = '2026-07-09T00:00:00Z';

export const FALLBACK_PRIVACY_NOTICES: Record<string, PrivacyNotice> = {
  de: {
    locale: 'de',
    updated_at: FALLBACK_UPDATED_AT,
    sections: [
      {
        id: 'controller',
        heading: 'Verantwortlicher',
        body_markdown:
          'Verantwortlich fuer die Verarbeitung personenbezogener Daten in eveplan ist das Hochzeitspaar bzw. der in der Einladung genannte Veranstalter. Kontakt fuer Datenschutzanfragen: support@eveplan.de.',
      },
      {
        id: 'processed-data',
        heading: 'Welche Daten verarbeitet werden',
        body_markdown:
          'eveplan verarbeitet die Daten, die fuer die Hochzeitsbegleitung notwendig sind: Einladungs- und Sitzungsdaten aus dem QR-Code, Name und RSVP-Status, Gruppeninformationen bei Familiengaesten, hochgeladene Fotos, Foto-Spiel-Beitraege, freiwillige Getraenke-Logs, Einwilligungen, Support- und Loeschanfragen sowie technische Fehlerdiagnosen, sofern Sentry fuer den Build aktiviert ist.',
      },
      {
        id: 'purpose',
        heading: 'Zwecke und Rechtsgrundlagen',
        body_markdown:
          'Die Verarbeitung dient der Organisation und Durchfuehrung der Hochzeit: Einladung pruefen, RSVP verwalten, Ablauf anzeigen, Fotos teilen, Foto-Spiel ermoeglichen, Moderation und Loeschanfragen bearbeiten. Rechtsgrundlagen sind je nach Funktion Art. 6 Abs. 1 lit. a DSGVO (Einwilligung), lit. b DSGVO (Teilnahme-/Organisationsbezug) und lit. f DSGVO (sicherer Betrieb und Missbrauchsschutz).',
      },
      {
        id: 'device-storage',
        heading: 'Speicherung auf dem Geraet',
        body_markdown:
          'Die App speichert lokal nur notwendige Sitzungs-, Sprach-, Einwilligungs-, Loesch- und Legal-Cache-Daten im geschuetzten App-Speicher. Fotos, RSVP-Daten und Getraenke-Logs werden nicht dauerhaft als App-Datensatz auf dem Geraet gespeichert.',
      },
      {
        id: 'rights',
        heading: 'Betroffenenrechte',
        body_markdown:
          'Du kannst Auskunft, Berichtigung, Loeschung, Einschraenkung der Verarbeitung, Datenuebertragbarkeit und Widerspruch verlangen. Einwilligungen koennen in der App widerrufen werden. Eine Konto-Loeschung kann in den Einstellungen gestartet und innerhalb der angezeigten Frist widerrufen werden.',
      },
    ],
  },
  en: {
    locale: 'en',
    updated_at: FALLBACK_UPDATED_AT,
    sections: [
      {
        id: 'controller',
        heading: 'Controller',
        body_markdown:
          'The wedding couple or the event host named in the invitation is responsible for personal data processed in eveplan. Contact for privacy requests: support@eveplan.de.',
      },
      {
        id: 'processed-data',
        heading: 'Data processed',
        body_markdown:
          'eveplan processes the data needed to accompany the wedding: invitation and session data from the QR code, name and RSVP status, family/group information, uploaded photos, photo game submissions, optional drink logs, consents, support and erasure requests, and technical error diagnostics if Sentry is enabled for the build.',
      },
      {
        id: 'purpose',
        heading: 'Purposes and legal bases',
        body_markdown:
          'Processing is used to organize and run the wedding experience: validate invitations, manage RSVP, show the schedule, share photos, enable the photo game, handle moderation, and process erasure requests. Depending on the feature, the legal bases are Art. 6(1)(a) GDPR (consent), Art. 6(1)(b) GDPR (participation/organization), and Art. 6(1)(f) GDPR (secure operation and abuse prevention).',
      },
      {
        id: 'device-storage',
        heading: 'On-device storage',
        body_markdown:
          'The app stores only necessary session, language, consent, erasure, and legal-cache data in protected app storage. Photos, RSVP data, and drink logs are not stored permanently as app records on the device.',
      },
      {
        id: 'rights',
        heading: 'Your rights',
        body_markdown:
          'You can request access, correction, erasure, restriction of processing, data portability, and objection. Consents can be withdrawn in the app. Account erasure can be started in Settings and revoked within the period shown there.',
      },
    ],
  },
};

export const FALLBACK_IMPRINT_NOTICES: Record<string, PrivacyNotice> = {
  de: {
    locale: 'de',
    updated_at: FALLBACK_UPDATED_AT,
    sections: [
      {
        id: 'provider',
        heading: 'Anbieter',
        body_markdown:
          'eveplan ist die Hochzeitsbegleit-App fuer die in der Einladung genannte Veranstaltung. Die vollstaendigen Anbieterangaben werden ueber https://eveplan.de/impressum bereitgestellt.',
      },
      {
        id: 'contact',
        heading: 'Kontakt',
        body_markdown:
          'Kontakt fuer Support-, Datenschutz- und Moderationsanfragen: support@eveplan.de.',
      },
      {
        id: 'availability',
        heading: 'Offline-Hinweis',
        body_markdown:
          'Dieser statische Impressums-Fallback ist im App-Bundle enthalten, damit beim ersten Start ohne Netzverbindung kein leerer Rechtshinweis angezeigt wird. Sobald eine Verbindung besteht, laedt die App die aktuelle Fassung vom Backend.',
      },
    ],
  },
  en: {
    locale: 'en',
    updated_at: FALLBACK_UPDATED_AT,
    sections: [
      {
        id: 'provider',
        heading: 'Provider',
        body_markdown:
          'eveplan is the wedding companion app for the event named in the invitation. The full legal provider information is available at https://eveplan.de/impressum.',
      },
      {
        id: 'contact',
        heading: 'Contact',
        body_markdown: 'Contact for support, privacy, and moderation requests: support@eveplan.de.',
      },
      {
        id: 'availability',
        heading: 'Offline notice',
        body_markdown:
          'This static imprint fallback is bundled with the app so the legal notice is not blank on first launch without network access. Once a connection is available, the app loads the current version from the backend.',
      },
    ],
  },
};

export function getFallbackPrivacyNotice(locale: string): PrivacyNotice {
  return FALLBACK_PRIVACY_NOTICES[locale] ?? FALLBACK_PRIVACY_NOTICES.en;
}

export function getFallbackImprint(locale: string): PrivacyNotice {
  return FALLBACK_IMPRINT_NOTICES[locale] ?? FALLBACK_IMPRINT_NOTICES.en;
}
