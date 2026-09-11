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
        const {data: subs} = await admin.from("client_push_subscriptions").select("id,endpoint,p256dh,auth_key").eq("client_id", appointment.client_id);
        const payload = JSON.stringify({title: "Lembrete de horario do seu agendamento com a Mirian", body: `Seu agendamento de ${appointment.service_name} é em aproximadamente 2 horas.`, url: `/client/reminder?appointment_id=${encodeURIComponent(appointment.id)}`});
        let failed = false;
        for (const sub of (subs || [])) try { await webpush.sendNotification({endpoint: sub.endpoint, keys: {p256dh: sub.p256dh, auth: sub.auth_key}}, payload, {TTL: 7200, urgency: "high"}); await admin.from("client_push_subscriptions").update({last_success_at: new Date().toISOString()}).eq("id", sub.id); sent++; } catch (e) { failed = true; const code = Number((e as {statusCode?: number}).statusCode || 0); if (code === 404 || code === 410) await admin.from("client_push_subscriptions").delete().eq("id", sub.id); }
        await admin.from("client_push_reminders").update({status: failed ? "failed" : "processed", attempts: 1, processed_at: failed ? null : new Date().toISOString()}).eq("id", claim.id);
    }
    return json({ok: true, sent}, 200, h);
}
async function mock(body: Record<string, unknown>, h: Record<string, string>) {
    const clientId = typeof body.client_id === "string" ? body.client_id : "";
    if (!clientId) return json({error: "Cliente ausente."}, 400, h);
    const {data: subs} = await admin.from("client_push_subscriptions").select("id,endpoint,p256dh,auth_key").eq("client_id", clientId).order("updated_at", {ascending: false}).limit(1);
    if (!subs?.length) return json({error: "Nenhuma subscription ativa para esta cliente."}, 404, h);
    const payload = JSON.stringify({title: "Lembrete de horario do seu agendamento com a Mirian", body: "Seu agendamento está confirmado para 25/12/2026 às 12:00.", url: "/client/reminder?mock=1"});
    try { await webpush.sendNotification({endpoint: subs[0].endpoint, keys: {p256dh: subs[0].p256dh, auth: subs[0].auth_key}}, payload, {TTL: 3600, urgency: "high"}); return json({ok: true, sent: 1}, 200, h); }
    catch (e) { return json({error: e instanceof Error ? e.message : String(e)}, 502, h); }
}
Deno.serve(async (req) => {
    const h = headers(req.headers.get("Origin")); if (req.method === "OPTIONS") return new Response("ok", {headers: h});
    if (req.method !== "POST") return json({error: "Método não permitido."}, 405, h);
    let body: Record<string, unknown>; try { body = await req.json(); } catch { return json({error: "JSON inválido."}, 400, h); }
    if (body.action === "dispatch" || body.action === "mock") { if (!schedulerSecret || req.headers.get("x-client-push-secret") !== schedulerSecret) return json({error: "Não autorizado."}, 403, h); return body.action === "mock" ? mock(body, h) : dispatch(h); }
    return manage(req, body, h);
});
