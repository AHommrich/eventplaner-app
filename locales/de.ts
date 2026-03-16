const de = {
  common: {
    error: "Fehler",
    cancel: "Abbrechen",
    accessDenied: "Zugriff verweigert",
    unknownError: "Unbekannter Fehler",
    refreshed: "Aktualisiert",
  },
  welcome: {
    subtitle: "Willkommen zu unserer Hochzeit",
    scanButton: "QR-Code scannen",
  },
  scan: {
    invalidQr: "Ungültiger QR-Code",
    invalidQrMessage: "Ungültiger QR-Code.",
    invalidTokenMessage: "Ungültiger Token.",
    cameraPermissionText: "Kamera-Zugriff benötigt um den QR-Code zu scannen.",
    allowAccess: "Zugriff erlauben",
    devLabel: "Dev: Token eingeben",
    devPlaceholder: "QR-Token...",
    devLogin: "Einloggen",
    devToggle: "DEV: Token manuell eingeben",
    continue: "Weiter",
    fromGallery: "Aus Galerie",
    noQrInImage: "Kein QR-Code im Bild gefunden.",
    familyTitle: "Familie %{name}",
    whoAreYou: "Wer bist du?",
    chooseName: "Bitte wähle deinen Namen aus.",
  },
  home: {
    welcome: "Willkommen, %{name}!",
    loggedIn: "Du bist eingeloggt.",
    countdownPrefix: "Noch",
    countdownDays: "T",
    countdownHours: "Std",
    countdownMinutes: "Min",
    countdownSeconds: "Sek",
    countdownToday: "Heute ist der große Tag! 🎉",
    countdownPast: "Es war ein wunderschöner Tag.",
  },
  settings: {
    loggedInAs: "Eingeloggt als",
    family: "Familie %{name}",
    logout: "Ausloggen",
    language: "Sprache",
    german: "Deutsch",
    english: "Englisch",
  },
  tabs: {
    home: "Home",
    photos: "Fotos",
    rsvp: "Zusage",
    settings: "Einstellungen",
  },
  rsvp: {
    title: "Bist du dabei?",
    subtitle: "Bitte antworte bis %{deadline}.",
    accept: "Zusagen",
    decline: "Absagen",
    statusAccepted: "Zugesagt",
    statusDeclined: "Abgesagt",
    groupTitle: "Deine Gruppe",
    groupSubtitle: "Du kannst für deine Gruppe antworten.",
    setByMe: "Von dir gesetzt",
    setBy: "Gesetzt von %{name}",
    setByOrganizer: "Vom Veranstalter gesetzt",
    saving: "Wird gespeichert…",
    deadlinePassed: "Die Anmeldefrist ist abgelaufen.",
    declineConfirmTitle: "Wirklich absagen?",
    declineConfirmOwn:
      "Wenn du absagst, verlierst du den Zugriff auf diese Veranstaltung. Du kannst danach nur noch eine Rücknahme beantragen.",
    declineConfirmMember:
      "Wenn du für %{name} absagst, hat %{name} keinen Zugriff mehr auf diese Veranstaltung.",
    declineConfirmButton: "Ja, absagen",
  },
  declined: {
    titlePending: "Du hast abgesagt.",
    titleFinal: "Deine Einladung wurde abgesagt.",
    subtitlePending:
      "Deine Absage wurde übermittelt und wartet auf Bestätigung. Falls du es dir anders überlegst, kannst du jetzt noch eine Rücknahme beantragen.",
    subtitleFinal:
      "Deine Absage wurde vom Veranstalter bestätigt. Eine Rücknahme ist nicht mehr möglich.",
    deadline: "Anmeldefrist: %{date}",
    revokeButton: "Rücknahme beantragen",
    revocationPending:
      "Deine Anfrage zur Rücknahme wird geprüft. Du wirst benachrichtigt sobald sie freigegeben wurde.",
    logout: "Ausloggen",
  },
  photos: {
    empty: "Noch keine Fotos",
    beFirst: "Sei der Erste!",
    addPhoto: "Foto hinzufügen",
    camera: "Kamera",
    fromLibrary: "Aus Bibliothek",
    libraryPermission:
      "Bitte erlaube den Zugriff auf deine Fotos in den Einstellungen.",
    cameraPermission:
      "Bitte erlaube den Zugriff auf die Kamera in den Einstellungen.",
  },
};

export default de;
