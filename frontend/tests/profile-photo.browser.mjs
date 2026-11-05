// Browser validation of the real ProfilePhoto component using only synthetic profiles and a mocked Storage/RPC API.
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {deflateSync} from "node:zlib";
import {fileURLToPath} from "node:url";
import {createServer} from "vite";
import {chromium} from "playwright";

process.env.VITE_SUPABASE_URL = "https://profile-photo-test.invalid";
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "test-publishable-key";

const frontend = fileURLToPath(new URL("..", import.meta.url));
const apiOrigin = new URL(process.env.VITE_SUPABASE_URL).origin;
const projectRef = new URL(process.env.VITE_SUPABASE_URL).hostname.split(".")[0];
const storageKey = `sb-${projectRef}-auth-token`;
const adminId = "11111111-1111-4111-8111-111111111111";
const clientId = "22222222-2222-4222-8222-222222222222";
const otherClientId = "33333333-3333-4333-8333-333333333333";
const clientUserId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const otherUserId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const profiles = new Map([
    [clientId, {userId: clientUserId, path: null}],
    [otherClientId, {userId: otherUserId, path: null}],
]);
const objects = new Map();
const events = [];
const state = {failNextRpc: false, failNextRpcNetwork: false, failNextSign: false};
const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const validObjectPath = new RegExp(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(?:profile\\.jpg|photo-${uuid}\\.jpg)$`, "i");
function crc32(buffer) {
    let crc = 0xffffffff;
    for (const byte of buffer) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    return (~crc) >>> 0;
}

function pngChunk(type, data) {
    const typeBytes = Buffer.from(type);
    const crcInput = Buffer.concat([typeBytes, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(crcInput));
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    return Buffer.concat([length, crcInput, crc]);
}

const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0])),
    pngChunk("IDAT", deflateSync(Buffer.from([0, 220, 100, 130, 255]))),
    pngChunk("IEND", Buffer.alloc(0)),
]);

const server = await createServer({
    root: frontend,
    configFile: `${frontend}/vite.config.ts`,
    logLevel: "error",
    server: {host: "127.0.0.1", port: 0, strictPort: false, hmr: false},
});
const browser = await chromium.launch({channel: "chrome", headless: true, args: ["--no-sandbox"]});

const json = (route, body, status = 200, origin = "*") => route.fulfill({
    status,
    contentType: "application/json",
    headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    },
    body: JSON.stringify(body),
});

function userFor(request) {
    const token = (request.headers().authorization ?? "").replace(/^Bearer\s+/i, "");
    if (token === "admin-test-token") return adminId;
    if (token === "client-test-token") return clientUserId;
    if (token === "other-client-test-token") return otherUserId;
    return null;
}

function mayManage(userId, profileId) {
    return userId === adminId || profiles.get(profileId)?.userId === userId;
}

async function installMocks(context, localOrigin) {
    await context.route("**/*", async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.origin === localOrigin) return route.continue();
        if (url.origin !== apiOrigin) return route.abort();
        const path = decodeURIComponent(url.pathname);
        const method = request.method();
        if (method === "OPTIONS") return route.fulfill({status: 204, headers: {"Access-Control-Allow-Origin": localOrigin, "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"}});

        if (path.startsWith("/storage/v1/object/sign/client-profile-photos/")) {
            const photoPath = path.slice("/storage/v1/object/sign/client-profile-photos/".length);
            if (method === "POST") {
                events.push({op: "sign", path: photoPath});
                if (state.failNextSign) {
                    state.failNextSign = false;
                    return json(route, {statusCode: 403, error: "Forbidden", message: "Leitura de teste recusada."}, 403, localOrigin);
                }
                if (!objects.has(photoPath) || !mayManage(userFor(request), photoPath.split("/")[0])) return json(route, {statusCode: 403, error: "Forbidden", message: "Acesso negado."}, 403, localOrigin);
                return json(route, {signedURL: `/object/sign/client-profile-photos/${photoPath}?token=test-only`}, 200, localOrigin);
            }
            if (method === "GET") {
                if (!objects.has(photoPath) || url.searchParams.get("token") !== "test-only") return route.fulfill({status: 403, headers: {"Access-Control-Allow-Origin": localOrigin}, body: "Acesso negado."});
                return route.fulfill({status: 200, contentType: "image/svg+xml", headers: {"Access-Control-Allow-Origin": localOrigin}, body: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"><circle cx="6" cy="6" r="6" fill="#b34e7d"/></svg>`});
            }
        }

        const uploadPrefix = "/storage/v1/object/client-profile-photos/";
        if (method === "POST" && path.startsWith(uploadPrefix)) {
            const photoPath = path.slice(uploadPrefix.length);
            const profileId = photoPath.split("/")[0];
            events.push({op: "upload", path: photoPath});
            if (!validObjectPath.test(photoPath) || !mayManage(userFor(request), profileId)) return json(route, {statusCode: 403, error: "Forbidden", message: "Você não tem permissão para alterar esta foto."}, 403, localOrigin);
            if (objects.has(photoPath) && request.headers()["x-upsert"] !== "true") return json(route, {statusCode: 409, error: "Duplicate", message: "Arquivo já existe."}, 409, localOrigin);
            objects.set(photoPath, Buffer.from(await request.postDataBuffer() ?? []));
            return json(route, {Key: `client-profile-photos/${photoPath}`}, 200, localOrigin);
        }

        if (method === "DELETE" && path === "/storage/v1/object/client-profile-photos") {
            const body = request.postDataJSON() ?? {};
            const removed = [];
            for (const photoPath of body.prefixes ?? []) {
                const profileId = photoPath.split("/")[0];
                if (!mayManage(userFor(request), profileId)) return json(route, {statusCode: 403, error: "Forbidden", message: "Você não tem permissão para remover esta foto."}, 403, localOrigin);
                events.push({op: "delete", path: photoPath});
                objects.delete(photoPath);
                removed.push({name: photoPath});
            }
            return json(route, removed, 200, localOrigin);
        }

        if (method === "POST" && path === "/rest/v1/rpc/set_client_profile_photo_path") {
            const body = request.postDataJSON() ?? {};
            events.push({op: "rpc", path: body.p_photo_path, profileId: body.p_client_id});
            if (state.failNextRpcNetwork) {
                state.failNextRpcNetwork = false;
                return route.abort();
            }
            if (state.failNextRpc) {
                state.failNextRpc = false;
                return json(route, {code: "XX000", message: "Falha de banco de teste."}, 500, localOrigin);
            }
            const profile = profiles.get(body.p_client_id);
            if (!profile || !mayManage(userFor(request), body.p_client_id)) return json(route, {code: "42501", message: "Você não pode alterar a foto desta cliente."}, 403, localOrigin);
            if (body.p_photo_path !== null && (!validObjectPath.test(body.p_photo_path) || body.p_photo_path.split("/")[0] !== body.p_client_id)) return json(route, {code: "22023", message: "Caminho de foto inválido."}, 400, localOrigin);
            profile.path = body.p_photo_path;
            return json(route, null, 200, localOrigin);
        }

        if (path === "/auth/v1/user") return json(route, {id: userFor(request), role: "authenticated", aud: "authenticated"}, 200, localOrigin);
        return json(route, {}, 404, localOrigin);
    });
}

