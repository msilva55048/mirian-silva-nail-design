export type AdminAgendaAppointmentLike = {
    id: string;
    appointment_date: string;
    start_time: string;
};

export type AdminAgendaBlockLike = {
    id: string;
    block_date: string;
    start_time: string;
    end_time: string;
    reason: string | null;
};

export type AdminAgendaEntry<Appointment, Block> =
    | {
        kind: "appointment";
        id: string;
        date: string;
        startTime: string;
        appointment: Appointment;
    }
    | {
        kind: "block";
        id: string;
        date: string;
        startTime: string;
        block: Block;
    };

export function mergeAdminAgendaItems<
    Appointment extends AdminAgendaAppointmentLike,
    Block extends AdminAgendaBlockLike,
>(
    appointments: Appointment[],
    blocks: Block[],
    includeBlocks = true,
): AdminAgendaEntry<Appointment, Block>[] {
    const appointmentEntries: AdminAgendaEntry<Appointment, Block>[] = appointments.map((appointment) => ({
        kind: "appointment",
        id: appointment.id,
        date: appointment.appointment_date,
        startTime: appointment.start_time,
        appointment,
    }));
    const blockEntries: AdminAgendaEntry<Appointment, Block>[] = includeBlocks
        ? blocks.map((block) => ({
            kind: "block",
            id: block.id,
            date: block.block_date,
            startTime: block.start_time,
            block,
        }))
        : [];

    return [...appointmentEntries, ...blockEntries].sort((first, second) =>
        `${first.date}${first.startTime.slice(0, 5)}`.localeCompare(
            `${second.date}${second.startTime.slice(0, 5)}`,
        ),
    );
}

export function getAdminAgendaDates<Appointment, Block>(
    entries: AdminAgendaEntry<Appointment, Block>[],
) {
    return [...new Set(entries.map((entry) => entry.date))].sort();
}

export function formatAdminBlockReason(reason: string | null | undefined) {
    return reason && reason.trim() ? `(${reason})` : null;
}
