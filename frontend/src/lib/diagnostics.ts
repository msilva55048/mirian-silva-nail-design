const STORAGE_KEY = "mirian-diagnostic-events";
const MAX_EVENTS = 150;

export type DiagnosticEvent = {
    at: string;
    type: string;
    pageInstanceId: string;
    sessionPresent?: boolean;
    pathname?: string;
    detail?: string;
};

const pageInstanceId = crypto.randomUUID();

function safePathname() {
    return window.location.pathname || "/";
}

function readEvents(): DiagnosticEvent[] {
    try {
        const value = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]");
        return Array.isArray(value) ? value : [];
    } catch {
        return [];
    }
}

export function recordDiagnostic(type: string, details: Omit<DiagnosticEvent, "at" | "type" | "pageInstanceId"> = {}) {
    if (typeof window === "undefined") return;
    const event: DiagnosticEvent = {
        at: new Date().toISOString(),
        type,
        pageInstanceId,
        ...details,
    };
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...readEvents(), event].slice(-MAX_EVENTS)));
    } catch {
        // Diagnostics must never affect the application when storage is unavailable.
    }
}

export function getDiagnosticEvents() {
    return readEvents();
}

export function clearDiagnosticEvents() {
    try {
        sessionStorage.removeItem(STORAGE_KEY);
    } catch {
        // Ignore unavailable storage.
    }
}

export function formatDiagnosticEvents() {
    return getDiagnosticEvents().map((event) => JSON.stringify(event)).join("\n");
}

recordDiagnostic("PAGE_INIT", {
    pathname: safePathname(),
    detail: typeof performance !== "undefined"
        ? `navigation=${performance.getEntriesByType("navigation")[0]?.toJSON?.().type ?? "unknown"}`
        : "navigation=unknown",
});

if (typeof window !== "undefined") {
    let lastPathname = safePathname();
    const recordPathname = () => {
        const pathname = safePathname();
        if (pathname === lastPathname) return;
        lastPathname = pathname;
        recordDiagnostic("PATHNAME_CHANGED", {pathname});
    };

    document.addEventListener("visibilitychange", () => recordDiagnostic(
        document.visibilityState === "visible" ? "VISIBILITY_VISIBLE" : "VISIBILITY_HIDDEN",
    ));
    window.addEventListener("focus", () => recordDiagnostic("WINDOW_FOCUS"));
    window.addEventListener("blur", () => recordDiagnostic("WINDOW_BLUR"));
    window.addEventListener("online", () => recordDiagnostic("ONLINE"));
    window.addEventListener("offline", () => recordDiagnostic("OFFLINE"));
    window.addEventListener("beforeunload", () => recordDiagnostic("BEFORE_UNLOAD"));
    window.addEventListener("pagehide", (event) => recordDiagnostic("PAGE_HIDE", {detail: `persisted=${event.persisted}`}));
    window.addEventListener("pageshow", (event) => recordDiagnostic("PAGE_SHOW", {detail: `persisted=${event.persisted}`}));
    window.addEventListener("popstate", recordPathname);
    window.addEventListener("hashchange", recordPathname);
    window.addEventListener("error", (event) => recordDiagnostic("WINDOW_ERROR", {
        detail: event.error?.name ?? "unknown-error",
    }));
    window.addEventListener("unhandledrejection", () => recordDiagnostic("UNHANDLED_REJECTION"));
}
