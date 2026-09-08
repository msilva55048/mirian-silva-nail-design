/** Fonte única dos horários-base públicos; overrides e encaixes são aplicados depois. */
export function isPublicBookingDateClosed(date: string): boolean {
    return date >= '2026-11-01' && new Date(`${date}T12:00:00`).getDay() === 0;
}

export function getPublicBaseStartMinutes(date: string): number[] {
    if (!date || isPublicBookingDateClosed(date)) return [];
    if (date <= '2026-10-25') return [7 * 60, 19 * 60, 21 * 60];
    return [7 * 60, 9 * 60, 11 * 60, 13 * 60, 17 * 60, 19 * 60];
}
