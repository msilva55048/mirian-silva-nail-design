import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const edge = await readFile(new URL("../supabase/functions/admin-reset-client-password/index.ts", import.meta.url), "utf8");
const migration = await readFile(new URL("../supabase/migrations/20261013000000_client_password_reset_audit.sql", import.meta.url), "utf8");
const panel = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");

test("redefinição valida token e confere a conta Admin pelo ID configurado", () => {
    assert.match(edge, /admin\.auth\.getUser\(token\)/);
    assert.match(edge, /config\.admin_user_id !== user\.id/);
    assert.match(edge, /clientProfileId/);
    assert.match(edge, /profile\.user_id/);
    assert.match(edge, /admin\.auth\.admin\.updateUserById\(profile\.user_id, \{password\}\)/);
    assert.doesNotMatch(edge, /resetPasswordForEmail/);
});

test("auditoria restrita ao servidor não contém senha e a tela exige autorização", () => {
    assert.match(migration, /client_password_reset_audit/);
    assert.match(migration, /revoke all .* from anon, authenticated/i);
    assert.doesNotMatch(migration, /password\s+text/i);
    assert.match(edge, /clientAuthorized === true/);
    assert.match(edge, /client_password_reset_audit/);
    assert.match(panel, /Confirmo que a cliente solicitou ou autorizou esta redefinição/);
    assert.match(panel, /window\.confirm\(/);
    assert.match(panel, /Senha redefinida com sucesso! A cliente já pode acessar sua conta utilizando a nova senha\./);
});
