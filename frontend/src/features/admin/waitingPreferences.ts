export type WaitingPreferences = {
    preferred_dates?: string[] | null;
    preferred_times?: string[] | null;
    preferred_date?: string | null;
    preferred_time?: string | null;
};

export function sortedUnique(values: string[]) {
    return [...new Set(values.filter(Boolean))].sort();
}

export function togglePreference(values: string[], value: string) {
    return sortedUnique(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
}

export function getWaitingPreferences(entry: WaitingPreferences) {
    return {
        dates: sortedUnique(entry.preferred_dates ?? (entry.preferred_date ? [entry.preferred_date] : [])),
        times: sortedUnique((entry.preferred_times ?? (entry.preferred_time ? [entry.preferred_time] : [])).filter(Boolean).map((time) => time.slice(0, 5))),
    };
}

export function getSingleWaitingPreference(entry: WaitingPreferences) {
    const {dates, times} = getWaitingPreferences(entry);
    return dates.length === 1 && times.length === 1 ? {date: dates[0], time: times[0]} : null;
}
