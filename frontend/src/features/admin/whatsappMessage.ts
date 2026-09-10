export type WhatsAppConfirmationAppointment = {
    client_name: string;
    service_name: string;
    appointment_date: string;
    start_time: string;
};

export function formatAppointmentDateForMessage(date: string) {
    const [year, month, day] = date.slice(0, 10).split("-");
    return `${day}/${month}/${year}`;
}

export function buildWhatsAppMessage(appointment: WhatsAppConfirmationAppointment, type: "attendance-confirmation" | "two-hour-reminder") {
    const firstName = appointment.client_name.trim().split(/\s+/)[0] || appointment.client_name;
    const date = formatAppointmentDateForMessage(appointment.appointment_date);
    const time = String(appointment.start_time).slice(0, 5);
    if (type !== "attendance-confirmation") return `Oie ${firstName}! Tudo bem? Passando para lembrar do nosso horário de hoje, às ${time}. Estarei te esperando. 💅`;
    return ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "          Mirian Silva", "           Nail Design", "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "", `Olá, ${firstName}! ✨`, "", "Gostaria de confirmar seu", "agendamento comigo amanhã.", "", `💅 Serviço: ${appointment.service_name}`, `📅 Data: ${date}`, `🕐 Horário: ${time}`, "", "Posso confirmar sua presença?", "", "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"].join("\n");
}
