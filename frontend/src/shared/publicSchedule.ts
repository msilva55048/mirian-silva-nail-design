export type BookingHoliday = {
    date: string;
    name: string;
    scope: "Nacional" | "Estadual - Santa Catarina" | "Municipal - São José/SC";
    legalBasis: string;
};

const NATIONAL_FIXED_DATES = [
    ["01-01", "Confraternização Universal", "Lei 662/1949, com alterações da Lei 10.607/2002"],
    ["04-21", "Tiradentes", "Lei 662/1949, com alterações da Lei 10.607/2002"],
    ["05-01", "Dia Mundial do Trabalho", "Lei 662/1949, com alterações da Lei 10.607/2002"],
    ["09-07", "Independência do Brasil", "Lei 662/1949, com alterações da Lei 10.607/2002"],
    ["10-12", "Nossa Senhora Aparecida", "Lei 6.802/1980"],
    ["11-02", "Finados", "Lei 662/1949, com alterações da Lei 10.607/2002"],
    ["11-15", "Proclamação da República", "Lei 662/1949, com alterações da Lei 10.607/2002"],
    ["11-20", "Dia Nacional de Zumbi e da Consciência Negra", "Lei 14.759/2023"],
    ["12-25", "Natal", "Lei 662/1949, com alterações da Lei 10.607/2002"],
] as const;

function easterSunday(year: number): string {
    // Computus gregoriano de Meeus/Jones/Butcher.
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

function dateOffset(date: Date, offset: number) {
    const result = new Date(date);
    result.setUTCDate(result.getUTCDate() + offset);
    return result.toISOString().slice(0, 10);
}

function observedSantaCatarinaDay(year: number) {
    const augustEleventh = new Date(Date.UTC(year, 7, 11));
    const weekday = augustEleventh.getUTCDay();
    // O calendário estadual aplica a transferência quando 11/08 cai de segunda a sábado.
    return weekday >= 1 && weekday <= 6 ? dateOffset(augustEleventh, 7 - weekday) : dateOffset(augustEleventh, 0);
}

export function getBookingHolidays(year: number): BookingHoliday[] {
    if (year < 2027 || year > 2040) return [];
    const national = NATIONAL_FIXED_DATES.map(([monthDay, name, legalBasis]) => ({
        date: `${year}-${monthDay}`,
        name,
        scope: "Nacional" as const,
        legalBasis,
    }));
    const easter = new Date(`${easterSunday(year)}T12:00:00Z`);
    const goodFriday = new Date(easter);
    goodFriday.setUTCDate(goodFriday.getUTCDate() - 2);
    const corpusChristi = new Date(easter);
    corpusChristi.setUTCDate(corpusChristi.getUTCDate() + 60);
    const municipal = [
        {
            date: `${year}-03-19`,
            name: "Aniversário de São José (Dia de São José)",
            scope: "Municipal - São José/SC" as const,
            legalBasis: "Lei municipal 17/1950; feriado religioso conforme Lei municipal 1.650/1985, com redação da Lei 2.302/1991",
        },
        {
            date: dateOffset(goodFriday, 0),
            name: "Sexta-feira da Paixão",
            scope: "Municipal - São José/SC" as const,
            legalBasis: "Lei federal 9.093/1995, art. 2º; Lei municipal 1.650/1985, com redação da Lei 2.302/1991",
        },
        {
            date: dateOffset(corpusChristi, 0),
            name: "Corpus Christi",
            scope: "Municipal - São José/SC" as const,
            legalBasis: "Lei municipal 1.650/1985, com redação da Lei 2.302/1991; Decretos municipais 20.828/2024 e 23.649/2025",
        },
    ];
    return [
        ...national,
        {
            date: observedSantaCatarinaDay(year),
            name: "Dia do Estado de Santa Catarina (Data Magna)",
            scope: "Estadual - Santa Catarina" as const,
            legalBasis: "Lei estadual 18.531/2022, Anexo Único (Lei 12.906/2004 e Lei 13.408/2005)",
        },
        ...municipal,
    ].sort((a, b) => a.date.localeCompare(b.date));
}

const HOLIDAYS_BY_DATE = new Map(
    Array.from({length: 14}, (_, index) => 2027 + index)
        .flatMap(getBookingHolidays)
        .map((holiday) => [holiday.date, holiday] as const),
);

export function getBookingHoliday(date: string) {
    return HOLIDAYS_BY_DATE.get(date);
}

export function isPublicBookingDateClosed(date: string): boolean {
    if (date >= "2026-10-21" && date <= "2026-10-26") return true;
    if (date >= "2026-11-01" && new Date(`${date}T12:00:00`).getDay() === 0) return true;
    return false;
}

export function getPublicBaseStartMinutes(date: string): number[] {
    if (!date || isPublicBookingDateClosed(date)) return [];
    const day = new Date(`${date}T12:00:00`).getDay();
    if (day === 0 || day === 6) return [7 * 60, 9 * 60, 11 * 60, 13 * 60];
    if (date < "2026-10-02") return [7 * 60, 19 * 60 + 30, 21 * 60];
    return [7 * 60, 9 * 60, 11 * 60, 13 * 60, 17 * 60, 19 * 60];
}
