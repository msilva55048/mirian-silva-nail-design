import {createClient} from "npm:@supabase/supabase-js@2.57.4";
import webpush from "npm:web-push@3.6.7";

type PushSubscriptionInput = {
    endpoint?: string;
    keys?: {p256dh?: string; auth?: string};
};

type PushEvent = {
    id: string;
    event_type: "created" | "rescheduled" | "cancelled" | "client_registered";
    client_name: string;
    service_name: string;
    old_date: string | null;
    old_time: string | null;
    new_date: string | null;
    new_time: string | null;
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const vapidPublicKey = Deno.env.get("WEB_PUSH_VAPID_PUBLIC_KEY")!;
const vapidPrivateKey = Deno.env.get("WEB_PUSH_VAPID_PRIVATE_KEY")!;
const vapidSubject = Deno.env.get("WEB_PUSH_VAPID_SUBJECT") || "mailto:mirian201420@gmail.com";
const webhookSecret = Deno.env.get("PUSH_WEBHOOK_SECRET")!;
const siteOrigin = (Deno.env.get("SITE_ORIGIN") || "https://agendamentosmiriansilva.com.br").replace(/\/$/, "");

const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {persistSession: false, autoRefreshToken: false},
});

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

function corsHeaders(origin: string | null) {
    const allowedOrigin = origin === siteOrigin ? origin : siteOrigin;
    return {
        "Access-Control-Allow-Origin": allowedOrigin,
        "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-push-webhook-secret",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Vary": "Origin",
    };
}

function json(body: unknown, status: number, headers: Record<string, string>) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {...headers, "Content-Type": "application/json"},
    });
}

function shortTime(value: string | null) {
    return value ? value.slice(0, 5) : "";
}

function brazilianDate(value: string | null) {
    if (!value) return "";
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
}

function notificationFor(event: PushEvent) {
    if (event.event_type === "client_registered") {
        return {
            title: "Nova cliente cadastrada",
            body: `${event.client_name} acabou de se cadastrar.`,
        };
    }

    if (event.event_type === "created") {
        return {
            title: "Novo agendamento",
            body: `${event.client_name} agendou ${event.service_name} para ${brazilianDate(event.new_date)} às ${shortTime(event.new_time)}.`,
        };
    }

    if (event.event_type === "rescheduled") {
        return {
            title: "Agendamento alterado",
            body: `${event.client_name} alterou o agendamento de ${brazilianDate(event.old_date)} às ${shortTime(event.old_time)} para ${brazilianDate(event.new_date)} às ${shortTime(event.new_time)}.`,
        };
    }

    return {
        title: "Agendamento cancelado",
        body: `${event.client_name} cancelou o agendamento de ${brazilianDate(event.old_date)} às ${shortTime(event.old_time)}.`,
    };
}

async function authenticatedAdmin(req: Request) {
    const authorization = req.headers.get("Authorization") || "";
    const token = authorization.replace(/^Bearer\s+/i, "");
    if (!token) return null;

    const {data: {user}, error} = await admin.auth.getUser(token);
    if (error || !user) return null;

    const {data: config} = await admin
        .from("push_admin_config")
        .select("admin_user_id")
        .eq("singleton", true)
        .maybeSingle();

    return config?.admin_user_id === user.id ? user : null;
}

async function manageSubscription(req: Request, body: Record<string, unknown>, headers: Record<string, string>) {
    const user = await authenticatedAdmin(req);
    if (!user) return json({error: "Acesso restrito ao Admin."}, 403, headers);

    const subscription = (body.subscription || {}) as PushSubscriptionInput;
    const endpoint = subscription.endpoint?.trim();
    if (!endpoint) return json({error: "Subscription inválida."}, 400, headers);

    if (body.action === "unsubscribe") {
        const {error} = await admin.from("admin_push_subscriptions").delete().eq("endpoint", endpoint).eq("admin_user_id", user.id);
        return error ? json({error: error.message}, 500, headers) : json({ok: true}, 200, headers);
    }

    if (body.action !== "subscribe" || !subscription.keys?.p256dh || !subscription.keys?.auth) {
        return json({error: "Ação ou chaves da subscription inválidas."}, 400, headers);
    }

    const {error} = await admin.from("admin_push_subscriptions").upsert({
        admin_user_id: user.id,
        endpoint,
        p256dh: subscription.keys.p256dh,
        auth_key: subscription.keys.auth,
        user_agent: req.headers.get("User-Agent"),
        updated_at: new Date().toISOString(),
    }, {onConflict: "endpoint"});

    return error ? json({error: error.message}, 500, headers) : json({ok: true}, 200, headers);
}

async function deliverWebhook(body: Record<string, unknown>, headers: Record<string, string>) {
    const record = (body.record || body) as {id?: string};
    if (!record.id) return json({error: "Evento ausente."}, 400, headers);

    const {data: event, error: claimError} = await admin
        .from("appointment_push_events")
        .update({status: "processing", attempts: 1, last_error: null})
        .eq("id", record.id)
        .eq("status", "pending")
        .select("id, event_type, client_name, service_name, old_date, old_time, new_date, new_time")
        .maybeSingle<PushEvent>();

    if (claimError) return json({error: claimError.message}, 500, headers);
    if (!event) return json({ok: true, duplicate: true}, 200, headers);

    const {data: subscriptions, error: subscriptionError} = await admin
        .from("admin_push_subscriptions")
        .select("id, endpoint, p256dh, auth_key");

    if (subscriptionError) {
        await admin.from("appointment_push_events").update({status: "failed", last_error: subscriptionError.message}).eq("id", event.id);
        return json({error: subscriptionError.message}, 500, headers);
    }

    const content = notificationFor(event);
    const payload = JSON.stringify({...content, eventId: event.id, url: "/admin"});
    const errors: string[] = [];

    await Promise.all((subscriptions || []).map(async (subscription) => {
        try {
            await webpush.sendNotification({
                endpoint: subscription.endpoint,
                keys: {p256dh: subscription.p256dh, auth: subscription.auth_key},
            }, payload, {TTL: 60 * 60 * 24, urgency: "high"});
            await admin.from("admin_push_subscriptions").update({last_success_at: new Date().toISOString()}).eq("id", subscription.id);
        } catch (error) {
            const statusCode = Number((error as {statusCode?: number}).statusCode || 0);
            if (statusCode === 404 || statusCode === 410) {
                await admin.from("admin_push_subscriptions").delete().eq("id", subscription.id);
                return;
            }
            errors.push(error instanceof Error ? error.message : String(error));
        }
    }));

    await admin.from("appointment_push_events").update({
        status: "processed",
        processed_at: new Date().toISOString(),
        last_error: errors.length ? errors.join(" | ").slice(0, 2000) : null,
    }).eq("id", event.id);

    return json({ok: true, sent: (subscriptions || []).length - errors.length, errors: errors.length}, 200, headers);
}

Deno.serve(async (req) => {
    const headers = corsHeaders(req.headers.get("Origin"));
    if (req.method === "OPTIONS") return new Response("ok", {headers});
    if (req.method !== "POST") return json({error: "Método não permitido."}, 405, headers);

    let body: Record<string, unknown>;
    try {
        body = await req.json();
    } catch {
        return json({error: "JSON inválido."}, 400, headers);
    }

    const suppliedWebhookSecret = req.headers.get("x-push-webhook-secret");
    if (suppliedWebhookSecret && webhookSecret && suppliedWebhookSecret === webhookSecret) {
        return deliverWebhook(body, headers);
    }

    return manageSubscription(req, body, headers);
});
