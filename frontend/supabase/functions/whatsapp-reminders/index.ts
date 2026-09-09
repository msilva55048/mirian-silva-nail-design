import {scheduleFor} from "../_shared/whatsapp-schedule.mjs";
import {createClient} from "npm:@supabase/supabase-js@2.57.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const REMINDERS_SECRET = Deno.env.get("WHATSAPP_REMINDERS_SECRET")!;

const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
);

const ACTIVE_APPOINTMENT_STATUSES = new Set([
    "pending",
    "confirmed",
]);

type Appointment = {
    id: string;
    client_id: string | null;
    client_name: string;
    client_phone: string;
    service_name: string;
    appointment_date: string;
    start_time: string;
    status: string;
};

type WhatsappNotification = {
    id: number;
    appointment_id: string | null;
    notification_type: string;
    recipient_phone: string;
    template_name: string | null;
    template_language: string;
    payload: Record<string, unknown>;
    status: string;
    scheduled_for: string;
    attempts: number;
    provider_message_id: string | null;
};
const reminderRules = [
    {
        notificationType: "reminder_40h",
        templateName: "confirmacao_agendamento_40h",
        millisecondsBefore: 40 * 60 * 60 * 1000,
    },
    {
        notificationType: "reminder_2h",
        templateName: "lembrete_agendamento_2h",
        millisecondsBefore: 2 * 60 * 60 * 1000,
    },
] as const;

function formatDateInSaoPaulo(date: Date) {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(date);

    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;

    return `${year}-${month}-${day}`;
}

function normalizeBrazilianPhone(phone: string) {
    const digits = phone.replace(/\D/g, "");

    if (!digits) {
        return "";
    }

    if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
        return digits;
    }

    return digits.length === 10 || digits.length === 11 ? `55${digits}` : "";
}

function appointmentDateTime(appointment: Appointment) {
    const time = String(appointment.start_time).slice(0, 8);

    /*
     * São Paulo utiliza UTC-03:00 atualmente.
     * O horário salvo em appointments é horário local da Mirian.
     */
    return new Date(
        `${appointment.appointment_date}T${time}-03:00`,
    );
}
function brazilianDate(value: string) {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
}

function buildMessage(type: string, appointment: Appointment) {
 const name = appointment.client_name.trim().split(/\s+/)[0];
 const date = brazilianDate(appointment.appointment_date);
 const time = String(appointment.start_time).slice(0,5);
 if (type === "reminder_2h") return `Oie ${name}! Tudo bem? Passando pra te lembrar que seu horário comigo é hoje, dia ${date}, às ${time}. Te espero! 💅`;
 if (type !== "reminder_40h") throw new Error("Tipo não permitido");
 return `Oie ${name}! Tudo bem? Passando pra lembrar do seu horário comigo amanhã, dia ${date}, às ${time}. Posso confirmar sua presença? 💅`;

}

async function cancelNotification(notificationId: number) {
    const {error} = await supabase
        .from("whatsapp_notifications")
        .update({
            status: "cancelled",
            updated_at: new Date().toISOString(),
        })
        .eq("id", notificationId)
        .eq("status", "pending")
        .eq("attempts", 0);

    if (error) {
        console.error(
            "Erro ao cancelar notificação:",
            notificationId,
            error,
        );
    }
}

