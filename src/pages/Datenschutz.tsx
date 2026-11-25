export default function Datenschutz() {
  return (
    <div className="page">
      <h1>Datenschutz</h1>
      <p>Der Familienplaner ist eine private App für eine einzelne Familie. Es gibt keine Werbung und kein Tracking, und es werden keine Daten an Dritte verkauft oder weitergegeben.</p>
      <h2 className="section">Welche Daten</h2>
      <p>Name und E-Mail-Adresse aus dem Google-Konto (für die Anmeldung), die eingetragenen Termine, Hausübungen, Schularbeiten und ToDos sowie die Push-Adresse des Geräts für Erinnerungen.</p>
      <h2 className="section">Google-Kalender</h2>
      <p>Wenn ein Familienmitglied den Google-Kalender verbindet, liest und schreibt die App ausschließlich Termine des ausgewählten Familienkalenders, um sie mit der App abzugleichen. Andere Google-Daten werden nicht verwendet. Die Verbindung kann jederzeit unter myaccount.google.com/permissions widerrufen werden.</p>
      <h2 className="section">Speicherort</h2>
      <p>Die Daten liegen bei Supabase in einem Rechenzentrum in der EU. Jede Familie sieht nur ihre eigenen Daten.</p>
      <h2 className="section">Löschen</h2>
      <p>Auf Wunsch werden alle Daten gelöscht. Kontakt: Simon Wittig.</p>
      <p><a href="/">Zurück zur App</a></p>
    </div>
  )
}
