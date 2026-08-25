import {formatDateForInput} from "../../shared/domain";
import {type AdminAppointment} from "./types";

export function formatAdminDate(date: string) {
    return new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
}

export function normalizePhoneForWhatsApp(phone: string) {
    const digits = phone.replace(/\D/g, "");

    if (digits.startsWith("55")) {
        return digits;
    }

    return `55${digits}`;
}

export function addDaysToInputDate(date: string, amount: number) {
    const value = new Date(`${date}T12:00:00`);
    value.setDate(value.getDate() + amount);
    return formatDateForInput(value);
}

export function getMinutesFromTime(time: string) {
    const [hours, minutes] = String(time).slice(0, 5).split(":").map(Number);
    return hours * 60 + minutes;
}

export function getAppointmentDateTime(appointment: AdminAppointment) {
    return new Date(
        `${appointment.appointment_date}T${String(appointment.start_time).slice(0, 5)}:00`,
    );
}

export function getAppointmentEndDateTime(appointment: AdminAppointment) {
    const start = getAppointmentDateTime(appointment);

    return new Date(
        start.getTime() + appointment.duration_minutes * 60_000,
    );
}


export type WhatsAppNotificationType = "attendance-confirmation" | "two-hour-reminder";

export function formatAppointmentDateForMessage(date: string) {
    return new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
}

export function buildWhatsAppMessage(
    appointment: AdminAppointment,
    type: WhatsAppNotificationType,
) {
    const firstName = appointment.client_name.trim().split(/\s+/)[0] || appointment.client_name;
    const date = formatAppointmentDateForMessage(appointment.appointment_date);
    const time = String(appointment.start_time).slice(0, 5);

    if (type === "attendance-confirmation") {
        return `Oie ${firstName}! Tudo bem? Passando pra lembrar do seu horário comigo amanhã, dia ${date}, às ${time}. Posso confirmar sua presença? 💅`;
    }

    return `Oie ${firstName}! Tudo bem? Passando para lembrar do nosso horário de hoje, às ${time}. Estarei te esperando. 💅`;
}

export function getWhatsAppNotificationLabel(type: WhatsAppNotificationType) {
    if (type === "attendance-confirmation") return "Solicitar confirmação";
    return "Enviar lembrete";
}