Deno.serve(async (request) => {
    const suppliedSecret = request.headers.get(
        "x-whatsapp-reminders-secret",
    );

    if (!REMINDERS_SECRET || suppliedSecret !== REMINDERS_SECRET) {
        return new Response(
            JSON.stringify({
                error: "Unauthorized",
            }),
            {
                status: 401,
                headers: {
                    "Content-Type": "application/json",
                },
            },
        );
    }
    if (request.method !== "POST") {
        return new Response(
            JSON.stringify({
                error: "Method not allowed",
            }),
            {
                status: 405,
                headers: {
                    "Content-Type": "application/json",
                },
            },
        );
    }

    try {
        const now = new Date();

        const startDate = formatDateInSaoPaulo(now);

        const futureLimit = new Date(
            now.getTime() + 90 * 24 * 60 * 60 * 1000,
        );

        const endDate = formatDateInSaoPaulo(futureLimit);

        /*
         * Buscamos os próximos 90 dias.
         *
         * O volume da Mirian é pequeno, então esta abordagem é simples,
         * barata e também permite corrigir automaticamente alterações
         * de data/horário.
         */
        const {
            data: appointmentsData,
            error: appointmentsError,
        } = await supabase
            .from("appointments")
            .select(
                "id,client_id,client_name,client_phone,service_name,appointment_date,start_time,status",
            )
            .gte("appointment_date", startDate)
            .lte("appointment_date", endDate);

        if (appointmentsError) {
            throw appointmentsError;
        }

        const appointments = (
            appointmentsData ?? []
        ) as Appointment[];

        const appointmentIds = appointments.map(
            (appointment) => appointment.id,
        );

        let existingNotifications: WhatsappNotification[] = [];

        if (appointmentIds.length > 0) {
            const {
                data: notificationsData,
                error: notificationsError,
            } = await supabase
                .from("whatsapp_notifications")
                .select(
                    "id,appointment_id,notification_type,recipient_phone,template_name,template_language,payload,status,scheduled_for,attempts,provider_message_id",
                )
                .in("appointment_id", appointmentIds)
                .in(
                    "notification_type",
                    ["reminder_40h", "reminder_2h"],
                );

            if (notificationsError) {
                throw notificationsError;
            }

            existingNotifications = (
                notificationsData ?? []
            ) as WhatsappNotification[];
        }

        const notificationsByKey = new Map(
            existingNotifications.map((notification) => [
                `${notification.appointment_id}:${notification.notification_type}`,
                notification,
            ]),
        );

        let created = 0;
        let updated = 0;
        let cancelled = 0;
        let skipped = 0;
        const pendingInserts: Record<string, unknown>[] = [];
        const pendingUpdates: Array<{id: number; values: Record<string, unknown>}> = [];
        const pendingCancellations: number[] = [];

        for (const appointment of appointments) {
            const canReceiveWhatsapp = ACTIVE_APPOINTMENT_STATUSES.has(appointment.status);

            const appointmentAt =
                appointmentDateTime(appointment);

            for (const rule of reminderRules) {
                const key =
                    `${appointment.id}:${rule.notificationType}`;

                const existing =
                    notificationsByKey.get(key);

                // A previous attempt may have been sent even if persistence
                // failed. Never reset it while reconciling appointments.
                if (existing && (existing.attempts > 0 || existing.provider_message_id
                    || ["sent", "processing", "failed"].includes(existing.status))) {
                    skipped++;
                    continue;
                }

                /*
                 * Agendamento cancelado ou concluído.
                 */
                if (!canReceiveWhatsapp) {
                    if (
                        existing &&
                        existing.status !== "sent" &&
                        existing.status !== "cancelled"
                    ) {
                        pendingCancellations.push(existing.id);
                    }

                    skipped++;
                    continue;
                }

                const timing = scheduleFor(rule.notificationType, appointment);
                if (!timing || now.getTime() < timing.prepareAt || now.getTime() >= timing.expiresAt || !Number.isFinite(appointmentAt.getTime())) {
                    if (existing?.status === 'pending') pendingCancellations.push(existing.id);
                    skipped++;
                    continue;
                }
                const scheduledFor = new Date(timing.scheduledFor);

                /*
                 * Se já foi enviado, nunca recriamos nem alteramos.
                 */
                if (existing?.status === "sent") {
                    skipped++;
                    continue;
                }

                if (existing?.status === "processing") {
                    skipped++;
                    continue;
                }

                const recipientPhone =
                    normalizeBrazilianPhone(
                        appointment.client_phone,
                    );

                if (!recipientPhone) {
                    if (existing?.status === 'pending') pendingCancellations.push(existing.id);
                    skipped++;
                    continue;
                }

                const payload = {
                    version: 2,
                    phone: recipientPhone,
                    message: buildMessage(rule.notificationType, appointment),
                    client_name: appointment.client_name,
                    service_name: appointment.service_name,
                    appointment_date: appointment.appointment_date,
                    start_time: String(appointment.start_time).slice(0, 5),
                };

                const existingPayload = existing?.payload ?? {};

                const nothingChanged =
                    existing?.status === "pending" &&
                    existing.recipient_phone === recipientPhone &&
                    existing.template_name === rule.templateName &&
                    existing.template_language === "pt_BR" &&
                    new Date(existing.scheduled_for).getTime() === scheduledFor.getTime() &&
                    existingPayload.version === payload.version &&
                    existingPayload.phone === payload.phone &&
                    existingPayload.message === payload.message &&
                    existingPayload.client_name === payload.client_name &&
                    existingPayload.service_name === payload.service_name &&
                    existingPayload.appointment_date === payload.appointment_date &&
                    existingPayload.start_time === payload.start_time;

                if (nothingChanged) {
                    skipped++;
                    continue;
                }

                if (existing) {
                    pendingUpdates.push({id: existing.id, values: {
                                recipient_phone: recipientPhone,
                                template_name: rule.templateName,
                                template_language: "pt_BR",
                                payload,
                                scheduled_for: scheduledFor.toISOString(),
                                status: "pending",
                                failed_at: null,
                                error_message: null,
                                updated_at: new Date().toISOString(),
                            }});
                    continue;
                }

                pendingInserts.push({
                            appointment_id: appointment.id,
                            notification_type:
                            rule.notificationType,
                            recipient_phone: recipientPhone,
                            template_name: rule.templateName,
                            template_language: "pt_BR",
                            payload,
                            status: "pending",
                            scheduled_for:
                                scheduledFor.toISOString(),
                        });
            }
        }

        if (pendingInserts.length) {
            const {error} = await supabase.from("whatsapp_notifications").insert(pendingInserts);
            if (error && error.code !== "23505") throw error;
            if (!error) created += pendingInserts.length;
        }
        await Promise.all(pendingUpdates.map(async ({id, values}) => {
            const {error} = await supabase.from("whatsapp_notifications").update(values)
                .eq("id", id).in("status", ["pending", "cancelled"])
                .eq("attempts", 0).is("provider_message_id", null);
            if (error) throw error;
        }));
        updated += pendingUpdates.length;
        if (pendingCancellations.length) {
            const {error} = await supabase.from("whatsapp_notifications")
                .update({status: "cancelled", updated_at: new Date().toISOString()})
                .in("id", pendingCancellations).eq("status", "pending").eq("attempts", 0);
            if (error) throw error;
            cancelled += pendingCancellations.length;
        }

        return new Response(
            JSON.stringify({
                success: true,
                mode: "queue-only",
                appointments_checked: appointments.length,
                notifications_created: created,
                notifications_updated: updated,
                notifications_cancelled: cancelled,
                notifications_skipped: skipped,
                notifications_claimed: 0,
                notifications_sent: 0,
                notifications_failed: 0,
                sending_enabled: false,
            }),
            {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                },
            },
        );
    } catch (error) {
        console.error(
            "Erro no processamento dos lembretes WhatsApp:",
            error,
        );

        return new Response(
            JSON.stringify({
                success: false,
                error:
                    error instanceof Error
                        ? error.message
                        : String(error),
            }),
            {
                status: 500,
                headers: {
                    "Content-Type": "application/json",
                },
            },
        );
    }
});
