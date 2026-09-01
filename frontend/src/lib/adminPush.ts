import {supabase} from "./supabase";

export type AdminPushState = "unsupported" | "disabled" | "enabled" | "blocked";

const vapidPublicKey = import.meta.env.VITE_WEB_PUSH_VAPID_PUBLIC_KEY?.trim();

function urlBase64ToUint8Array(value: string) {
    const padding = "=".repeat((4 - (value.length % 4)) % 4);
    const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
    const bytes = window.atob(base64);
    return Uint8Array.from(bytes, (character) => character.charCodeAt(0));
}

function isPushSupported() {
    return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function getRegistration() {
    return navigator.serviceWorker.register("/push-sw.js", {scope: "/"});
}

async function sendSubscription(action: "subscribe" | "unsubscribe", subscription: PushSubscription) {
    const {error} = await supabase.functions.invoke("admin-web-push", {
        body: {action, subscription: subscription.toJSON()},
    });

    if (error) throw error;
}

export async function getAdminPushState(): Promise<AdminPushState> {
    if (!isPushSupported() || !vapidPublicKey) return "unsupported";
    if (Notification.permission === "denied") return "blocked";
    if (Notification.permission !== "granted") return "disabled";

    const registration = await getRegistration();
    const subscription = await registration.pushManager.getSubscription();
    return subscription ? "enabled" : "disabled";
}

export async function enableAdminPush() {
    if (!isPushSupported() || !vapidPublicKey) {
        throw new Error("Este navegador não oferece suporte a notificações Web Push.");
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
        throw new Error("A permissão de notificações não foi concedida.");
    }

    const registration = await getRegistration();
    const current = await registration.pushManager.getSubscription();
    const subscription = current ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });

    try {
        await sendSubscription("subscribe", subscription);
    } catch (error) {
        if (!current) await subscription.unsubscribe();
        throw error;
    }
}

export async function disableAdminPush() {
    if (!isPushSupported()) return;
    const registration = await getRegistration();
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;
    await sendSubscription("unsubscribe", subscription);
    await subscription.unsubscribe();
}