async function openPhotoPage({origin, profileId, token = "admin-test-token", userId = adminId, path = null, viewport = {width: 1280, height: 900}, mobile = false}) {
    const context = await browser.newContext({viewport, deviceScaleFactor: mobile ? 3 : 1, isMobile: mobile, hasTouch: mobile});
    const user = {id: userId, email: "foto.teste@example.invalid", role: "authenticated", aud: "authenticated"};
    await context.addInitScript(({storageKey, token, user}) => {
        localStorage.setItem(storageKey, JSON.stringify({access_token: token, refresh_token: "test-only", expires_at: 2200000000, expires_in: 3600, token_type: "bearer", user}));
    }, {storageKey, token, user});
    await installMocks(context, origin);
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    await page.goto(`${origin}/tests/fixtures/profile-photo.html?profileId=${profileId}${path ? `&path=${encodeURIComponent(path)}` : ""}`);
    await page.getByText(/^(Adicionar foto|Alterar foto)$/).waitFor();
    return {context, page};
}

async function chooseFile(page, name, mimeType, buffer) {
    const picker = page.waitForEvent("filechooser");
    await page.getByText(/^(Adicionar foto|Alterar foto|Escolher outra)$/).click();
    const chooser = await picker;
    await chooser.setFiles([{name, mimeType, buffer}]);
}

