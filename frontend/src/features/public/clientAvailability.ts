import {canServiceUseClientStart, getAgendaDurationMinutes, getClientBookingStartContext} from "../../shared/dynamicSchedule.ts";
import {intervalsOverlap, timeToMinutes, type Appointment, type ScheduleBlock, type ScheduleTimeOverride} from "../../shared/domain.ts";

export function getAvailableClientStarts(
    date: string,
    serviceDurationMinutes: number,
    appointments: Appointment[],
    blocks: ScheduleBlock[],
    overrides: ScheduleTimeOverride[],
    serviceName?: string,
    excludedAppointmentId?: string,
) {
    const context = getClientBookingStartContext(date, appointments, overrides, excludedAppointmentId);
    const agendaDuration = getAgendaDurationMinutes(serviceDurationMinutes);
    const occupied = appointments
        .filter((appointment) => appointment.date === date && appointment.id !== excludedAppointmentId && appointment.status !== "cancelled" && appointment.status !== "no-show")
        .map((appointment) => {
            const start = timeToMinutes(appointment.startTime);
            return {start, end: start + getAgendaDurationMinutes(appointment.durationMinutes)};
        });
    const blocked = blocks
        .filter((block) => block.date === date)
        .map((block) => ({start: timeToMinutes(block.startTime), end: timeToMinutes(block.endTime)}));

    return context.allStarts.filter((start) => {
        if (!canServiceUseClientStart(start, serviceDurationMinutes, context, serviceName)) return false;
        const end = start + agendaDuration;
        return !occupied.some((interval) => intervalsOverlap(start, end, interval.start, interval.end)) &&
            !blocked.some((interval) => intervalsOverlap(start, end, interval.start, interval.end));
    });
}
