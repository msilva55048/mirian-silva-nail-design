type ClientAppointmentLike = {
    appointment_date: string;
    start_time: string;
    status: string;
    confirmation_sent_at?: string | null;
};

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];

export function getNextClientAppointment<T extends ClientAppointmentLike>(appointments: T[], now = new Date()): T | null {
    return appointments
        .filter((appointment) => {
            if (!["pending", "confirmed"].includes(appointment.status)) return false;
            const dateTime = new Date(`${appointment.appointment_date}T${String(appointment.start_time).slice(0, 5)}:00`);
            return dateTime.getTime() > now.getTime();
        })
        .sort((first, second) => `${first.appointment_date}${first.start_time}`.localeCompare(`${second.appointment_date}${second.start_time}`))[0] ?? null;
}

export function formatClientUpcomingDate(date: string, time: string): string {
    const localDate = new Date(`${date}T12:00:00`);
    return `${WEEKDAYS[localDate.getDay()]}, ${String(localDate.getDate()).padStart(2, "0")}/${String(localDate.getMonth() + 1).padStart(2, "0")} às ${String(time).slice(0, 5)}`;
}
