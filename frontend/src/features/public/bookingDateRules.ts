// Datas do calendário no formato local YYYY-MM-DD.
export function isClientBookingDateBlocked(date: string) {
    return date >= "2026-10-26" && new Date(`${date}T12:00:00`).getDay() === 0;
}
