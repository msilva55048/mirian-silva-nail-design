import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const tree = ts.createSourceFile("App.tsx", app, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function functionSource(name) {
    let result;
    const walk = (node) => {
        if (ts.isFunctionDeclaration(node) && node.name?.text === name) result = node.getText(tree);
        ts.forEachChild(node, walk);
    };
    walk(tree);
    assert.ok(result, `function ${name} exists`);
    return ts.transpile(result);
}

function effectSource(marker) {
    let result;
    const walk = (node) => {
        if (ts.isCallExpression(node) && node.expression.getText(tree) === "useEffect") {
            const callback = node.arguments[0];
            if (callback?.getText(tree).includes(marker)) result = callback.getText(tree);
        }
        ts.forEachChild(node, walk);
    };
    walk(tree);
    assert.ok(result, `useEffect callback containing ${marker} exists`);
    return ts.transpile(`const __extractedEffect = ${result};`) + "\nreturn __extractedEffect;";
}

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return {promise, resolve, reject};
}

const flushMicrotasks = async () => {
    for (let index = 0; index < 8; index += 1) await Promise.resolve();
};

function authHarness({profileRpc} = {}) {
    const calls = [];
    const state = {loading: false, userId: null, email: "", profile: null, name: "", phone: "", appointments: [], summary: null, activeReferrals: [], checking: true, accountOpen: true, authMode: "login"};
    const clientAuthRequestIdRef = {current: 0};
    const clientAuthUserIdRef = {current: null};
    const pendingReferralCodeRef = {current: null};
    const set = (key) => (value) => { state[key] = value; calls.push([key, value]); };
    const supabase = {rpc: profileRpc ?? (async (name) => name === "get_my_client_profile" ? {data: {id: "profile-default", full_name: "Cliente", phone: "48999990000"}, error: null} : {data: null, error: null})};
    const normalizeRpcRow = (data) => Array.isArray(data) ? data[0] ?? null : data;
    const loadClientAppointments = async (profileId, isCurrent) => {
        if (isCurrent()) state.appointments = [{client_id: profileId}];
    };
    const resolveClientProfile = new Function(
        "supabase", "normalizeRpcRow", "setClientProfile", "setAuthError", "setClientName", "setClientPhone", "formatBrazilianPhone", "loadClientAppointments", "setClientAppointments",
        `${functionSource("resolveClientProfile")}; return resolveClientProfile;`,
    )(supabase, normalizeRpcRow, set("profile"), set("authError"), set("name"), set("phone"), (value) => value, loadClientAppointments, set("appointments"));
    const registerPendingReferral = async (userId, isCurrent) => { calls.push(["registerReferral", userId, isCurrent()]); };
    const loadReferralSummary = async (userId, isCurrent) => { calls.push(["loadReferral", userId, isCurrent()]); };
    const loadAuthenticatedClient = new Function(
        "clientAuthRequestIdRef", "clientAuthUserIdRef", "setIsLoadingClientAccount", "setClientUserId", "setClientUserEmail", "resolveClientProfile", "registerPendingReferral", "loadReferralSummary", "setReferralSummary", "setAuthError", "setClientProfile", "setClientName", "setClientPhone", "setClientAppointments", "setActiveReferrals",
        `${functionSource("loadAuthenticatedClient")}; return loadAuthenticatedClient;`,
    )(clientAuthRequestIdRef, clientAuthUserIdRef, set("loading"), set("userId"), set("email"), resolveClientProfile, registerPendingReferral, loadReferralSummary, set("summary"), set("authError"), set("profile"), set("name"), set("phone"), set("appointments"), set("activeReferrals"));
    return {calls, state, clientAuthRequestIdRef, clientAuthUserIdRef, pendingReferralCodeRef, supabase, loadAuthenticatedClient, resolveClientProfile};
}

