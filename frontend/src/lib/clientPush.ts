import {supabase} from "./supabase";

export type ClientPushState = "loading" | "active" | "inactive";

const vapidPublicKey = import.meta.env.VITE_WEB_PUSH_VAPID_PUBLIC_KEY?.trim();

export function isIOSDevice() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function isStandaloneDisplay() {
    return window.matchMedia?.("(display-mode: standalone)").matches === true || (navigator as Navigator & {standalone?: boolean}).standalone === true;
}

function supported() {
    return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function decodeKey(value: string) {
    const padding = "=".repeat((4 - (value.length % 4)) % 4);
    const bytes = window.atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(bytes, (character) => character.charCodeAt(0));
}

async function registration() {
    return navigator.serviceWorker.register("/push-sw.js", {scope: "/"});
}

async function send(action: "subscribe" | "unsubscribe", subscription: PushSubscription) {
    const {error} = await supabase.functions.invoke("client-web-push", {
        body: {action, subscription: subscription.toJSON()},
    });
    if (error) throw error;
}

export async function isClientPushRegistered() {
    if (!supported()) return false;
    const subscription = await (await registration()).pushManager.getSubscription();
    if (!subscription) return false;
    const {data, error} = await supabase.functions.invoke("client-web-push", {body: {action: "status", subscription: subscription.toJSON()}});
    if (error) throw error;
    return data?.registered === true;
}

export async function getClientPushState(): Promise<ClientPushState> {
    if (!supported() || !vapidPublicKey) return "inactive";
    if (Notification.permission !== "granted") return "inactive";
    const subscription = await (await registration()).pushManager.getSubscription();
    return subscription ? "active" : "inactive";
}

export async function enableClientPush() {
    if (!supported() || !vapidPublicKey) throw new Error("Este navegador não oferece suporte a notificações Web Push.");
    if (await Notification.requestPermission() !== "granted") throw new Error("A permissão de notificações não foi concedida.");
    const reg = await registration();
    const current = await reg.pushManager.getSubscription();
    const subscription = current ?? await reg.pushManager.subscribe({userVisibleOnly: true, applicationServerKey: decodeKey(vapidPublicKey)});
    try { await send("subscribe", subscription); } catch (error) { if (!current) await subscription.unsubscribe(); throw error; }
}

export async function disableClientPush() {
    if (!supported()) return;
    const subscription = await (await registration()).pushManager.getSubscription();
    if (!subscription) return;
    await send("unsubscribe", subscription);
    await subscription.unsubscribe();
}
