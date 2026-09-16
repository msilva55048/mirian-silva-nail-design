type ClientReference = {key: string; phone: string; email: string};
type AppointmentReference = {client_id?: string | null; client_phone: string; client_email: string | null};

function digits(value: string) {
    return value.replace(/\D/g, "");
}

export function findClientKeyForAppointment(
    appointment: AppointmentReference,
    clients: ClientReference[],
) {
    if (appointment.client_id) {
        const byId = clients.find((client) => client.key === `profile:${appointment.client_id}`);
        if (byId) return byId.key;
    }

    const phone = digits(appointment.client_phone);
    if (phone) {
        const byPhone = clients.find((client) => digits(client.phone) === phone);
        if (byPhone) return byPhone.key;
    }

    const email = appointment.client_email?.trim().toLocaleLowerCase("pt-BR");
    if (email) {
        const byEmail = clients.find((client) => client.email.trim().toLocaleLowerCase("pt-BR") === email);
        if (byEmail) return byEmail.key;
    }

    return null;
}
