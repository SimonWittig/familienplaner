import { supabase } from './supabase'

const VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

/** iPhone: Push geht nur, wenn die App über "Zum Home-Bildschirm" installiert wurde. */
export const isIosNotInstalled = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) &&
  !(window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone)

function b64ToUint8(base64: string) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

/** Fragt die Erlaubnis an und registriert das Gerät für Push-Nachrichten. */
export async function enablePush(memberId: string): Promise<string> {
  if (!pushSupported()) return 'Dieses Gerät bzw. dieser Browser unterstützt keine Push-Nachrichten.'
  if (isIosNotInstalled()) return 'Am iPhone bitte zuerst über Teilen → „Zum Home-Bildschirm“ installieren und die App von dort öffnen.'
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return 'Benachrichtigungen wurden nicht erlaubt.'
  const reg = await navigator.serviceWorker.ready
  if (!supabase || !VAPID) {
    await reg.showNotification('Familienplaner', { body: 'Erinnerungen sind aktiv (solange die App geöffnet ist).' })
    return 'Demo-Modus: Erinnerungen kommen, solange die App offen ist. Für echte Push-Nachrichten Supabase einrichten.'
  }
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(VAPID) })
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({ member_id: memberId, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth }, { onConflict: 'endpoint' })
  if (error) return 'Fehler beim Speichern: ' + error.message
  return 'Push-Benachrichtigungen sind auf diesem Gerät aktiv.'
}

/** Lokale Erinnerung, solange die App offen ist (ergänzt den Server-Push, z. B. im Demo-Modus). */
const shown = new Set<string>()
export async function localNotify(key: string, title: string, body: string) {
  if (shown.has(key) || !('Notification' in window) || Notification.permission !== 'granted') return
  if (localStorage.getItem('familienplaner:notified:' + key)) return
  shown.add(key)
  localStorage.setItem('familienplaner:notified:' + key, '1')
  const reg = await navigator.serviceWorker?.ready
  if (reg) await reg.showNotification(title, { body, tag: key, icon: '/icon-192.png' })
  else new Notification(title, { body })
}
