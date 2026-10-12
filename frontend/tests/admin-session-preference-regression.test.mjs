import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const appSource = readFileSync(
    process.env.MIRIAN_AUTH_APP_SOURCE ?? new URL("../src/App.tsx", import.meta.url),
    "utf8",
);
const sourceFile = ts.createSourceFile("App.tsx", appSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const ADMIN_EMAIL = "mirian201420@gmail.com";

function getClientAuthEffect() {
    let callbackSource;
    const visit = (node) => {
        if (
            ts.isCallExpression(node) &&
            node.expression.getText(sourceFile) === "useEffect" &&
            node.arguments[0]?.getText(sourceFile).includes("initializeClientSession")
        ) {
            callbackSource = node.arguments[0].getText(sourceFile);
        }
        ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    assert.ok(callbackSource, "the real client auth effect exists in App.tsx");
    return new Function(ts.transpile(`const extractedEffect = ${callbackSource}; return extractedEffect;`))();
}

function getAdminAuthEffect() {
    let callbackSource;
    const visit = (node) => {
        if (
            ts.isCallExpression(node) &&
            node.expression.getText(sourceFile) === "useEffect" &&
            node.arguments[0]?.getText(sourceFile).includes("sessionIsMirianAdmin")
        ) {
            callbackSource = node.arguments[0].getText(sourceFile);
        }
        ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    assert.ok(callbackSource, "the real Admin auth effect exists in App.tsx");
    return new Function(ts.transpile(`const extractedEffect = ${callbackSource}; return extractedEffect;`))();
}

function getFunctionSource(name) {
    let functionNode;
    const visit = (node) => {
        if (ts.isFunctionDeclaration(node) && node.name?.text === name) functionNode = node;
        ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    assert.ok(functionNode, `function ${name} exists in App.tsx`);
    return ts.transpile(functionNode.getText(sourceFile));
}

function deferred() {
    let resolve;
    const promise = new Promise((resolvePromise) => { resolve = resolvePromise; });
    return {promise, resolve};
}

async function flushMicrotasks() {
    for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

function createHarness({getSession, initialMode = "admin"} = {}) {
    const state = {mode: initialMode, clientUserId: null, email: "", profile: null, appointments: [], summary: null, name: "", phone: "", activeReferrals: [], authMode: "login", showAuth: false, checking: true, loading: false, showClientAccount: false};
    const clientAuthRequestIdRef = {current: 0};
    const clientAuthUserIdRef = {current: null};
    const pendingReferralCodeRef = {current: null};
    const redirects = [];
    const loadedUsers = [];
    const timers = [];
    let authListener = null;
    let unsubscribeCount = 0;
    const set = (key) => (value) => { state[key] = value; };
    const supabase = {
        auth: {
            getSession: getSession ?? (async () => ({data: {session: null}})),
            onAuthStateChange(callback) {
                authListener = callback;
                return {data: {subscription: {unsubscribe() {
                    unsubscribeCount += 1;
                    if (authListener === callback) authListener = null;
                }}}};
            },
        },
    };
    const loadAuthenticatedClientRef = {current: (user, requestId) => loadedUsers.push({user, requestId})};
    const window = {
        location: {replace(path) { redirects.push(path); }},
        setTimeout(callback) { timers.push(callback); return timers.length; },
    };
    const effect = new Function(
        "supabase", "clientAuthRequestIdRef", "clientAuthUserIdRef", "MIRIAN_ADMIN_EMAIL",
        "getMirianLastAccessMode", "window", "setMirianLastAccessMode", "loadAuthenticatedClientRef",
        "loadAuthenticatedClient", "pendingReferralCode",
        "setClientUserId", "setClientUserEmail", "setClientProfile", "setClientAppointments",
        "setReferralSummary", "pendingReferralCodeRef", "setClientName", "setClientPhone",
        "setActiveReferrals", "setClientAuthMode", "setShowClientAuth", "setIsCheckingClientSession",
        "setRecoverySessionUserId", "setShowClientAccount", "setIsLoadingClientAccount",
        `return (${getClientAuthEffect().toString()});`,
    )(
        supabase, clientAuthRequestIdRef, clientAuthUserIdRef, ADMIN_EMAIL,
        () => state.mode, window, (mode) => { state.mode = mode; },
        loadAuthenticatedClientRef, (user) => loadedUsers.push({user}), null,
        set("clientUserId"), set("email"), set("profile"),
        set("appointments"), set("summary"), pendingReferralCodeRef, set("name"), set("phone"),
        set("activeReferrals"), set("authMode"), set("showAuth"), set("checking"),
        () => {}, set("showClientAccount"), set("loading"),
    );
    return {
        state, redirects, loadedUsers, timers, start: effect,
        trigger(event, session) { assert.ok(authListener, "auth listener is active"); authListener(event, session); },
        flushTimers() { timers.splice(0).forEach((callback) => callback()); },
        get unsubscribeCount() { return unsubscribeCount; },
    };
}

const adminSession = {user: {id: "mirian-user", email: ADMIN_EMAIL}};
const ordinarySession = {user: {id: "client-user", email: "client@example.test"}};

test("INITIAL_SESSION antes de getSession restaura ADMIN pela raiz sem gravar CLIENTE", async () => {
    const pendingSession = deferred();
    const h = createHarness({getSession: () => pendingSession.promise});
    const cleanup = h.start();

    h.trigger("INITIAL_SESSION", adminSession);
    h.flushTimers();
    assert.deepEqual(h.redirects, ["/admin"]);
    assert.equal(h.state.mode, "admin");
    assert.deepEqual(h.loadedUsers, []);

    pendingSession.resolve({data: {session: adminSession}});
    await flushMicrotasks();
    assert.equal(h.state.mode, "admin");
    cleanup();
});

test("getSession resolvendo antes de INITIAL_SESSION restaura ADMIN sem preferência CLIENTE", async () => {
    const h = createHarness({getSession: async () => ({data: {session: adminSession}})});
    const cleanup = h.start();
    await flushMicrotasks();
    assert.deepEqual(h.redirects, ["/admin"]);

    h.trigger("INITIAL_SESSION", adminSession);
    h.flushTimers();
    assert.equal(h.state.mode, "admin");
    assert.ok(h.redirects.every((path) => path === "/admin"));
    cleanup();
});

test("SIGNED_IN recebido em outra aba não sobrescreve a escolha ADMIN", async () => {
    const pendingSession = deferred();
    const h = createHarness({getSession: () => pendingSession.promise});
    const cleanup = h.start();
    h.trigger("SIGNED_IN", adminSession);
    assert.equal(h.state.mode, "admin");
    h.flushTimers();
    assert.equal(h.loadedUsers.length, 1);

    pendingSession.resolve({data: {session: adminSession}});
    await flushMicrotasks();
    assert.deepEqual(h.redirects, []);
    assert.equal(h.state.mode, "admin");
    cleanup();
});

test("TOKEN_REFRESHED preserva preferência ADMIN", () => {
    const h = createHarness();
    const cleanup = h.start();
    h.trigger("TOKEN_REFRESHED", adminSession);
    assert.equal(h.state.mode, "admin");
    assert.deepEqual(h.timers, []);
    cleanup();
});

test("preferência CLIENTE explícita é restaurada sem redirecionar para ADMIN", async () => {
    const h = createHarness({initialMode: "client", getSession: async () => ({data: {session: adminSession}})});
    const cleanup = h.start();
    await flushMicrotasks();
    assert.deepEqual(h.redirects, []);
    assert.equal(h.loadedUsers[0]?.user.id, "mirian-user");
    assert.equal(h.state.mode, "client");
    cleanup();
});

test("helper persiste ADMIN/CLIENTE em localStorage entre inicializações", () => {
    const values = new Map();
    const window = {localStorage: {
        getItem(key) { return values.get(key) ?? null; },
        setItem(key, value) { values.set(key, value); },
        removeItem(key) { values.delete(key); },
    }};
    const helpers = new Function(
        "window",
        `const MIRIAN_LAST_MODE_KEY = "mirian-last-access-mode"; ${getFunctionSource("getMirianLastAccessMode")}; ${getFunctionSource("setMirianLastAccessMode")}; ${getFunctionSource("clearMirianLastAccessMode")}; return {getMirianLastAccessMode, setMirianLastAccessMode, clearMirianLastAccessMode};`,
    )(window);

    helpers.setMirianLastAccessMode("admin");
    assert.equal(helpers.getMirianLastAccessMode(), "admin");
    const reopenedHelpers = new Function(
        "window",
        `const MIRIAN_LAST_MODE_KEY = "mirian-last-access-mode"; ${getFunctionSource("getMirianLastAccessMode")}; return getMirianLastAccessMode;`,
    )(window);
    assert.equal(reopenedHelpers(), "admin");
    helpers.setMirianLastAccessMode("client");
    assert.equal(reopenedHelpers(), "client");
    helpers.clearMirianLastAccessMode();
    assert.equal(reopenedHelpers(), null);
});

test("preferência ADMIN não autoriza usuário comum nem causa redirecionamento", () => {
    const h = createHarness();
    const cleanup = h.start();
    h.trigger("INITIAL_SESSION", ordinarySession);
    h.flushTimers();
    assert.deepEqual(h.redirects, []);
    assert.equal(h.loadedUsers[0]?.user.id, "client-user");
    assert.equal(h.state.mode, "admin");
    cleanup();
});

test("bootstrap real do ADMIN nega usuário comum mesmo com preferência ADMIN no localStorage", async () => {
    const state = {authenticated: false, checking: true, mode: "admin"};
    const authBootstrapRef = {current: {sessionRead: false, initialEventSeen: false}};
    let listener;
    const supabase = {auth: {
        async getSession() { return {data: {session: ordinarySession}}; },
        onAuthStateChange(callback) {
            listener = callback;
            return {data: {subscription: {unsubscribe() { listener = null; }}}};
        },
    }};
    const adminEffect = new Function(
        "supabase", "MIRIAN_ADMIN_EMAIL", "setIsAuthenticated", "setIsCheckingSession",
        "authBootstrapRef", "setMirianLastAccessMode", "clearNailRecordsForSelectionChange",
        `return (${getAdminAuthEffect().toString()});`,
    )(
        supabase, ADMIN_EMAIL, (value) => { state.authenticated = value; },
        (value) => { state.checking = value; }, authBootstrapRef,
        (mode) => { state.mode = mode; }, () => {},
    );
    const cleanup = adminEffect();
    await flushMicrotasks();
    listener("INITIAL_SESSION", ordinarySession);
    assert.equal(state.authenticated, false);
    assert.equal(state.checking, false);
    assert.equal(state.mode, "admin");
    cleanup();
});

test("sessão ausente ou expirada não redireciona e mantém a página pública disponível", async () => {
    const h = createHarness({initialMode: "admin", getSession: async () => ({data: {session: null}})});
    const cleanup = h.start();
    await flushMicrotasks();
    assert.deepEqual(h.redirects, []);
    assert.equal(h.state.clientUserId, null);
    assert.equal(h.state.checking, false);
    h.trigger("INITIAL_SESSION", null);
    h.flushTimers();
    assert.deepEqual(h.redirects, []);
    cleanup();
});

test("StrictMode limpa listener da primeira montagem e ignora sua resposta atrasada", async () => {
    const sessions = [deferred(), deferred()];
    let read = 0;
    const h = createHarness({getSession: () => sessions[read++].promise});
    const cleanupFirstMount = h.start();
    cleanupFirstMount();
    const cleanupSecondMount = h.start();
    assert.equal(h.unsubscribeCount, 1);

    sessions[0].resolve({data: {session: ordinarySession}});
    await flushMicrotasks();
    assert.deepEqual(h.loadedUsers, []);

    h.trigger("INITIAL_SESSION", adminSession);
    h.flushTimers();
    assert.deepEqual(h.redirects, ["/admin"]);
    sessions[1].resolve({data: {session: adminSession}});
    await flushMicrotasks();
    assert.equal(h.state.mode, "admin");
    cleanupSecondMount();
    assert.equal(h.unsubscribeCount, 2);
});

test("login explícito no painel grava ADMIN após validar a conta", async () => {
    const state = {email: ADMIN_EMAIL, password: "test-password", authenticated: false, loggingIn: false, error: ""};
    const writtenModes = [];
    const supabase = {auth: {async signInWithPassword() {
        return {data: {user: {email: ADMIN_EMAIL}}, error: null};
    }, async signOut() { throw new Error("unexpected sign-out"); }}};
    const handleLogin = new Function(
        "supabase", "MIRIAN_ADMIN_EMAIL", "setLoginError", "setIsLoggingIn", "email", "password",
        "setMirianLastAccessMode", "setPassword", "setIsAuthenticated",
        `${getFunctionSource("handleLogin")}; return handleLogin;`,
    )(
        supabase, ADMIN_EMAIL, (value) => { state.error = value; }, (value) => { state.loggingIn = value; },
        state.email, state.password, (mode) => writtenModes.push(mode), () => { state.password = ""; },
        (value) => { state.authenticated = value; },
    );
    await handleLogin({preventDefault() {}});
    assert.deepEqual(writtenModes, ["admin"]);
    assert.equal(state.authenticated, true);
    assert.equal(state.password, "");
});

test("login explícito pelo formulário da cliente grava CLIENTE e restaura essa escolha", async () => {
    const state = {mode: "admin", submitting: false};
    const supabase = {auth: {async signInWithPassword() {
        return {data: {user: {id: "mirian-user", email: ADMIN_EMAIL}}, error: null};
    }}};
    const submitClientAuth = new Function(
        "supabase", "MIRIAN_ADMIN_EMAIL", "clientAuthMode", "authEmail", "authPassword",
        "authPhone", "authFullName", "event", "resetAuthMessages", "setAuthError",
        "setIsSubmittingAuth", "formatBrazilianPhone", "setMirianLastAccessMode",
        "loadAuthenticatedClient", "setShowClientAuth", "setShowClientAccount",
        "setShowAuthPassword", "setAuthPassword", "setAuthSuccess",
        "isExistingEmailSignupError", "EXISTING_EMAIL_SIGNUP_MESSAGE",
        `${getFunctionSource("submitClientAuth")}; return submitClientAuth;`,
    )(
        supabase, ADMIN_EMAIL, "login", ADMIN_EMAIL, "test-password", "", "",
        {preventDefault() {}}, () => {}, () => {}, (value) => { state.submitting = value; },
        (value) => value, (mode) => { state.mode = mode; }, async () => {},
        () => {}, () => {}, () => {}, () => {}, () => {}, () => false, "existing email",
    );
    await submitClientAuth({preventDefault() {}});
    assert.equal(state.mode, "client");
    assert.equal(state.submitting, false);

    const reopened = createHarness({initialMode: state.mode, getSession: async () => ({data: {session: adminSession}})});
    const cleanup = reopened.start();
    await flushMicrotasks();
    assert.deepEqual(reopened.redirects, []);
    assert.equal(reopened.loadedUsers[0]?.user.id, "mirian-user");
    cleanup();
});

test("SIGNED_OUT limpa a conta cliente e eventos de sessão não escolhem a área", () => {
    const h = createHarness({initialMode: "client"});
    h.state.clientUserId = "mirian-user";
    h.state.email = ADMIN_EMAIL;
    h.state.profile = {id: "profile-mirian"};
    const cleanup = h.start();
    h.trigger("SIGNED_OUT", null);
    h.flushTimers();
    assert.equal(h.state.clientUserId, null);
    assert.equal(h.state.profile, null);
    assert.equal(h.state.showClientAccount, false);

    h.trigger("SIGNED_IN", adminSession);
    h.flushTimers();
    assert.equal(h.state.mode, "client");
    assert.equal(h.loadedUsers.at(-1)?.user.id, "mirian-user");
    cleanup();
});
