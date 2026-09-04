import type {AdminClient} from "./types";
import {getAppointmentEndDateTime} from "./utils";

export type ClientAppointmentFilter = "all" | "with" | "without";

export function filterAdminClients(clients: AdminClient[], search: string, filter: ClientAppointmentFilter, now: Date) {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    const digits = search.replace(/\D/g, "");
    return clients.filter((client) => {
        const hasActiveAppointment = client.appointments.some((appointment) =>
            (appointment.status === "pending" || appointment.status === "confirmed") &&
            getAppointmentEndDateTime(appointment).getTime() > now.getTime(),
        );
        if (filter === "with" && !hasActiveAppointment) return false;
        if (filter === "without" && hasActiveAppointment) return false;
        return !query || client.name.trim().toLocaleLowerCase("pt-BR").includes(query) ||
            (Boolean(digits) && client.phone.replace(/\D/g, "").includes(digits));
    }).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}
