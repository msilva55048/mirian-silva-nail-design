import {isPublicBookingDateClosed} from '../../shared/publicSchedule.ts';

// Datas do calendário no formato local YYYY-MM-DD.
export function isClientBookingDateBlocked(date: string) {
    return isPublicBookingDateClosed(date);
}
