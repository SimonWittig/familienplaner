import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { useFamily } from '../lib/family'
import { linkCalendar, linkStatus, listCalendars, reauthGoogle, syncNow, type GCalendar } from '../lib/google'

/** Abschnitt auf der Familien-Seite: Google-Familienkalender verbinden. */
export function GoogleCalendarSection() {
  const { familyId, me } = useFamily()
  const [status, setStatus] = useState<{ calendar_name: string; last_synced_at: string | null } | null>(null)
  const [cals, setCals] = useState<GCalendar[] | null | 'loading'>('loading')
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    void linkStatus().then(setStatus)
    void listCalendars().then(setCals)
  }, [])

  if (status) {
    return (
      <>
        <p>Verbunden mit <b>{status.calendar_name}</b>.</p>
        <p className="muted">Zuletzt synchronisiert: {status.last_synced_at ? format(parseISO(status.last_synced_at), 'd.M. HH:mm') : 'noch nie'}</p>
        <button className="btn" onClick={async () => { setMsg('Synchronisiere…'); try { await syncNow(); setMsg('Fertig.'); setStatus(await linkStatus()) } catch (e) { setMsg((e as Error).message) } }}>
          🔄 Jetzt synchronisieren
        </button>
        {msg && <p className="note">{msg}</p>}
      </>
    )
  }
  if (cals === 'loading') return <p className="muted">Lade…</p>
  if (!cals) {
    return (
      <>
        <p className="muted">Verbinde euren Google-Familienkalender, dann erscheinen alle Termine hier und neue Termine aus der App landen auch dort.</p>
        <button className="btn primary" onClick={reauthGoogle}>Google-Kalender verbinden</button>
      </>
    )
  }
  return (
    <>
      <p className="muted">Welcher Kalender ist euer Familienkalender?</p>
      <ul className="list">
        {cals.map((c) => (
          <li key={c.id} className="card" onClick={async () => {
            if (!familyId || !me) return
            setMsg('Verbinde…')
            try { await linkCalendar(familyId, me.id, c); setStatus(await linkStatus()); setMsg(null) } catch (e) { setMsg((e as Error).message) }
          }}>
            <div className="grow"><div className="title">{c.summary}</div>{c.primary && <div className="sub">Hauptkalender</div>}</div>
          </li>
        ))}
      </ul>
      {msg && <p className="note">{msg}</p>}
    </>
  )
}
