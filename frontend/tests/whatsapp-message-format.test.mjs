import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {buildWhatsAppMessage} from "../src/features/admin/whatsappMessage.ts";

const appointment = {
    client_name: "Moisés da Silva",
    service_name: "Esmaltação em Gel com Blindagem",
    appointment_date: "2026-12-25",
    start_time: "07:00:00",
};

test("mensagem de confirmação mantém dados dinâmicos e separadores iguais", () => {
    const message = buildWhatsAppMessage(appointment, "attendance-confirmation");
    const separator = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━";
    assert.equal(message.split(separator).length - 1, 3);
    assert.match(message, /Mirian Silva\n           Nail Design/);
    assert.match(message, /Olá, Moisés! ✨/);
    assert.match(message, /💅 Serviço: Esmaltação em Gel com Blindagem/);
    assert.match(message, /📅 Data: 25\/12\/2026/);
    assert.match(message, /🕐 Horário: 07:00/);
    assert.match(message, /Gostaria de confirmar seu\nagendamento comigo amanhã\./);
});

test("URL manual preserva telefone e codifica a mensagem", () => {
    const message = buildWhatsAppMessage(appointment, "attendance-confirmation");
    const phone = "5548998074518";
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    assert.match(url, /^https:\/\/wa\.me\/5548998074518\?text=/);
    assert.match(decodeURIComponent(url.split("?text=")[1]), /━━━━━━━━/);
    assert.match(decodeURIComponent(url.split("?text=")[1]), /Olá, Moisés! ✨/);
});

test("lembrete de duas horas não é gerado pela lista manual", () => {
    const source = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
    assert.doesNotMatch(source, /types\.push\("two-hour-reminder"\)/);
});
