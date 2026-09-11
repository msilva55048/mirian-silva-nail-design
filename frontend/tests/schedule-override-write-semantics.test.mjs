import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';

const sources = [
    readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8'),
    readFileSync(new URL('../src/features/admin/AdminPanel.tsx', import.meta.url), 'utf8'),
];

for (const source of sources) {
    test('adicionar e reativar usa sempre is_available=true', () => {
        assert.match(source, /async function addScheduleTimeOverride\(time: string\)[\s\S]{0,220}saveScheduleTimeOverride\(time, true\)/);
        assert.match(source, /await addScheduleTimeOverride\(normalizedTime\)/);
    });

    test('remover usa is_available=false em caminho separado', () => {
        assert.match(source, /async function removeScheduleTimeOverride\(time: string\)[\s\S]{0,160}saveScheduleTimeOverride\(time, false\)/);
        assert.match(source, /await removeScheduleTimeOverride\(time\)/);
    });
}