await server.listen();
const localOrigin = server.resolvedUrls.local[0].replace(/\/$/, "");
const contexts = [];
try {
    const admin = await openPhotoPage({origin: localOrigin, profileId: clientId, viewport: {width: 390, height: 844}, mobile: true});
    contexts.push(admin.context);
    const {page} = admin;

    const cancelPicker = page.waitForEvent("filechooser");
    await page.getByText("Adicionar foto", {exact: true}).click();
    const canceled = await cancelPicker;
    await canceled.setFiles([]);
    assert.equal(await page.locator("#client-card").getAttribute("aria-expanded"), "true", "the native chooser control must not collapse its admin card");
    assert.equal(events.length, 0, "canceling file selection makes no Storage or RPC request");
    assert.equal(profiles.get(clientId).path, null);

    await chooseFile(page, "foto-teste.png", "image/png", png);
    assert.equal(await page.locator("#client-card").getAttribute("aria-expanded"), "true");
    await page.getByRole("button", {name: "Salvar foto", exact: true}).click();
    try { await page.getByRole("status").filter({hasText: "Foto atualizada."}).waitFor(); }
    catch (error) { console.error(JSON.stringify({body: await page.locator("body").innerText(), events, paths: [...objects.keys()]}, null, 2)); throw error; }
    const firstPath = profiles.get(clientId).path;
    assert.match(firstPath, new RegExp(`^${clientId}/photo-${uuid}\\.jpg$`, "i"));
    assert.deepEqual(events.filter((event) => ["upload", "sign", "rpc", "delete"].includes(event.op)).slice(0, 3).map((event) => event.op), ["upload", "sign", "rpc"]);
    assert.ok(objects.has(firstPath));

    await page.reload();
    await page.locator(".profile-photo img").waitFor();
    assert.ok((await page.locator(".profile-photo img").getAttribute("src")).includes(encodeURIComponent(firstPath)) || (await page.locator(".profile-photo img").getAttribute("src")).includes(firstPath));

    const originalImageUrl = await page.locator(".profile-photo img").getAttribute("src");
    state.failNextRpc = true;
    await chooseFile(page, "foto-substituta.png", "image/png", png);
    await page.getByRole("button", {name: "Salvar foto", exact: true}).click();
    await page.getByRole("status").filter({hasText: "Falha de banco de teste."}).waitFor();
    assert.equal(profiles.get(clientId).path, firstPath, "failed profile update preserves the prior pointer");
    assert.ok(objects.has(firstPath), "failed replacement leaves the previous image stored");
    assert.equal(await page.locator(".profile-photo img").getAttribute("src"), originalImageUrl, "failed replacement restores the previous image in the UI");
    const failedUpload = events.filter((event) => event.op === "upload").at(-1)?.path;
    assert.ok(failedUpload && !objects.has(failedUpload), "failed replacement cleans only the unreferenced new upload");

    state.failNextRpcNetwork = true;
    await chooseFile(page, "foto-incerta.png", "image/png", png);
    await page.getByRole("button", {name: "Salvar foto", exact: true}).click();
    await page.getByRole("status").filter({hasText: "Não foi possível confirmar se a foto foi salva"}).waitFor();
    const uncertainUpload = events.filter((event) => event.op === "upload").at(-1)?.path;
    assert.equal(profiles.get(clientId).path, firstPath);
    assert.ok(objects.has(firstPath) && uncertainUpload && objects.has(uncertainUpload), "a possibly committed file is retained alongside the old image until the state is rechecked");

    state.failNextSign = true;
    await chooseFile(page, "foto-sem-leitura.png", "image/png", png);
    await page.getByRole("button", {name: "Salvar foto", exact: true}).click();
    await page.getByRole("status").filter({hasText: "Você não tem permissão para alterar esta foto."}).waitFor();
    assert.equal(profiles.get(clientId).path, firstPath, "a photo that cannot be signed is never made current");
    assert.ok(objects.has(firstPath));

    await chooseFile(page, "foto-substituta-ok.png", "image/png", png);
    await page.getByRole("button", {name: "Salvar foto", exact: true}).click();
    await page.getByRole("status").filter({hasText: "Foto atualizada."}).waitFor();
    const replacementPath = profiles.get(clientId).path;
    assert.notEqual(replacementPath, firstPath);
    const rpcIndex = events.findIndex((event) => event.op === "rpc" && event.path === replacementPath);
    const oldDeleteIndex = events.findIndex((event) => event.op === "delete" && event.path === firstPath);
    assert.ok(rpcIndex >= 0 && oldDeleteIndex > rpcIndex, "the old file is deleted only after the profile RPC succeeds");
    assert.ok(!objects.has(firstPath) && objects.has(replacementPath));
    await page.reload();
    await page.locator(".profile-photo img").waitFor();
    assert.equal(await page.locator("#profile-path").textContent(), replacementPath);

    const customer = await openPhotoPage({origin: localOrigin, profileId: clientId, token: "client-test-token", userId: clientUserId, path: replacementPath, viewport: {width: 1440, height: 900}});
    contexts.push(customer.context);
    await customer.page.locator(".profile-photo img").waitFor();
    assert.ok((await customer.page.locator(".profile-photo img").getAttribute("src")).includes(replacementPath));

    const ownUpload = await openPhotoPage({origin: localOrigin, profileId: otherClientId, token: "other-client-test-token", userId: otherUserId, viewport: {width: 390, height: 844}, mobile: true});
    contexts.push(ownUpload.context);
    await chooseFile(ownUpload.page, "foto-propria.png", "image/png", png);
    await ownUpload.page.getByRole("button", {name: "Salvar foto", exact: true}).click();
    await ownUpload.page.getByRole("status").filter({hasText: "Foto atualizada."}).waitFor();
    const ownPath = profiles.get(otherClientId).path;
    assert.ok(objects.has(ownPath), "a client can still upload to their own profile");

    const unauthorized = await openPhotoPage({origin: localOrigin, profileId: otherClientId, token: "client-test-token", userId: clientUserId, viewport: {width: 1440, height: 900}});
    contexts.push(unauthorized.context);
    const rpcCountBefore = events.filter((event) => event.op === "rpc").length;
    await chooseFile(unauthorized.page, "foto-nao-autorizada.png", "image/png", png);
    await unauthorized.page.getByRole("button", {name: "Salvar foto", exact: true}).click();
    await unauthorized.page.getByRole("status").filter({hasText: "Você não tem permissão"}).waitFor();
    assert.equal(events.filter((event) => event.op === "rpc").length, rpcCountBefore, "a client cannot proceed to change a different profile");
    assert.equal(profiles.get(otherClientId).path, ownPath);

    const ownRpcIndex = events.findLastIndex((event) => event.op === "rpc" && event.profileId === otherClientId && event.path === ownPath);
    await ownUpload.page.getByRole("button", {name: "Remover", exact: true}).click();
    await ownUpload.page.getByRole("status").filter({hasText: "Foto atualizada."}).waitFor();
    const ownDeleteIndex = events.findLastIndex((event) => event.op === "delete" && event.path === ownPath);
    assert.equal(profiles.get(otherClientId).path, null);
    assert.ok(ownDeleteIndex > ownRpcIndex, "removal clears the profile path before deleting its stored image");
    assert.ok(!objects.has(ownPath));

    const invalid = await openPhotoPage({origin: localOrigin, profileId: clientId, viewport: {width: 1280, height: 900}});
    contexts.push(invalid.context);
    await chooseFile(invalid.page, "nao-e-imagem.txt", "text/plain", Buffer.from("invalid"));
    await invalid.page.getByRole("button", {name: "Salvar foto", exact: true}).click();
    await invalid.page.getByRole("status").filter({hasText: "Escolha uma imagem"}).waitFor();

    console.log("PASS: synthetic mobile/desktop picker, cancel, ADM upload, reload and client read, replacement ordering, database and network failures preserving the old image, client ownership, unauthorized rejection, remove and invalid image");
} finally {
    for (const context of contexts) await context.close();
    await browser.close();
    await server.close();
}
