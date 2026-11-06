// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
/* ROAD-3598: the BOM table exports IFC beside CSV — each line shown an IfcCostItem (bomRowIfc.js),
   written by THE ONE TABLE's writer (vendor/apk-table/apk-table.js rowsToIfc). BOM_IFC_OUT=<dir>
   writes the file there, for IfcOpenShell. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { bomRowIfc } from '../js/bomRowIfc.js';

// a plain script (window.APKTable); in this "type": "module" package it loads as one and sets globalThis.APKTable
await import('../vendor/apk-table/apk-table.js');
const T = globalThis.APKTable;

test('each BOM line is one IfcCostItem with its cost, qty and APK_Procurement', () => {
  const model = { id: 'bom_test' };
  const rows = [
    { key: 'acme/dsp-01', sku: 'DSP-01', mfr: 'Acme', desc: 'DSP 16x16', qty: 2, unitCost: 1299.5, status: 'Quoted', quote: 'Q-77', leadTime: 'P3W' },
    { key: 'acme/amp-01', sku: 'AMP-01', mfr: 'Acme', desc: 'Amplifier', qty: 1, unitCost: '', status: 'Specified', leadTime: 'three weeks' },
  ];
  const ifc = T.rowsToIfc(rows, bomRowIfc(model), { timestamp: '2026-11-06T12:00:00' });
  assert.equal((ifc.match(/=IFCCOSTITEM\(/g) || []).length, 2);
  assert.match(ifc, /IFCMONETARYMEASURE\(1299\.5\)/);
  assert.match(ifc, /IFCQUANTITYCOUNT\('Count',\$,\$,2,\$\)/);
  assert.match(ifc, /'LeadTime',\$,IFCDURATION\('P3W'\)/);
  assert.ok(!ifc.includes('three weeks'), 'a lead time that is no ISO 8601 duration is not written as one');
  assert.ok(ifc.includes(T.ifcGuid('bom', 'bom_test', 'table', 'row', 'acme/dsp-01')));
  if (process.env.BOM_IFC_OUT) {
    mkdirSync(process.env.BOM_IFC_OUT, { recursive: true });
    writeFileSync(join(process.env.BOM_IFC_OUT, 'bom_schedule.ifc'), ifc);
  }
});
