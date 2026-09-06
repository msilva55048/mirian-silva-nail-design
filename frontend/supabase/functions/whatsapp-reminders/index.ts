import {createClient} from "npm:@supabase/supabase-js@2.57.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const REMINDERS_SECRET = Deno.env.get("WHATSAPP_REMINDERS_SECRET")!;
const WHATSAPP_SENDING_ENABLED =
    Deno.env.get("WHATSAPP_SENDING_ENABLED") === "true";

const WHATSAPP_ACCESS_TOKEN =
    Deno.env.get("WHATSAPP_ACCESS_TOKEN") || "";

const WHATSAPP_PHONE_NUMBER_ID =
    Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || "";

const WHATSAPP_GRAPH_API_VERSION =
    Deno.env.get("WHATSAPP_GRAPH_API_VERSION") || "";

const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
);

const ACTIVE_APPOINTMENT_STATUSES = new Set([
    "pending",
    "confirmed",
]);

const ONE_HOUR_MS = 60 * 60 * 1000;

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

type ClientProfile = {
    id: string;
    whatsapp_opt_in: boolean;
    whatsapp_opt_out_at: string | null;
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

    if (digits.startsWith("55")) {
        return digits;
    }

    return `55${digits}`;
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

async function sendWhatsappTemplate(
    notification: WhatsappNotification,
    appointment: Appointment,
) {
    if (
        !WHATSAPP_ACCESS_TOKEN ||
        !WHATSAPP_PHONE_NUMBER_ID ||
        !WHATSAPP_GRAPH_API_VERSION
    ) {
        throw new Error(
            "Credenciais da API oficial do WhatsApp ainda não configuradas.",
        );
    }

    if (!notification.template_name) {
        throw new Error(
            `Template ausente na notificação ${notification.id}.`,
        );
    }

    const recipientPhone = normalizeBrazilianPhone(
        appointment.client_phone,
    );

    if (!recipientPhone) {
        throw new Error(
            `Telefone inválido na notificação ${notification.id}.`,
        );
    }

    const body = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipientPhone,
        type: "template",
        template: {
            name: notification.template_name,
            language: {
                code: notification.template_language || "pt_BR",
            },
            components: [
                {
                    type: "body",
                    parameters: [
                        {
                            type: "text",
                            text: appointment.client_name,
                        },
                        {
                            type: "text",
                            text: appointment.service_name,
                        },
                        {
                            type: "text",
                            text: brazilianDate(
                                appointment.appointment_date,
                            ),
                        },
                        {
                            type: "text",
                            text: String(
                                appointment.start_time,
                            ).slice(0, 5),
                        },
                    ],
                },
            ],
        },
    };

    const response = await fetch(
        `https://graph.facebook.com/${WHATSAPP_GRAPH_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        },
    );

    const result = await response.json();

    if (!response.ok) {
        const metaMessage =
            result?.error?.message ||
            `Erro HTTP ${response.status}`;

        throw new Error(
            `Meta WhatsApp API: ${metaMessage}`,
        );
    }

    const providerMessageId =
        result?.messages?.[0]?.id;

    if (!providerMessageId) {
        throw new Error(
            "A Meta aceitou a requisição, mas não retornou o ID da mensagem.",
        );
    }

    return providerMessageId;
}

async function cancelNotification(notificationId: number) {
    const {error} = await supabase
        .from("whatsapp_notifications")
        .update({
            status: "cancelled",
            updated_at: new Date().toISOString(),
        })
        .eq("id", notificationId)
        .neq("status", "sent");

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
                [
                    "id",
                    "client_id",
                    "client_name",
                    "client_phone",
                    "service_name",
                    "appointment_date",
                    "start_time",
                    "status",
                ].join(","),
            )
            .gte("appointment_date", startDate)
            .lte("appointment_date", endDate);

        if (appointmentsError) {
            throw appointmentsError;
        }

        const appointments = (
            appointmentsData ?? []
        ) as Appointment[];

        const clientIds = [
            ...new Set(
                appointments
                    .map((appointment) => appointment.client_id)
                    .filter(
                        (id): id is string =>
                            typeof id === "string" && id.length > 0,
                    ),
            ),
        ];

        let clientProfiles: ClientProfile[] = [];

        if (clientIds.length > 0) {
            const {
                data: profilesData,
                error: profilesError,
            } = await supabase
                .from("client_profiles")
                .select(
                    "id, whatsapp_opt_in, whatsapp_opt_out_at",
                )
                .in("id", clientIds);

            if (profilesError) {
                throw profilesError;
            }

            clientProfiles = (
                profilesData ?? []
            ) as ClientProfile[];
        }

        const profilesById = new Map(
            clientProfiles.map((profile) => [
                profile.id,
                profile,
            ]),
        );

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
                    [
                        "id",
                        "appointment_id",
                        "notification_type",
                        "recipient_phone",
                        "template_name",
                        "template_language",
                        "payload",
                        "status",
                        "scheduled_for",
                    ].join(","),
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

        for (const appointment of appointments) {
            const profile = appointment.client_id
                ? profilesById.get(appointment.client_id)
                : undefined;

            const canReceiveWhatsapp =
                ACTIVE_APPOINTMENT_STATUSES.has(
                    appointment.status,
                ) &&
                profile?.whatsapp_opt_in === true &&
                !profile.whatsapp_opt_out_at;

            const appointmentAt =
                appointmentDateTime(appointment);

            for (const rule of reminderRules) {
                const key =
                    `${appointment.id}:${rule.notificationType}`;

                const existing =
                    notificationsByKey.get(key);

                /*
                 * Agendamento cancelado, concluído, sem perfil,
                 * sem autorização ou com opt-out.
                 */
                if (!canReceiveWhatsapp) {
                    if (
                        existing &&
                        existing.status !== "sent" &&
                        existing.status !== "cancelled"
                    ) {
                        await cancelNotification(existing.id);
                        cancelled++;
                    }

                    skipped++;
                    continue;
                }

                const scheduledFor = new Date(
                    appointmentAt.getTime() -
                    rule.millisecondsBefore,
                );

                /*
                 * Não criamos lembrete extremamente atrasado.
                 *
                 * Há 1 hora de tolerância caso a função tenha ficado
                 * temporariamente sem executar.
                 */
                if (
                    scheduledFor.getTime() <
                    now.getTime() - ONE_HOUR_MS
                ) {
                    if (
                        existing &&
                        existing.status !== "sent" &&
                        existing.status !== "cancelled"
                    ) {
                        await cancelNotification(existing.id);
                        cancelled++;
                    }

                    skipped++;
                    continue;
                }

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
                    skipped++;
                    continue;
                }

                const payload = {
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
                    existingPayload.client_name === payload.client_name &&
                    existingPayload.service_name === payload.service_name &&
                    existingPayload.appointment_date === payload.appointment_date &&
                    existingPayload.start_time === payload.start_time;

                if (nothingChanged) {
                    skipped++;
                    continue;
                }

                if (existing) {
                    const {error: updateError} =
                        await supabase
                            .from("whatsapp_notifications")
                            .update({
                                recipient_phone: recipientPhone,
                                template_name: rule.templateName,
                                template_language: "pt_BR",
                                payload,
                                scheduled_for: scheduledFor.toISOString(),
                                status: "pending",
                                failed_at: null,
                                error_message: null,
                                updated_at: new Date().toISOString(),
                            })
                            .eq("id", existing.id);

                    if (updateError) {
                        throw updateError;
                    }

                    updated++;
                    continue;
                }

                const {error: insertError} =
                    await supabase
                        .from("whatsapp_notifications")
                        .insert({
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

                /*
                 * 23505 = outro processo já criou a mesma mensagem.
                 * O índice único do banco protege contra duplicidade.
                 */
                if (
                    insertError &&
                    insertError.code !== "23505"
                ) {
                    throw insertError;
                }

                if (!insertError) {
                    created++;
                }
            }
        }

        let claimed = 0;
        let sent = 0;
        let failed = 0;

        if (WHATSAPP_SENDING_ENABLED) {
            const {
                data: claimedData,
                error: claimError,
            } = await supabase.rpc(
                "claim_due_whatsapp_notifications",
                {
                    p_limit: 20,
                },
            );

            if (claimError) {
                throw claimError;
            }

            const claimedNotifications =
                (claimedData ?? []) as WhatsappNotification[];

            claimed = claimedNotifications.length;

            for (const notification of claimedNotifications) {
                const appointment = appointments.find(
                    (item) =>
                        item.id === notification.appointment_id,
                );

                if (!appointment) {
                    await supabase
                        .from("whatsapp_notifications")
                        .update({
                            status: "failed",
                            failed_at: new Date().toISOString(),
                            error_message:
                                "Agendamento não encontrado para a notificação.",
                            updated_at: new Date().toISOString(),
                        })
                        .eq("id", notification.id);

                    failed++;
                    continue;
                }

                const profile = appointment.client_id
                    ? profilesById.get(appointment.client_id)
                    : undefined;

                const stillAuthorized =
                    ACTIVE_APPOINTMENT_STATUSES.has(
                        appointment.status,
                    ) &&
                    profile?.whatsapp_opt_in === true &&
                    !profile.whatsapp_opt_out_at;

                if (!stillAuthorized) {
                    await supabase
                        .from("whatsapp_notifications")
                        .update({
                            status: "cancelled",
                            updated_at: new Date().toISOString(),
                        })
                        .eq("id", notification.id);

                    continue;
                }

                try {
                    const providerMessageId =
                        await sendWhatsappTemplate(
                            notification,
                            appointment,
                        );

                    await supabase
                        .from("whatsapp_notifications")
                        .update({
                            status: "sent",
                            provider_message_id:
                            providerMessageId,
                            sent_at: new Date().toISOString(),
                            failed_at: null,
                            error_message: null,
                            updated_at: new Date().toISOString(),
                        })
                        .eq("id", notification.id);

                    sent++;
                } catch (error) {
                    const message =
                        error instanceof Error
                            ? error.message
                            : String(error);

                    await supabase
                        .from("whatsapp_notifications")
                        .update({
                            status: "failed",
                            failed_at: new Date().toISOString(),
                            error_message: message.slice(0, 2000),
                            updated_at: new Date().toISOString(),
                        })
                        .eq("id", notification.id);

                    failed++;
                }
            }
        }

        return new Response(
            JSON.stringify({
                success: true,
                mode: WHATSAPP_SENDING_ENABLED
                    ? "queue-and-send"
                    : "queue-only",
                appointments_checked: appointments.length,
                notifications_created: created,
                notifications_updated: updated,
                notifications_cancelled: cancelled,
                notifications_skipped: skipped,
                notifications_claimed: claimed,
                notifications_sent: sent,
                notifications_failed: failed,
                sending_enabled: WHATSAPP_SENDING_ENABLED,
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