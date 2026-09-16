export const vapidPublicKey = import.meta.env.VITE_WEB_PUSH_VAPID_PUBLIC_KEY?.trim();

export function isWebPushSupported() {
    return window.isSecureContext && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function hasWebPushConfiguration() {
    return Boolean(vapidPublicKey);
}

export const webPushConfigurationError = "As notificações estão disponíveis neste navegador, mas a configuração Web Push ainda não foi publicada.";
