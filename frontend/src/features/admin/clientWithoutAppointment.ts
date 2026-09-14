import type {AdminClient} from "./types";
import {getAppointmentEndDateTime} from "./utils";

const INACTIVITY_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000;

/** A client is inactive only after a valid historical appointment is over 30 days old. */
export function isClientInactive(client: AdminClient, now: Date) {
    if (client.nextAppointment || !client.lastAppointment) return false;

    return now.getTime() - getAppointmentEndDateTime(client.lastAppointment).getTime() >
        INACTIVITY_THRESHOLD_MS;
}