function createAuthEffectHarness({getSession, profileRpc} = {}) {
    const auth = authHarness({profileRpc});
    const timers = [];
    let listener;
    const set = (key) => (value) => { auth.state[key] = value; auth.calls.push([key, value]); };
    const supabase = {
        rpc: auth.supabase.rpc,
        auth: {
            getSession: getSession ?? (async () => ({data: {session: null}})),
            onAuthStateChange(callback) { listener = callback; return {data: {subscription: {unsubscribe() {}}}}; },
        },
    };
    const loaded = [];
    const loadAuthenticatedClientRef = {current: (user, requestId) => {
        const promise = auth.loadAuthenticatedClient(user, requestId);
        loaded.push({user, requestId, promise});
        return promise;
    }};
    const window = {location: {replace() {}}, setTimeout(callback) { timers.push(callback); return timers.length; }};
    const effect = new Function(
        "supabase", "clientAuthRequestIdRef", "clientAuthUserIdRef", "MIRIAN_ADMIN_EMAIL", "getMirianLastAccessMode", "window", "setMirianLastAccessMode", "loadAuthenticatedClientRef", "setClientUserId", "setClientUserEmail", "setClientProfile", "setClientAppointments", "setReferralSummary", "pendingReferralCodeRef", "setClientName", "setClientPhone", "setActiveReferrals", "setClientAuthMode", "setShowClientAuth", "setIsCheckingClientSession", "setRecoverySessionUserId", "setShowClientAccount", "setIsLoadingClientAccount",
        effectSource("initializeClientSession"),
    )(supabase, auth.clientAuthRequestIdRef, auth.clientAuthUserIdRef, "admin@example.test", () => "client", window, () => {}, loadAuthenticatedClientRef, set("userId"), set("email"), set("profile"), set("appointments"), set("summary"), auth.pendingReferralCodeRef, set("name"), set("phone"), set("activeReferrals"), set("authMode"), set("accountOpen"), set("checking"), () => {}, () => {}, set("loading"));
    const cleanup = effect();
    return {auth, timers, loaded, trigger(event, session) { listener(event, session); }, flushTimers() { timers.splice(0).forEach((callback) => callback()); }, cleanup};
}

test("login bem-sucedido mantém perfil, agendamentos e processamento de indicação", async () => {
    const h = createAuthEffectHarness({getSession: async () => ({data: {session: {user: {id: "user-a", email: "a@example.test"}}}})});
    await flushMicrotasks();
    await Promise.all(h.loaded.map((item) => item.promise));
    assert.equal(h.auth.state.userId, "user-a");
    assert.equal(h.auth.state.profile.id, "profile-default");
    assert.deepEqual(h.auth.state.appointments, [{client_id: "profile-default"}]);
    assert.ok(h.auth.calls.some(([name, userId]) => name === "registerReferral" && userId === "user-a"));
    assert.ok(h.auth.calls.some(([name, userId]) => name === "loadReferral" && userId === "user-a"));
    assert.equal(h.auth.state.loading, false);
    h.cleanup();
});

test("logout invalida perfil pendente e respostas de autenticação anteriores", async () => {
    const pendingProfile = deferred();
    const h = createAuthEffectHarness({
        getSession: async () => ({data: {session: null}}),
        profileRpc: () => pendingProfile.promise,
    });
    h.auth.state.name = "Conta anterior";
    h.auth.state.phone = "48999990003";
    h.auth.state.activeReferrals = [{referral_id: "old-referral"}];
    h.trigger("SIGNED_IN", {user: {id: "old-user", email: "old@example.test"}});
    h.flushTimers();
    assert.equal(h.loaded.length, 1);
    h.trigger("SIGNED_OUT", null);
    h.flushTimers();
    assert.equal(h.auth.state.userId, null);
    pendingProfile.resolve({data: {id: "old-profile", full_name: "Antiga", phone: "48999990001"}, error: null});
    await Promise.all(h.loaded.map((item) => item.promise));
    assert.equal(h.auth.state.userId, null);
    assert.equal(h.auth.state.profile, null);
    assert.deepEqual(h.auth.state.appointments, []);
    assert.equal(h.auth.state.name, "");
    assert.equal(h.auth.state.phone, "");
    assert.deepEqual(h.auth.state.activeReferrals, []);
    h.cleanup();
});

test("sessão inicial atrasada não restaura a conta após logout", async () => {
    const session = deferred();
    const h = createAuthEffectHarness({getSession: () => session.promise});
    h.trigger("SIGNED_OUT", null);
    h.flushTimers();
    session.resolve({data: {session: {user: {id: "stale-user", email: "stale@example.test"}}}});
    await flushMicrotasks();
    assert.equal(h.loaded.length, 0);
    assert.equal(h.auth.state.userId, null);
    assert.equal(h.auth.state.profile, null);
    h.cleanup();
});

test("callback de login já enfileirado é descartado se o logout chegar antes do timer", async () => {
    const h = createAuthEffectHarness({getSession: async () => ({data: {session: null}})});
    h.trigger("SIGNED_IN", {user: {id: "queued-user", email: "queued@example.test"}});
    h.trigger("SIGNED_OUT", null);
    h.flushTimers();
    await flushMicrotasks();
    assert.equal(h.loaded.length, 0);
    assert.equal(h.auth.state.userId, null);
    assert.equal(h.auth.state.profile, null);
    h.cleanup();
});

