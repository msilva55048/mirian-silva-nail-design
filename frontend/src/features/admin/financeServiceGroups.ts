const GEL_FINANCE_GROUP = "gel-service";
const GEL_DURATION_MINUTES = 90;

const gelHistoricalNames = new Set([
    "esmaltação em gel básica",
    "esmaltação em gel básica com blindagem",
    "esmaltação em gel com blindagem",
    "esmaltação em gel wcom blindagem",
].map(normalizeFinanceServiceName));

type FinanceSummaryEntry = {
    serviceName: string;
    durationMinutes: number;
    priceCents: number | null;
    isCompleted: boolean;
};

type CurrentFinanceService = {
    name: string;
    durationMinutes: number;
};

function normalizeFinanceServiceName(serviceName: string) {
    return serviceName
        .trim()
        .toLocaleLowerCase("pt-BR")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function getCurrentGelService(currentServices: CurrentFinanceService[]) {
    const candidates = currentServices.filter(
        (service) => service.durationMinutes === GEL_DURATION_MINUTES,
    );
    return candidates.length === 1 ? candidates[0] : null;
}

function getFinanceGroupKey(
    entry: FinanceSummaryEntry,
    currentGelService: CurrentFinanceService | null,
) {
    if (gelHistoricalNames.has(normalizeFinanceServiceName(entry.serviceName))) {
        return GEL_FINANCE_GROUP;
    }

    // A duração só reconhece a renomeação do grupo já consolidado; não cria
    // agrupamento global entre todos os serviços que tenham a mesma duração.
    if (
        currentGelService &&
        entry.durationMinutes === GEL_DURATION_MINUTES &&
        normalizeFinanceServiceName(entry.serviceName) ===
            normalizeFinanceServiceName(currentGelService.name)
    ) {
        return GEL_FINANCE_GROUP;
    }

    return entry.serviceName;
}

export function summarizeFinanceServices(
    entries: FinanceSummaryEntry[],
    currentServices: CurrentFinanceService[],
) {
    const currentGelService = getCurrentGelService(currentServices);
    const summary = new Map<string, {
        serviceName: string;
        completedCount: number;
        completedCents: number;
        scheduledCount: number;
        scheduledCents: number;
    }>();

    entries.forEach((entry) => {
        const groupKey = getFinanceGroupKey(entry, currentGelService);
        const current = summary.get(groupKey) ?? {
            serviceName:
                groupKey === GEL_FINANCE_GROUP && currentGelService
                    ? currentGelService.name
                    : entry.serviceName,
            completedCount: 0,
            completedCents: 0,
            scheduledCount: 0,
            scheduledCents: 0,
        };

        if (entry.isCompleted) {
            current.completedCount += 1;
            current.completedCents += entry.priceCents ?? 0;
        } else {
            current.scheduledCount += 1;
            current.scheduledCents += entry.priceCents ?? 0;
        }

        summary.set(groupKey, current);
    });

    return Array.from(summary.values()).sort(
        (a, b) => (b.completedCents + b.scheduledCents) - (a.completedCents + a.scheduledCents),
    );
}
