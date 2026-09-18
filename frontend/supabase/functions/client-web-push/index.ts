import {createClient} from "npm:@supabase/supabase-js@2.57.4";
import webpush from "npm:web-push@3.6.7";

type Subscription = {endpoint?: string; keys?: {p256dh?: string; auth?: string}};
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const vapidPublicKey = Deno.env.get("WEB_PUSH_VAPID_PUBLIC_KEY")!;
const vapidPrivateKey = Deno.env.get("WEB_PUSH_VAPID_PRIVATE_KEY")!;
const vapidSubject = Deno.env.get("WEB_PUSH_VAPID_SUBJECT") || "mailto:mirian201420@gmail.com";
const schedulerSecret = Deno.env.get("CLIENT_PUSH_REMINDERS_SECRET") || "";
const siteOrigin = (Deno.env.get("SITE_ORIGIN") || "https://agendamentosmiriansilva.com.br").replace(/\/$/, "");
const admin = createClient(supabaseUrl, serviceRoleKey, {auth: {persistSession: false, autoRefreshToken: false}});
webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

function headers(origin: string | null) {
    return {"Access-Control-Allow-Origin": origin === siteOrigin ? origin : siteOrigin, "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-client-push-secret", "Access-Control-Allow-Methods": "POST, OPTIONS", Vary: "Origin"};
}
function json(body: unknown, status: number, h: Record<string, string>) { return new Response(JSON.stringify(body), {status, headers: {...h, "Content-Type": "application/json"}}); }
async function userFromRequest(req: Request) {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return null;
    const {data: {user}} = await admin.auth.getUser(token);
    return user || null;
}
async function clientForUser(userId: string) {
    const {data} = await admin.from("client_profiles").select("id").eq("user_id", userId).maybeSingle();
    return data?.id as string | undefined;
}
async function manage(req: Request, body: Record<string, unknown>, h: Record<string, string>) {
    const user = await userFromRequest(req); if (!user) return json({error: "Sessão inválida."}, 401, h);
    const clientId = await clientForUser(user.id); if (!clientId) return json({error: "Perfil de cliente não encontrado."}, 403, h);
    const sub = (body.subscription || {}) as Subscription; const endpoint = sub.endpoint?.trim();
    if (!endpoint) return json({error: "Subscription inválida."}, 400, h);
    if (body.action === "status") {
        const {data} = await admin.from("client_push_subscriptions").select("id").eq("endpoint", endpoint).eq("client_id", clientId).maybeSingle();
        return json({registered: Boolean(data)}, 200, h);
    }
    if (body.action === "unsubscribe") {
        const {error} = await admin.from("client_push_subscriptions").delete().eq("endpoint", endpoint).eq("client_id", clientId);
        return error ? json({error: error.message}, 500, h) : json({ok: true}, 200, h);
    }
    if (body.action !== "subscribe" || !sub.keys?.p256dh || !sub.keys?.auth) return json({error: "Ação ou chaves inválidas."}, 400, h);
    const {error} = await admin.from("client_push_subscriptions").upsert({client_id: clientId, user_id: user.id, endpoint, p256dh: sub.keys.p256dh, auth_key: sub.keys.auth, user_agent: req.headers.get("User-Agent"), updated_at: new Date().toISOString()}, {onConflict: "endpoint"});
    return error ? json({error: error.message}, 500, h) : json({ok: true}, 200, h);
}
async function dispatch(h: Record<string, string>) {
    const now = Date.now(); const from = new Date(now + (115 * 60 * 1000)).toISOString(); const to = new Date(now + (125 * 60 * 1000)).toISOString();
    const {data: appointments, error} = await admin.rpc("get_client_push_due_appointments", {p_from: from, p_to: to});
    if (error) return json({error: error.message}, 500, h);
    let sent = 0;
    for (const appointment of (appointments || [])) {
        const {data: claim} = await admin.from("client_push_reminders").upsert({appointment_id: appointment.id, client_id: appointment.client_id}, {onConflict: "appointment_id,reminder_type", ignoreDuplicates: true}).select("id,status").maybeSingle();
        if (!claim || claim.status === "processed") continue;
        await admin.rpc("create_client_notification", {p_client_id: appointment.client_id, p_type: "appointment-reminder", p_title: "Lembrete do seu agendamento", p_message: `Seu agendamento de ${appointment.service_name} é em aproximadamente 2 horas.`, p_data: {appointment_id: appointment.id}, p_entity_type: "appointment", p_entity_id: appointment.id, p_dedupe_key: `appointment-reminder:${appointment.id}`});
        const {data: subs} = await admin.from("client_push_subscriptions").select("id,endpoint,p256dh,auth_key").eq("client_id", appointment.client_id);
        const payload = JSON.stringify({title: "Lembrete de horario do seu agendamento com a Mirian", body: `Seu agendamento de ${appointment.service_name} é em aproximadamente 2 horas.`, url: `/client/reminder?appointment_id=${encodeURIComponent(appointment.id)}`});
        let failed = false;
        for (const sub of (subs || [])) try { await webpush.sendNotification({endpoint: sub.endpoint, keys: {p256dh: sub.p256dh, auth: sub.auth_key}}, payload, {TTL: 7200, urgency: "high"}); await admin.from("client_push_subscriptions").update({last_success_at: new Date().toISOString()}).eq("id", sub.id); sent++; } catch (e) { failed = true; const code = Number((e as {statusCode?: number}).statusCode || 0); if (code === 404 || code === 410) await admin.from("client_push_subscriptions").delete().eq("id", sub.id); }
        await admin.from("client_push_reminders").update({status: failed ? "failed" : "processed", attempts: 1, processed_at: failed ? null : new Date().toISOString()}).eq("id", claim.id);
    }
    return json({ok: true, sent}, 200, h);
}
async function dispatchMaintenance(h: Record<string, string>) {
    const {data: reminders, error} = await admin.rpc("dispatch_client_maintenance_reminders", {p_now: new Date().toISOString()});
    if (error) return json({error: error.message}, 500, h);
    let sent = 0;
    for (const reminder of (reminders || [])) {
        const {data: subs} = await admin.from("client_push_subscriptions").select("id,endpoint,p256dh,auth_key").eq("client_id", reminder.client_id);
        const payload = JSON.stringify({title: "LEMBRETE", body: reminder.message, url: "/client"});
        for (const sub of (subs || [])) try { await webpush.sendNotification({endpoint: sub.endpoint, keys: {p256dh: sub.p256dh, auth: sub.auth_key}}, payload, {TTL: 86400, urgency: "normal"}); await admin.from("client_push_subscriptions").update({last_success_at: new Date().toISOString()}).eq("id", sub.id); sent++; } catch (e) { const code = Number((e as {statusCode?: number}).statusCode || 0); if (code === 404 || code === 410) await admin.from("client_push_subscriptions").delete().eq("id", sub.id); }
    }
    return json({ok: true, created: (reminders || []).length, sent}, 200, h);
}
async function dispatchNotificationPushes(h: Record<string, string>) {
    const {data: rows, error} = await admin.from("client_notification_push_dispatches").select("id, notification_id, subscription_id, client_id, attempts, client_notifications(title, message, type, entity_id, data), client_push_subscriptions(endpoint, p256dh, auth_key)").eq("status", "pending").order("created_at", {ascending: true}).limit(100);
    if (error) return json({error: error.message}, 500, h);
    let sent = 0;
    for (const row of (rows || [])) {
        const notification = row.client_notifications as {title?: string; message?: string; type?: string; entity_id?: string; data?: Record<string, unknown>} | null;
        const sub = row.client_push_subscriptions as {endpoint?: string; p256dh?: string; auth_key?: string} | null;
        if (!notification || !sub?.endpoint || !sub.p256dh || !sub.auth_key) continue;
        const claimed = await admin.from("client_notification_push_dispatches").update({status: "processing", attempts: (row.attempts || 0) + 1}).eq("id", row.id).eq("status", "pending").select("id").maybeSingle();
        if (!claimed.data) continue;
        const type = notification.type || "notification";
        const data = notification.data || {};
        const url = type === "maintenance_booking_reminder" ? "/client" : type === "waitlist-opportunity" ? `/client?opportunity=${encodeURIComponent(String(data.opportunity_id || notification.entity_id || ""))}` : type.startsWith("referral-") ? "/client?section=referral" : `/client?section=appointments${notification.entity_id ? `&appointment_id=${encodeURIComponent(notification.entity_id)}` : ""}`;
        const payload = JSON.stringify({title: notification.title, body: notification.message, type, client_notification_id: row.notification_id, entity_id: notification.entity_id || null, url});
        try {
            await webpush.sendNotification({endpoint: sub.endpoint, keys: {p256dh: sub.p256dh, auth: sub.auth_key}}, payload, {TTL: 86400, urgency: "normal"});
            await admin.from("client_notification_push_dispatches").update({status: "sent", sent_at: new Date().toISOString(), last_error: null}).eq("id", row.id).eq("status", "processing");
            await admin.from("client_push_subscriptions").update({last_success_at: new Date().toISOString()}).eq("id", row.subscription_id);
            sent++;
        } catch (e) {
            const code = Number((e as {statusCode?: number}).statusCode || 0);
            if (code === 404 || code === 410) await admin.from("client_push_subscriptions").delete().eq("id", row.subscription_id);
            await admin.from("client_notification_push_dispatches").update({status: "failed", last_error: code ? `push_status_${code}` : "push_failed"}).eq("id", row.id).eq("status", "processing");
        }
    }
    return json({ok: true, sent, attempted: (rows || []).length}, 200, h);
}
async function mock(body: Record<string, unknown>, h: Record<string, string>) {
    const clientId = typeof body.client_id === "string" ? body.client_id : "";
    if (!clientId) return json({error: "Cliente ausente."}, 400, h);
    const {data: subs} = await admin.from("client_push_subscriptions").select("id,endpoint,p256dh,auth_key").eq("client_id", clientId).order("updated_at", {ascending: false}).limit(1);
    if (!subs?.length) return json({error: "Nenhuma subscription ativa para esta cliente."}, 404, h);
    const payload = JSON.stringify({title: "Lembrete de horario do seu agendamento com a Mirian", body: "Toque para ver os detalhes do seu agendamento.", url: "/client/reminder?mock=1"});
    try { await webpush.sendNotification({endpoint: subs[0].endpoint, keys: {p256dh: subs[0].p256dh, auth: subs[0].auth_key}}, payload, {TTL: 3600, urgency: "high"}); return json({ok: true, sent: 1}, 200, h); }
    catch (e) { return json({error: e instanceof Error ? e.message : String(e)}, 502, h); }
}
Deno.serve(async (req) => {
    const h = headers(req.headers.get("Origin")); if (req.method === "OPTIONS") return new Response("ok", {headers: h});
    if (req.method !== "POST") return json({error: "Método não permitido."}, 405, h);
    let body: Record<string, unknown>; try { body = await req.json(); } catch { return json({error: "JSON inválido."}, 400, h); }
    if (body.action === "dispatch" || body.action === "maintenance-dispatch" || body.action === "notification-dispatch" || body.action === "mock") { if (!schedulerSecret || req.headers.get("x-client-push-secret") !== schedulerSecret) return json({error: "Não autorizado."}, 403, h); if (body.action === "mock") return mock(body, h); if (body.action === "maintenance-dispatch") return dispatchMaintenance(h); if (body.action === "notification-dispatch") return dispatchNotificationPushes(h); return dispatch(h); }
    return manage(req, body, h);
});
