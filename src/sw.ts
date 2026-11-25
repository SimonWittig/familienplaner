/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'

declare const self: ServiceWorkerGlobalScope

self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// Push vom Server (Supabase Edge Function "send-reminders")
self.addEventListener('push', (event) => {
  const data = (() => {
    try {
      return event.data?.json() as { title?: string; body?: string; url?: string; tag?: string }
    } catch {
      return { title: 'Familienplaner', body: event.data?.text() }
    }
  })()
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Familienplaner', {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag,
      data: { url: data.url ?? '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data as { url?: string })?.url ?? '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const open = wins.find((w) => 'focus' in w)
      if (open) {
        void open.navigate(url)
        return open.focus()
      }
      return self.clients.openWindow(url)
    }),
  )
})
