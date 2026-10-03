/*
 * Push and notification-click handler for the checklist PWA.
 *
 * Notifications carry only the list name and task title, never a task
 * description, so nothing sensitive lands in a lock-screen preview.
 */

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = {}
  }

  const title = payload.title || 'Checklist'
  const options = {
    body: payload.body,
    // Collapses repeats for the same task instead of stacking notifications.
    tag: payload.tag || payload.taskId || 'checklist',
    renotify: true,
    data: { url: payload.url || '/' },
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const target = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus an existing tab on this origin rather than opening a duplicate.
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(target)
          return client.focus()
        }
      }

      return self.clients.openWindow(target)
    }),
  )
})