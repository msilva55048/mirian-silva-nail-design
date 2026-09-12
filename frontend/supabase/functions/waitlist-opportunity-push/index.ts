import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, content-type"};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status, headers:{...cors,"Content-Type":"application/json"}});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", {headers:cors});
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!auth || auth !== serviceRole) return json({error:"unauthorized"}, 401);
  const supabase = createClient(url, serviceRole, {auth:{persistSession:false}});
  const vapid = {subject:Deno.env.get("VAPID_SUBJECT")!, publicKey:Deno.env.get("VAPID_PUBLIC_KEY")!, privateKey:Deno.env.get("VAPID_PRIVATE_KEY")!};
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  let body: {action?: string} = {};
  try { body = await req.json(); } catch { /* default dispatch */ }
  if (body.action !== "dispatch") return json({error:"unsupported_action"}, 400);

  const {data: targets, error} = await supabase.rpc("get_waitlist_opportunity_dispatch_targets");
  if (error) return json({error:"target_query_failed"}, 500);
  let sent = 0, skipped = 0, failed = 0, invalid = 0;
  for (const target of (targets ?? []) as Array<Record<string, any>>) {
    const {data: dispatch, error: upsertError} = await supabase.from("waitlist_push_dispatches").upsert({
      opportunity_id: target.opportunity_id, client_id: target.client_id, subscription_id: target.subscription_id, status:"pending"
    }, {onConflict:"opportunity_id,client_id,subscription_id", ignoreDuplicates:false}).select("id,status").single();
    if (upsertError || !dispatch || ["sent","opened"].includes(dispatch.status)) { skipped++; continue; }
    const payload = {title:"Vaga disponível com a Mirian ✨", body:`Surgiu uma vaga para ${target.service_name}. Toque para conferir.`, url:`/client?section=appointments&opportunity=${target.opportunity_id}`, opportunityId:target.opportunity_id};
    try {
      await supabase.from("waitlist_push_dispatches").update({status:"processing", updated_at:new Date().toISOString()}).eq("id",dispatch.id);
      await webpush.sendNotification({endpoint:target.endpoint, keys:{p256dh:target.p256dh, auth:target.auth_key}}, JSON.stringify(payload));
      await supabase.from("waitlist_push_dispatches").update({status:"sent", sent_at:new Date().toISOString(), updated_at:new Date().toISOString(), last_error:null}).eq("id",dispatch.id);
      await supabase.from("client_push_subscriptions").update({last_success_at:new Date().toISOString(), updated_at:new Date().toISOString()}).eq("id",target.subscription_id);
      sent++;
    } catch (err) {
      const status = Number((err as any)?.statusCode ?? 0);
      const isInvalid = status === 404 || status === 410;
      if (isInvalid) { await supabase.from("client_push_subscriptions").delete().eq("id",target.subscription_id); invalid++; }
      await supabase.from("waitlist_push_dispatches").update({status:"failed", last_error:isInvalid?`push_status_${status}`:"push_failed", updated_at:new Date().toISOString()}).eq("id",dispatch.id);
      failed++;
    }
  }
  return json({ok:true, targets:(targets ?? []).length, sent, skipped, failed, invalid});
});
