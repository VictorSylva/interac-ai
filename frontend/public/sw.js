/* eslint-disable no-restricted-globals */

// Service Worker for InteracAI Push Notifications

self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    console.log('Push received:', data);

    const options = {
      body: data.body,
      icon: data.icon || '/logo192.png',
      badge: data.badge || '/logo192.png',
      data: {
        url: data.url || '/conversations'
      },
      vibrate: [100, 50, 100],
      actions: [
        { action: 'open', title: 'View Conversation' }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      const url = event.notification.data.url;
      
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
