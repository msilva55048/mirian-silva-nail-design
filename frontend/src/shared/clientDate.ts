export function formatClientAppointmentDate(date: string): string {
    return new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
}