test("troca rápida de conta ignora perfil atrasado da conta anterior", async () => {
    const responses = [deferred(), deferred()];
    let call = 0;
    const h = createAuthEffectHarness({
        getSession: async () => ({data: {session: null}}),
        profileRpc: () => responses[call++].promise,
    });
    h.auth.clientAuthUserIdRef.current = "user-a";
    h.auth.state.profile = {id: "profile-a"};
    h.auth.state.appointments = [{client_id: "profile-a"}];
    h.auth.state.activeReferrals = [{referral_id: "referral-a"}];
    h.trigger("SIGNED_IN", {user: {id: "user-a", email: "a@example.test"}});
    h.flushTimers();
    h.trigger("SIGNED_IN", {user: {id: "user-b", email: "b@example.test"}});
    h.flushTimers();
    assert.equal(h.loaded.length, 2);
    assert.equal(h.auth.state.profile, null, "client switch clears the previous client's profile before new data resolves");
    assert.deepEqual(h.auth.state.appointments, [], "client switch clears the previous client's appointment view");
    assert.deepEqual(h.auth.state.activeReferrals, [], "client switch clears the previous client's referral view");
    responses[1].resolve({data: {id: "profile-b", full_name: "B", phone: "48999990002"}, error: null});
    await h.loaded[1].promise;
    responses[0].resolve({data: {id: "profile-a", full_name: "A", phone: "48999990001"}, error: null});
    await h.loaded[0].promise;
    assert.equal(h.auth.state.userId, "user-b");
    assert.equal(h.auth.state.profile.id, "profile-b");
    assert.equal(h.auth.state.name, "B");
    assert.deepEqual(h.auth.state.appointments, [{client_id: "profile-b"}]);
    h.cleanup();
});

test("RPC vazia ou com erro resolvido conclui login sem deixar carregamento preso", async () => {
    for (const result of [{data: null, error: null}, {data: null, error: {message: "offline"}}]) {
        const h = authHarness({profileRpc: async () => result});
        h.clientAuthRequestIdRef.current = 4;
        await h.loadAuthenticatedClient({id: "user-empty", email: "empty@example.test"}, 4);
        assert.equal(h.state.profile, null);
        assert.deepEqual(h.state.appointments, []);
        assert.equal(h.state.loading, false);
        assert.equal(h.state.summary, null);
    }
});

test("falha de rede no perfil não deixa dados de outra sessão visíveis", async () => {
    const h = authHarness({profileRpc: async () => { throw new Error("offline"); }});
    h.state.profile = {id: "previous-profile"};
    h.state.name = "Conta anterior";
    h.state.phone = "48999990000";
    h.state.appointments = [{client_id: "previous-profile"}];
    h.state.activeReferrals = [{referral_id: "previous-referral"}];
    h.clientAuthRequestIdRef.current = 8;
    await h.loadAuthenticatedClient({id: "user-current", email: "current@example.test"}, 8);
    assert.equal(h.state.profile, null);
    assert.equal(h.state.name, "");
    assert.equal(h.state.phone, "");
    assert.deepEqual(h.state.appointments, []);
    assert.deepEqual(h.state.activeReferrals, []);
    assert.equal(h.state.loading, false);
    assert.match(h.state.authError, /Verifique sua conexão/);
});

test("oportunidade atrasada após cleanup não altera a conta nem apresenta dados antigos", async () => {
    const opportunity = deferred();
    const state = {loading: false, opportunity: null, error: "", accountOpen: true, bookingStep: 4};
    const calls = [];
    const supabase = {rpc(name) { calls.push(name); return opportunity.promise; }};
    const normalizeRpcRow = (data) => Array.isArray(data) ? data[0] ?? null : data;
    const effect = new Function(
        "window", "URLSearchParams", "clientProfileId", "supabase", "closeClientAccountForOpportunity", "normalizeRpcRow", "setClientOpportunityLoading", "setClientOpportunity", "setClientOpportunityError", "setShowClientAccount", "setBookingStep",
        effectSource("const opportunityId = params.get"),
    )({location: {search: "?opportunity=opp-1"}}, URLSearchParams, "profile-1", supabase, () => { state.accountOpen = false; }, normalizeRpcRow, (value) => { state.loading = value; }, (value) => { state.opportunity = value; }, (value) => { state.error = value; }, (value) => { state.accountOpen = value; }, (value) => { state.bookingStep = value; });
    const cleanup = effect();
    cleanup();
    opportunity.resolve({data: {id: "opp-1", available: true}, error: null});
    await flushMicrotasks();
    assert.deepEqual(calls, ["get_my_waitlist_opportunity"]);
    assert.equal(state.opportunity, null);
    assert.equal(state.accountOpen, true);
    assert.equal(state.loading, false);
});

