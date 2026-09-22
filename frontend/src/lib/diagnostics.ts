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
const wasDiscarded = () => (document as Document & {wasDiscarded?: boolean}).wasDiscarded === true;

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
        ? `navigation=${performance.getEntriesByType("navigation")[0]?.toJSON?.().type ?? "unknown"};wasDiscarded=${wasDiscarded()}`
        : `navigation=unknown;wasDiscarded=${wasDiscarded()}`,
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
    window.addEventListener("freeze", () => recordDiagnostic("PAGE_FREEZE"));
    window.addEventListener("resume", () => recordDiagnostic("PAGE_RESUME"));
    navigator.serviceWorker?.addEventListener("controllerchange", () => recordDiagnostic("SW_CONTROLLER_CHANGE"));
    void navigator.serviceWorker?.getRegistration("/").then((registration) => {
        if (!registration) {
            recordDiagnostic("SW_REGISTRATION", {detail: "none"});
            return;
        }
        recordDiagnostic("SW_REGISTRATION", {detail: `state=${registration.active?.state ?? "none"};waiting=${registration.waiting ? "true" : "false"}`});
        registration.addEventListener("updatefound", () => {
            recordDiagnostic("SW_UPDATE_FOUND");
            registration.installing?.addEventListener("statechange", () => {
                recordDiagnostic("SW_STATE_CHANGE", {detail: `state=${registration.installing?.state ?? "unknown"}`});
            });
        });
    });
    window.addEventListener("popstate", recordPathname);
    window.addEventListener("hashchange", recordPathname);
    window.addEventListener("error", (event) => recordDiagnostic("WINDOW_ERROR", {
        detail: `${event.error?.name ?? "unknown-error"}:${String(event.message ?? "").slice(0, 120)}`,
    }));
    window.addEventListener("unhandledrejection", (event) => recordDiagnostic("UNHANDLED_REJECTION", {
        detail: String(event.reason?.name ?? event.reason?.message ?? "unknown-rejection").slice(0, 120),
    }));
    document.addEventListener("click", (event) => {
        const target = (event.target as HTMLElement | null)?.closest("button,a");
        if (!target) return;
        recordDiagnostic("CLICK", {
            detail: `${target.tagName.toLowerCase()};type=${target instanceof HTMLButtonElement ? target.type : "link"};href=${target instanceof HTMLAnchorElement ? new URL(target.href, window.location.href).pathname : "none"};id=${target.id || "none"}`,
        });
    }, true);
    document.addEventListener("submit", (event) => {
        const form = event.target as HTMLFormElement;
        recordDiagnostic("FORM_SUBMIT", {
            detail: `id=${form.id || "none"};target=${form.target || "none"};action=${form.action ? new URL(form.action, window.location.href).pathname : "none"}`,
        });
    }, true);
    document.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === "Escape") recordDiagnostic("KEYDOWN", {detail: `key=${event.key}`});
    }, true);
}
