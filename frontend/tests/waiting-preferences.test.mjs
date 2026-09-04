import assert from "node:assert/strict";
import {test} from "node:test";
import {readFileSync} from "node:fs";
import ts from "typescript";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {getWaitingPreferences, getSingleWaitingPreference, togglePreference} from "../src/features/admin/waitingPreferences.ts";

test("summary displays DD/MM while full dates retain chronological order and booking values", async () => {
    const source = readFileSync(new URL("../src/features/admin/WaitingPreferencesSummary.tsx", import.meta.url), "utf8");
    const compiled = ts.transpileModule(source, {compilerOptions: {jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext}}).outputText
        .replace('"react/jsx-runtime"', JSON.stringify(import.meta.resolve("react/jsx-runtime")))
        .replace('"./waitingPreferences"', JSON.stringify(new URL("../src/features/admin/waitingPreferences.ts", import.meta.url).href));
    const {WaitingPreferencesSummary} = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
    const single = {preferred_date: "2026-09-04", preferred_time: "17:00"};
    assert.match(renderToStaticMarkup(createElement(WaitingPreferencesSummary, {entry: single})), /Datas de interesse: 04\/09<\/span>/);
    assert.deepEqual(getSingleWaitingPreference(single), {date: "2026-09-04", time: "17:00"});
    const entry = {preferred_dates: ["2027-09-04", "2026-10-01", "2026-09-30", "2027-01-01", "2026-09-04"]};
    const before = structuredClone(entry);
    assert.match(renderToStaticMarkup(createElement(WaitingPreferencesSummary, {entry})), /Datas de interesse: 04\/09 · 30\/09 · 01\/10 · 01\/01 · 04\/09<\/span>/);
    assert.deepEqual(getWaitingPreferences(entry).dates, ["2026-09-04", "2026-09-30", "2026-10-01", "2027-01-01", "2027-09-04"]);
    assert.deepEqual(entry, before);
});

test("sets toggle independently, sort and deduplicate", () => {
    assert.deepEqual(togglePreference(["2030-02-01", "2030-01-08"], "2030-01-07"), ["2030-01-07", "2030-01-08", "2030-02-01"]);
    assert.deepEqual(togglePreference(["11:00", "13:00", "19:00"], "13:00"), ["11:00", "19:00"]);
    assert.deepEqual(getWaitingPreferences({preferred_dates: ["2030-02-01", "2030-01-08", "2030-01-08"], preferred_times: ["19:00:00", "11:00:00"]}), {dates: ["2030-01-08", "2030-02-01"], times: ["11:00", "19:00"]});
});
test("legacy dates, times, null arrays and empty records remain compatible", () => {
    assert.deepEqual(getWaitingPreferences({preferred_date: "2030-01-07"}), {dates: ["2030-01-07"], times: []});
    assert.deepEqual(getWaitingPreferences({preferred_time: "17:00:00"}), {dates: [], times: ["17:00"]});
    assert.deepEqual(getWaitingPreferences({preferred_dates: null, preferred_times: null, preferred_date: "2030-01-07", preferred_time: "17:00:00"}), {dates: ["2030-01-07"], times: ["17:00"]});
    assert.deepEqual(getWaitingPreferences({}), {dates: [], times: []});
    assert.deepEqual(getWaitingPreferences({preferred_dates: [], preferred_times: [], preferred_date: "2030-01-07", preferred_time: "17:00"}), {dates: [], times: []});
});
test("automatic preselection requires exactly one date and one time", () => {
    assert.deepEqual(getSingleWaitingPreference({preferred_date: "2030-01-07", preferred_time: "08:00:00"}), {date: "2030-01-07", time: "08:00"});
    assert.equal(getSingleWaitingPreference({preferred_dates: ["2030-01-07", "2030-01-08"], preferred_times: ["08:00"]}), null);
    assert.equal(getSingleWaitingPreference({preferred_dates: ["2030-01-07"], preferred_times: ["08:00", "09:00"]}), null);
    assert.equal(getSingleWaitingPreference({preferred_date: "2030-01-07"}), null);
});
test("new migration preserves legacy fields and backfills native arrays only", () => {
    const sql = readFileSync(new URL("../supabase/migrations/20260903020000_waiting_list_multiple_preferences.sql", import.meta.url), "utf8");
    assert.match(sql, /add column preferred_dates date\[\]/);
    assert.match(sql, /add column preferred_times time without time zone\[\]/);
    assert.match(sql, /array\[preferred_date\]/);
    assert.match(sql, /array\[preferred_time\]/);
    assert.doesNotMatch(sql, /drop |create policy|alter publication|disable row level|appointments/i);
});
