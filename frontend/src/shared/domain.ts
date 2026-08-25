export type Service = {
    name: string;
    description: string;
    duration: string;
    durationMinutes: number;
    price: string;
    priceCents: number;
};

export type Appointment = {
    id: string;
    clientName: string;
    clientPhone: string;
    clientEmail: string;
    serviceName: string;
    date: string;
    startTime: string;
    durationMinutes: number;
    status: "pending" | "confirmed" | "completed" | "cancelled" | "no-show";
};

export type ScheduleBlock = {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    reason?: string;
};

export type TimeInterval = {
    start: number;
    end: number;
};

export type ScheduleTimeOverride = {
    id: string;
    override_date: string;
    start_time: string;
    is_available: boolean;
    created_at?: string;
    updated_at?: string;
};

export const fallbackServices: Service[] = [
    {
        name: "Esmaltação em Gel Decorada",
        description:
            "Esmaltação em gel com decoração personalizada e acabamento exclusivo.",
        duration: "2h",
        durationMinutes: 120,
        price: "R$ 70,00",
        priceCents: 7000,
    },
    {
        name: "Esmaltação em Gel Básica",
        description:
            "Acabamento elegante, duradouro e com brilho intenso para suas unhas.",
        duration: "1h30",
        durationMinutes: 90,
        price: "R$ 60,00",
        priceCents: 6000,
    },
    {
        name: "Reparo de Unha (Unitário)",
        description:
            "Reparo rápido e cuidadoso para recuperar uma unha danificada.",
        duration: "20 min",
        durationMinutes: 20,
        price: "R$ 10,00",
        priceCents: 1000,
    },
];

export function formatDateForInput(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

export function timeToMinutes(time: string) {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
}

export function minutesToTime(totalMinutes: number) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function mergeIntervals(intervals: TimeInterval[]) {
    const sorted = [...intervals].sort((a, b) => a.start - b.start);

    return sorted.reduce<TimeInterval[]>((merged, current) => {
        const previous = merged[merged.length - 1];

        if (!previous || current.start > previous.end) {
            merged.push({...current});
            return merged;
        }

        previous.end = Math.max(previous.end, current.end);
        return merged;
    }, []);
}

export function intervalsOverlap(
    firstStart: number,
    firstEnd: number,
    secondStart: number,
    secondEnd: number,
) {
    return firstStart < secondEnd && firstEnd > secondStart;
}

export const CLIENT_WEEKDAY_START_MINUTES = [
    7 * 60,   // 07:00
    9 * 60,   // 09:00
    11 * 60,  // 11:00
    13 * 60,  // 13:00
    17 * 60,  // 17:00
    19 * 60,  // 19:00
    21 * 60,  // 21:00
] as const;

export const CLIENT_WEEKEND_START_MINUTES = [
    7 * 60,   // 07:00
    9 * 60,   // 09:00
    11 * 60,  // 11:00
    13 * 60,  // 13:00
] as const;

export const ADMIN_WEEKDAY_START_MINUTES = [
    7 * 60,        // 07:00
    7 * 60 + 30,   // 07:30
    8 * 60,        // 08:00
    8 * 60 + 30,   // 08:30
    9 * 60,        // 09:00
    9 * 60 + 30,   // 09:30
    10 * 60,       // 10:00
    10 * 60 + 30,  // 10:30
    11 * 60,       // 11:00
    11 * 60 + 30,  // 11:30
    12 * 60,       // 12:00
    12 * 60 + 30,  // 12:30
    13 * 60,       // 13:00
    17 * 60,       // 17:00
    17 * 60 + 30,  // 17:30
    18 * 60,       // 18:00
    18 * 60 + 30,  // 18:30
    19 * 60,       // 19:00
    19 * 60 + 30,  // 19:30
    20 * 60,       // 20:00
    20 * 60 + 30,  // 20:30
    21 * 60,       // 21:00
] as const;

export const ADMIN_WEEKEND_START_MINUTES = [
    7 * 60,        // 07:00
    7 * 60 + 30,   // 07:30
    8 * 60,        // 08:00
    8 * 60 + 30,   // 08:30
    9 * 60,        // 09:00
    9 * 60 + 30,   // 09:30
    10 * 60,       // 10:00
    10 * 60 + 30,  // 10:30
    11 * 60,       // 11:00
    11 * 60 + 30,  // 11:30
    12 * 60,       // 12:00
    12 * 60 + 30,  // 12:30
    13 * 60,       // 13:00
] as const;

export function isWeekendDate(date: string) {
    const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
    return dayOfWeek === 0 || dayOfWeek === 6;
}

export function getFixedClientStartMinutes(date: string) {
    if (!date) return [] as number[];

    // ÚNICA fonte da grade pública de horários.
    // Todas as clientes, antigas ou novas, passam por esta mesma função.
    return isWeekendDate(date)
        ? [...CLIENT_WEEKEND_START_MINUTES]
        : [...CLIENT_WEEKDAY_START_MINUTES];
}

export function getFixedAdminManualStartMinutes(date: string) {
    if (!date) return [] as number[];

    // Grade exclusiva do painel ADM para criar/editar agendamentos.
    return isWeekendDate(date)
        ? [...ADMIN_WEEKEND_START_MINUTES]
        : [...ADMIN_WEEKDAY_START_MINUTES];
}

export function getConfiguredClientStartMinutes(
    date: string,
    overrides: ScheduleTimeOverride[] = [],
) {
    if (!date) return [] as number[];

    const baseStarts = getFixedClientStartMinutes(date);
    const dateOverrides = overrides.filter(
        (item) => item.override_date === date,
    );

    const removedStarts = new Set(
        dateOverrides
            .filter((item) => !item.is_available)
            .map((item) => timeToMinutes(String(item.start_time).slice(0, 5))),
    );

    const addedStarts = dateOverrides
        .filter((item) => item.is_available)
        .map((item) => timeToMinutes(String(item.start_time).slice(0, 5)));

    return [...new Set([...baseStarts, ...addedStarts])]
        .filter((start) => !removedStarts.has(start))
        .sort((a, b) => a - b);
}

export function normalizeBrazilianPhoneDigits(value: string) {
    let digits = value.replace(/\D/g, "");

    // Se vier com código do país (+55), remove antes de formatar.
    // Ex.: 5548999999999 -> 48999999999.
    if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
        digits = digits.slice(2);
    }

    return digits.slice(0, 11);
}

export function formatBrazilianPhone(value: string) {
    const digits = normalizeBrazilianPhoneDigits(value);

    if (digits.length <= 2) {
        return digits.length ? `(${digits}` : "";
    }

    if (digits.length <= 6) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    }

    if (digits.length <= 10) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }

    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function formatCurrency(priceCents: number) {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
    }).format(priceCents / 100);
}

export function formatDuration(minutes: number) {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes ? `${hours}h${String(remainingMinutes).padStart(2, "0")}` : `${hours}h`;
}

export const MIRIAN_ADMIN_EMAIL = "mirian201420@gmail.com";
