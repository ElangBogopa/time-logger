// Custom service worker additions for push notifications
// This file is imported by the main service worker

self.addEventListener('push', (event) => {
  if (!event.data) return

  try {
    const data = event.data.json()

    const options = {
      body: data.body,
      // These pointed at /icon-192.png, which has never existed.
      icon: data.icon || '/icons/icon-192x192.png',
      badge: data.badge || '/icons/icon-192x192.png',
      tag: data.tag || 'default',
      data: {
        url: data.url || '/',
      },
      vibrate: [100, 50, 100],
      requireInteraction: false,
    }

    event.waitUntil(
      self.registration.showNotification(data.title || 'Better', options)
    )
  } catch (error) {
    console.error('Push event error:', error)
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const url = event.notification.data?.url || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If app is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      // Otherwise open new window
      if (clients.openWindow) {
        return clients.openWindow(url)
      }
    })
  )
})
