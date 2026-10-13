import {createClient} from "npm:@supabase/supabase-js@2.57.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(supabaseUrl, serviceRoleKey, {auth: {persistSession: false, autoRefreshToken: false}});
const siteOrigin = (Deno.env.get("SITE_ORIGIN") || "https://agendamentosmiriansilva.com.br").replace(/\/$/, "");

function headers(origin: string | null) {
    return {"Access-Control-Allow-Origin": origin === siteOrigin ? origin : siteOrigin, "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", Vary: "Origin"};
}
function json(body: unknown, status: number, h: Record<string, string>) {
    return new Response(JSON.stringify(body), {status, headers: {...h, "Content-Type": "application/json"}});
}

Deno.serve(async (req) => {
    const h = headers(req.headers.get("Origin"));
    if (req.method === "OPTIONS") return new Response("ok", {headers: h});
    if (req.method !== "POST") return json({error: "Método não permitido."}, 405, h);

    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({error: "Sessão inválida."}, 401, h);
    const {data: {user}, error: authError} = await admin.auth.getUser(token);
    if (authError || !user) return json({error: "Sessão inválida."}, 401, h);

    const {data: config, error: configError} = await admin.from("push_admin_config").select("admin_user_id").eq("singleton", true).maybeSingle();
    if (configError || !config || config.admin_user_id !== user.id) return json({error: "Acesso restrito à administradora."}, 403, h);

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return json({error: "JSON inválido."}, 400, h); }
    const clientProfileId = typeof body.clientProfileId === "string" ? body.clientProfileId : "";
    const password = typeof body.password === "string" ? body.password : "";
    const authorizedByClient = body.clientAuthorized === true;
    if (!clientProfileId || !password || !authorizedByClient) return json({error: "Dados inválidos ou autorização da cliente não confirmada."}, 400, h);

    const {data: profile, error: profileError} = await admin.from("client_profiles").select("id,user_id").eq("id", clientProfileId).maybeSingle();
    if (profileError || !profile?.user_id) return json({error: "Conta de acesso não encontrada para esta cliente."}, 404, h);
    if (profile.user_id === user.id) return json({error: "Não é permitido redefinir a senha da administradora por este recurso."}, 403, h);

    const {data: target, error: targetError} = await admin.auth.admin.getUserById(profile.user_id);
    if (targetError || !target.user) return json({error: "Conta de acesso não encontrada."}, 404, h);
    const {data: otherAdmin} = await admin.from("push_admin_config").select("admin_user_id").eq("admin_user_id", profile.user_id).maybeSingle();
    if (otherAdmin) return json({error: "Não é permitido redefinir senhas de administradores por este recurso."}, 403, h);

    const {data: audit, error: auditError} = await admin.from("client_password_reset_audit")
        .insert({admin_user_id: user.id, client_user_id: profile.user_id, client_profile_id: profile.id})
        .select("id").single();
    if (auditError || !audit) return json({error: "Não foi possível registrar a auditoria. A senha não foi alterada."}, 500, h);

    const {error: updateError} = await admin.auth.admin.updateUserById(profile.user_id, {password});
    if (updateError) {
        await admin.from("client_password_reset_audit").update({outcome: "failed"}).eq("id", audit.id);
        return json({error: "Não foi possível redefinir a senha. Verifique os requisitos de segurança configurados."}, 400, h);
    }
    await admin.from("client_password_reset_audit").update({outcome: "completed"}).eq("id", audit.id);
    return json({ok: true}, 200, h);
});
