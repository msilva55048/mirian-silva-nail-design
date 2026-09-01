self.addEventListener("push", (event) => {
    let payload = {};

    try {
        payload = event.data ? event.data.json() : {};
    } catch {
        payload = {title: "Mirian Silva Nail Design", body: event.data?.text() ?? "Novo evento de agendamento."};
    }

    const title = payload.title || "Mirian Silva Nail Design";
    const options = {
        body: payload.body || "Há uma atualização em seus agendamentos.",
        icon: "/icon-192.png",
        badge: "/favicon-32x32.png",
        tag: payload.eventId ? `appointment-event-${payload.eventId}` : undefined,
        renotify: false,
        data: {url: payload.url || "/admin", eventId: payload.eventId || null},
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const targetUrl = new URL(event.notification.data?.url || "/admin", self.location.origin).href;

    event.waitUntil((async () => {
        const windows = await self.clients.matchAll({type: "window", includeUncontrolled: true});
        const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);

        if (existing) {
            await existing.navigate(targetUrl);
            return existing.focus();
        }

        return self.clients.openWindow(targetUrl);
    })());
});
