import {getConfiguredClientStartMinutes, timeToMinutes, type Appointment, type ScheduleTimeOverride} from './domain.ts';
const REPAIR_AGENDA_SLOT_MINUTES = 30;
export function getAgendaDurationMinutes(durationMinutes: number) {
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return 0;

    return durationMinutes <= REPAIR_AGENDA_SLOT_MINUTES
        ? REPAIR_AGENDA_SLOT_MINUTES
        : durationMinutes;
}


export type ClientBookingStartContext = {
    fixedStarts: number[];
    generatedStarts: number[];
    allStarts: number[];
};

export function getClientBookingStartContext(
    date: string,
    sourceAppointments: Appointment[],
    overrides: ScheduleTimeOverride[] = [],
    excludedAppointmentId?: string,
): ClientBookingStartContext {
    const fixedStarts = getConfiguredClientStartMinutes(date, overrides);
    const fixedStartSet = new Set(fixedStarts);

    const removedStarts = new Set(
        overrides
            .filter(
                (item) =>
                    item.override_date === date &&
                    !item.is_available,
            )
            .map((item) => timeToMinutes(String(item.start_time).slice(0, 5))),
    );

    const validAppointments = sourceAppointments.filter((appointment) =>
        appointment.date === date && appointment.id !== excludedAppointmentId &&
        !['cancelled', 'canceled', 'cancelado', 'no_show', 'no-show'].includes(appointment.status) &&
        Number.isFinite(appointment.durationMinutes) && appointment.durationMinutes > 0,
    );

    const reachableStarts = new Set(fixedStarts);
    const generatedStarts = new Set<number>();

    let generatedSomething = true;

    while (generatedSomething) {
        generatedSomething = false;

        for (const appointment of validAppointments) {
            const start = timeToMinutes(appointment.startTime);
            if (!reachableStarts.has(start)) continue;
            if (start === 13 * 60) continue;
            const candidate = start + getAgendaDurationMinutes(appointment.durationMinutes);

            if (removedStarts.has(candidate)) continue;

            const nextFixedStart = fixedStarts.find((fixedStart) => fixedStart > start);

            // Só um início dinâmico precisa caber antes da próxima âncora.
            if (nextFixedStart !== undefined) {
                if (!fixedStartSet.has(start) && candidate > nextFixedStart) continue;
            } else continue;

            if (fixedStartSet.has(candidate) || reachableStarts.has(candidate)) {
                continue;
            }

            generatedStarts.add(candidate);
            reachableStarts.add(candidate);
            generatedSomething = true;
        }
    }

    return {
        fixedStarts,
        generatedStarts: [...generatedStarts].sort((a, b) => a - b),
        allStarts: [...reachableStarts].sort((a, b) => a - b),
    };
}

export function canServiceUseClientStart(
    start: number,
    serviceDurationMinutes: number,
    context: ClientBookingStartContext,
    serviceName?: string,
) {
    if (!Number.isFinite(serviceDurationMinutes) || serviceDurationMinutes <= 0) return false;
    const agendaDuration = getAgendaDurationMinutes(serviceDurationMinutes);
    if (start === 13 * 60 && serviceName !== undefined) {
        const normalizedName = serviceName.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        if (!normalizedName.startsWith('esmaltacao') && !normalizedName.startsWith('alongamento')) return false;
    }
    if (context.fixedStarts.includes(start)) return true;

    if (!context.generatedStarts.includes(start)) {
        return false;
    }

    const nextFixedStart = context.fixedStarts.find((fixedStart) => fixedStart > start);

    if (nextFixedStart !== undefined) {
        return start + agendaDuration <= nextFixedStart;
    }

    return false;
}
