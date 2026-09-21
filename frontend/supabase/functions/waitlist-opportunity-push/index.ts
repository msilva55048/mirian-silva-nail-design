import { withSupabase } from "npm:@supabase/server";
import webpush from "npm:web-push@3.6.7";

const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"apikey, authorization, content-type"};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status, headers:{...cors,"Content-Type":"application/json"}});

export default {
  fetch: withSupabase({auth:"secret"}, async (req, ctx) => {
  if (req.method === "OPTIONS") return new Response("ok", {headers:cors});
  const supabase = ctx.supabaseAdmin;
  const vapid = {subject:Deno.env.get("WEB_PUSH_VAPID_SUBJECT")!, publicKey:Deno.env.get("WEB_PUSH_VAPID_PUBLIC_KEY")!, privateKey:Deno.env.get("WEB_PUSH_VAPID_PRIVATE_KEY")!};
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  let body: {action?: string} = {};
  try { body = await req.json(); } catch { /* default dispatch */ }
  if (body.action !== "dispatch") return json({error:"unsupported_action"}, 400);

  const {data: notificationTargets, error: notificationError} = await supabase.rpc("get_waitlist_opportunity_notification_targets");
  if (notificationError) return json({error:"notification_target_query_failed"}, 500);
  for (const target of (notificationTargets ?? []) as Array<Record<string, any>>) {
    const {error: createError} = await supabase.rpc("create_client_notification", {
      p_client_id: target.client_id,
      p_type: "waitlist-opportunity",
      p_title: "Vaga disponível ✨",
      p_message: `Surgiu uma vaga para ${target.service_name} em ${target.appointment_date} às ${String(target.start_time).slice(0, 5)}. A disponibilidade está sujeita a preenchimento.`,
      p_data: {opportunity_id: target.opportunity_id},
      p_entity_type: "waitlist-opportunity",
      p_entity_id: target.opportunity_id,
      p_dedupe_key: `waitlist-opportunity:${target.opportunity_id}:${target.client_id}`,
    });
    if (createError) return json({error:"notification_create_failed"}, 500);
  }

  const {data: targets, error} = await supabase.rpc("get_waitlist_opportunity_dispatch_targets");
  if (error) return json({error:"target_query_failed"}, 500);
  let sent = 0, skipped = 0, failed = 0, invalid = 0;
  for (const target of (targets ?? []) as Array<Record<string, any>>) {
    const {data: inserted, error: insertError} = await supabase.from("waitlist_push_dispatches").insert({
      opportunity_id: target.opportunity_id, client_id: target.client_id, subscription_id: target.subscription_id, status:"pending"
    }).select("id,status").maybeSingle();
    let dispatch = inserted;
    if (!dispatch) {
      const {data: existing, error: existingError} = await supabase.from("waitlist_push_dispatches").select("id,status").eq("opportunity_id",target.opportunity_id).eq("client_id",target.client_id).eq("subscription_id",target.subscription_id).maybeSingle();
      if (insertError || existingError || !existing) { skipped++; continue; }
      skipped++;
      continue;
    }
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
  }),
};