function opportunityHarness({search = "?opportunity=opp-1", rpc} = {}) {
    const state = {loading: false, opportunity: null, error: "", accountOpen: true, bookingStep: 4};
    const calls = [];
    const supabase = {rpc(name, args) { calls.push([name, args]); return rpc(name, args); }};
    const normalizeRpcRow = (data) => Array.isArray(data) ? data[0] ?? null : data;
    const effect = new Function(
        "window", "URLSearchParams", "clientProfileId", "supabase", "closeClientAccountForOpportunity", "normalizeRpcRow", "setClientOpportunityLoading", "setClientOpportunity", "setClientOpportunityError", "setShowClientAccount", "setBookingStep", "console",
        effectSource("const opportunityId = params.get"),
    )({location: {search}}, URLSearchParams, "profile-1", supabase, () => { state.accountOpen = false; }, normalizeRpcRow, (value) => { state.loading = value; }, (value) => { state.opportunity = value; }, (value) => { state.error = value; }, (value) => { state.accountOpen = value; }, (value) => { state.bookingStep = value; }, {error() {}});
    const cleanup = effect();
    return {state, calls, cleanup};
}

test("oportunidade disponível preserva consulta e marcação de abertura", async () => {
    const opportunity = {id: "opp-1", available: true};
    const h = opportunityHarness({rpc: async (name) => name === "get_my_waitlist_opportunity" ? {data: opportunity, error: null} : {data: null, error: null}});
    await flushMicrotasks();
    assert.deepEqual(h.calls.map(([name]) => name), ["get_my_waitlist_opportunity", "mark_waitlist_opportunity_opened"]);
    assert.deepEqual(h.state.opportunity, opportunity);
    assert.equal(h.state.error, "");
    assert.equal(h.state.accountOpen, false);
    assert.equal(h.state.loading, false);
    h.cleanup();
});

test("oportunidade vazia ou erro RPC mantém mensagem de indisponibilidade", async () => {
    for (const result of [{data: null, error: null}, {data: null, error: {message: "not found"}}]) {
        const h = opportunityHarness({rpc: async () => result});
        await flushMicrotasks();
        assert.equal(h.state.opportunity, null);
        assert.equal(h.state.error, "Esta vaga não está mais disponível.");
        assert.equal(h.state.accountOpen, false);
        assert.equal(h.state.bookingStep, 1);
        assert.equal(h.state.loading, false);
        h.cleanup();
    }
});

test("falha de rede da oportunidade é tratada e encerra carregamento", async () => {
    const h = opportunityHarness({rpc: async () => { throw new Error("offline"); }});
    await flushMicrotasks();
    assert.equal(h.state.opportunity, null);
    assert.equal(h.state.error, "Não foi possível carregar esta oportunidade. Tente novamente.");
    assert.equal(h.state.accountOpen, false);
    assert.equal(h.state.loading, false);
    h.cleanup();
});

test("indicação válida continua sendo registrada e removida do armazenamento local", async () => {
    const calls = [];
    const state = {pending: "ABC123"};
    const storage = {value: "ABC123", getItem() { return this.value; }, removeItem() { this.value = null; }};
    const pendingReferralCodeRef = {current: "ABC123"};
    const supabase = {rpc: async (name, args) => { calls.push([name, args]); return {data: "registered", error: null}; }};
    const normalizeReferralCode = new Function(`${functionSource("normalizeReferralCode")}; return normalizeReferralCode;`)();
    const register = new Function("supabase", "window", "REFERRAL_STORAGE_KEY", "normalizeReferralCode", "pendingReferralCodeRef", "setPendingReferralCode", "console", `${functionSource("registerPendingReferral")}; return registerPendingReferral;`)(supabase, {localStorage: storage}, "mirian-pending-referral-code", normalizeReferralCode, pendingReferralCodeRef, (value) => { state.pending = value; }, {warn() {}});
    await register("user-a", () => true);
    assert.deepEqual(calls, [["register_my_referral", {p_referral_code: "ABC123"}]]);
    assert.equal(storage.value, null);
    assert.equal(pendingReferralCodeRef.current, null);
    assert.equal(state.pending, null);
});

