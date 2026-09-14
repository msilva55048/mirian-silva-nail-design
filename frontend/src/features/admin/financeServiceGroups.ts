export const CONSOLIDATED_GEL_SERVICE_NAME = "Esmaltação em Gel Básica";

const consolidatedGelServiceNames = new Set([
    "esmaltação em gel básica",
    "esmaltação em gel básica com blindagem",
    "esmaltação em gel com blindagem",
    // Variante histórica digitada no cadastro; pertence ao mesmo serviço lógico.
    "esmaltação em gel wcom blindagem",
].map(normalizeFinanceServiceName));

function normalizeFinanceServiceName(serviceName: string) {
    return serviceName
        .trim()
        .toLocaleLowerCase("pt-BR")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

export function getFinanceServiceSummaryName(serviceName: string) {
    return consolidatedGelServiceNames.has(normalizeFinanceServiceName(serviceName))
        ? CONSOLIDATED_GEL_SERVICE_NAME
        : serviceName;
}

type FinanceSummaryEntry = {
    serviceName: string;
    priceCents: number | null;
    isCompleted: boolean;
};

export function summarizeFinanceServices(entries: FinanceSummaryEntry[]) {
    const summary = new Map<string, {
        serviceName: string;
        completedCount: number;
        completedCents: number;
        scheduledCount: number;
        scheduledCents: number;
    }>();

    entries.forEach((entry) => {
        const serviceName = getFinanceServiceSummaryName(entry.serviceName);
        const current = summary.get(serviceName) ?? {
            serviceName,
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

        summary.set(serviceName, current);
    });

    return Array.from(summary.values()).sort(
        (a, b) => (b.completedCents + b.scheduledCents) - (a.completedCents + a.scheduledCents),
    );
}
