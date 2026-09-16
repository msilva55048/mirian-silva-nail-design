import {supabase} from "./supabase";
import {hasWebPushConfiguration, isWebPushSupported, vapidPublicKey, webPushConfigurationError} from "./pushConfig";

export type AdminPushState = "loading" | "error" | "unsupported" | "configuration-error" | "disabled" | "enabled" | "blocked";

function urlBase64ToUint8Array(value: string) {
    const padding = "=".repeat((4 - (value.length % 4)) % 4);
    const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
    const bytes = window.atob(base64);
    return Uint8Array.from(bytes, (character) => character.charCodeAt(0));
}

async function getRegistration(createIfMissing = false) {
    let registration = await navigator.serviceWorker.getRegistration("/");
    if (!registration && createIfMissing) {
        registration = await navigator.serviceWorker.register("/push-sw.js", {scope: "/"});
    }
    if (!registration) return null;

    await navigator.serviceWorker.ready;
    const activeRegistration = await navigator.serviceWorker.getRegistration("/");
    if (!activeRegistration?.active) {
        throw new Error("O Service Worker de notificações ainda não está ativo.");
    }
    return activeRegistration;
}

async function sendSubscription(action: "subscribe" | "unsubscribe" | "status", subscription: PushSubscription) {
    const {data, error} = await supabase.functions.invoke("admin-web-push", {
        body: {action, subscription: subscription.toJSON()},
    });

    if (error) {
        const context = (error as {context?: unknown}).context;
        if (context instanceof Response) {
            const payload = await context.clone().json().catch(() => null) as {error?: unknown; message?: unknown} | null;
            const message = typeof payload?.error === "string"
                ? payload.error
                : typeof payload?.message === "string" ? payload.message : "";
            const safeMessage = message
                .replace(/[\r\n\t]+/g, " ")
                .replace(/Bearer\s+\S+/gi, "Bearer [redigido]")
                .replace(/https?:\/\/\S+/gi, "[URL redigida]")
                .slice(0, 180);
            throw new Error(`Falha ao consultar o backend Web Push (HTTP ${context.status})${safeMessage ? `: ${safeMessage}` : "."}`);
        }
        throw error;
    }
    return data;
}

async function isAdminSubscriptionRegistered(subscription: PushSubscription) {
    const data = await sendSubscription("status", subscription);
    return data?.registered === true;
}

export async function getAdminPushState(): Promise<AdminPushState> {
    if (!isWebPushSupported()) return "unsupported";
    if (!hasWebPushConfiguration()) return "configuration-error";
    if (Notification.permission === "denied") return "blocked";
    if (Notification.permission !== "granted") return "disabled";

    const registration = await getRegistration();
    if (!registration) return "disabled";
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return "disabled";
    return await isAdminSubscriptionRegistered(subscription) ? "enabled" : "disabled";
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

    const registration = await getRegistration(true);
    if (!registration) throw new Error("Não foi possível ativar o Service Worker de notificações.");
    const current = await registration.pushManager.getSubscription();
    const subscription = current ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey!),
    });

    try {
        await sendSubscription("subscribe", subscription);
        if (!await isAdminSubscriptionRegistered(subscription)) {
            throw new Error("O backend não confirmou a ativação das notificações ADM neste aparelho.");
        }
    } catch (error) {
        if (!current) await subscription.unsubscribe();
        throw error;
    }
}

export async function disableAdminPush() {
    if (!isWebPushSupported()) return;
    const registration = await getRegistration();
    if (!registration) return;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;
    await sendSubscription("unsubscribe", subscription);
    if (await isAdminSubscriptionRegistered(subscription)) {
        throw new Error("O backend ainda reconhece as notificações ADM como ativas.");
    }
}
