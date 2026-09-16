import {supabase} from "./supabase";
import {hasWebPushConfiguration, isWebPushSupported, vapidPublicKey, webPushConfigurationError} from "./pushConfig";

export type AdminPushState = "unsupported" | "configuration-error" | "disabled" | "enabled" | "blocked";

function urlBase64ToUint8Array(value: string) {
    const padding = "=".repeat((4 - (value.length % 4)) % 4);
    const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
    const bytes = window.atob(base64);
    return Uint8Array.from(bytes, (character) => character.charCodeAt(0));
}

async function getRegistration() {
    return navigator.serviceWorker.register("/push-sw.js", {scope: "/"});
}

async function sendSubscription(action: "subscribe" | "unsubscribe" | "status", subscription: PushSubscription) {
    const {data, error} = await supabase.functions.invoke("admin-web-push", {
        body: {action, subscription: subscription.toJSON()},
    });

    if (error) throw error;
    return data;
}

export async function getAdminPushState(): Promise<AdminPushState> {
    if (!isWebPushSupported()) return "unsupported";
    if (!hasWebPushConfiguration()) return "configuration-error";
    if (Notification.permission === "denied") return "blocked";
    if (Notification.permission !== "granted") return "disabled";

    const registration = await getRegistration();
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return "disabled";
    const data = await sendSubscription("status", subscription);
    return data?.registered === true ? "enabled" : "disabled";
}

export async function enableAdminPush() {
    if (!isWebPushSupported()) {
        throw new Error("Este navegador não oferece suporte a notificações Web Push.");
    }
    if (!hasWebPushConfiguration()) {
        throw new Error(webPushConfigurationError);
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
        throw new Error("A permissão de notificações não foi concedida.");
    }

    const registration = await getRegistration();
    const current = await registration.pushManager.getSubscription();
    const subscription = current ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey!),
    });

    try {
        await sendSubscription("subscribe", subscription);
    } catch (error) {
        if (!current) await subscription.unsubscribe();
        throw error;
    }
}

export async function disableAdminPush() {
    if (!isWebPushSupported()) return;
    const registration = await getRegistration();
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;
    await sendSubscription("unsubscribe", subscription);
}