function nailHarness({findProfile, recordsByClient, photosByRecord = {}} = {}) {
    const ref = {current: 0};
    const state = {records: [], loading: false, error: ""};
    const query = (table) => {
        const filters = {};
        const builder = {
            select() { return builder; },
            eq(key, value) { filters[key] = value; return builder; },
            in(key, value) { filters[key] = value; return builder; },
            order() { return builder; },
            then(resolve, reject) {
                const result = table === "nail_records"
                    ? recordsByClient?.[filters.client_id] ?? {data: [], error: null}
                    : {data: (filters.nail_record_id ?? []).flatMap((id) => photosByRecord[id] ?? []), error: null};
                return Promise.resolve(result).then(resolve, reject);
            },
        };
        return builder;
    };
    const supabase = {from: query, storage: {from: () => ({createSignedUrl: async (path) => ({data: {signedUrl: `signed:${path}`}, error: null})})}};
    const load = new Function(
        "nailRecordLoadVersionRef", "findClientProfile", "supabase", "setIsLoadingNailRecords", "setNailRecordError", "setNailRecords", "console",
        `${functionSource("loadNailRecordsForClient")}; return loadNailRecordsForClient;`,
    )(ref, findProfile ?? (async (client) => ({id: `profile-${client.key}`})), supabase, (value) => { state.loading = value; }, (value) => { state.error = value; }, (value) => { state.records = value; }, {error() {}});
    return {ref, state, load};
}

test("troca rápida no histórico mantém somente registros da segunda cliente", async () => {
    const profiles = {A: deferred(), B: deferred()};
    const h = nailHarness({
        findProfile: (client) => profiles[client.key].promise,
        recordsByClient: {
            "profile-B": {data: [{id: "record-B", client_id: "profile-B", notes: "B", created_at: "2"}], error: null},
        },
    });
    const first = h.load({key: "A"}, ++h.ref.current);
    const second = h.load({key: "B"}, ++h.ref.current);
    profiles.B.resolve({id: "profile-B"});
    await second;
    profiles.A.resolve({id: "profile-A"});
    await first;
    assert.deepEqual(h.state.records.map((record) => record.client_id), ["profile-B"]);
    assert.equal(h.state.loading, false);
    assert.equal(h.state.error, "");
});

test("histórico trata ausência de perfil, lista vazia e falha de rede sem dados residuais", async () => {
    const empty = nailHarness({findProfile: async () => null});
    await empty.load({key: "none"});
    assert.deepEqual(empty.state.records, []);
    assert.equal(empty.state.loading, false);

    const failed = nailHarness({findProfile: async () => { throw new Error("offline"); }});
    await failed.load({key: "offline"});
    assert.deepEqual(failed.state.records, []);
    assert.equal(failed.state.error, "Não foi possível carregar os registros das unhas.");
    assert.equal(failed.state.loading, false);
});

test("resposta de resumo de indicação obsoleta não sobrescreve conta ativa", async () => {
    const responses = [deferred(), deferred()];
    let request = 0;
    const state = {summary: null, referrals: [], loading: false};
    const supabase = {rpc: async (name) => name === "get_my_referral_summary" ? responses[request++].promise : {data: [{referral_id: "new"}], error: null}};
    const normalizeRpcRow = (data) => Array.isArray(data) ? data[0] ?? null : data;
    const load = new Function("supabase", "normalizeRpcRow", "setIsLoadingReferralSummary", "setReferralSummary", "setActiveReferrals", "console", `${functionSource("loadReferralSummary")}; return loadReferralSummary;`)(supabase, normalizeRpcRow, (value) => { state.loading = value; }, (value) => { state.summary = value; }, (value) => { state.referrals = value; }, {warn() {}});
    let oldRequestCurrent = true;
    const oldRequest = load("user-old", () => oldRequestCurrent);
    oldRequestCurrent = false;
    const currentRequest = load("user-new", () => true);
    responses[1].resolve({data: {referral_code: "NEW"}, error: null});
    await currentRequest;
    responses[0].resolve({data: {referral_code: "OLD"}, error: null});
    await oldRequest;
    assert.equal(state.summary.referral_code, "NEW");
    assert.deepEqual(state.referrals, [{referral_id: "new"}]);
    assert.equal(state.loading, false);
});
