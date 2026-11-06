// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
/* bom-fm-1..3: the BOM as a query over occurrences grouped by type, kits expanded per occurrence, and
   its cost schedule, orders, suppliers and makers in IFC4X3 — held to a bench .ifc DATABASE.server.BIM
   really serves (tests/fixtures/seed-bench.ifc.gz, the Wirelist's fixture) and, when IfcOpenShell is
   at hand (APK_IFC_PYTHON=<python with ifcopenshell>), to tests/fixtures/ifc_oracle.py. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { BomModel } from '../js/bomModel.js';
import { bomQuery, bomToIfc, kitClass } from '../js/bomIfc.js';
import * as ifc from '../js/ifc/apk-ifc.mjs';
import { IfcOut } from '../js/ifc/ifcOut.mjs';
import { available, render, OUT } from './fixtures/make_ifc_codec.mjs';

const FIX = new URL('./fixtures/', import.meta.url);
const BENCH = zlib.gunzipSync(fs.readFileSync(new URL('seed-bench.ifc.gz', FIX))).toString('utf8');
const SCREW = { part: 'generic/robertson-8x19', name: 'Robertson #8 x 19 mm pan head screw', qty: 4, role: 'fastener', predefined: 'SCREW', place: 'site',
  diameter_mm: 4.2, length_mm: 19 };
const AMP = { id: 'crown/dci-4-1250n', manufacturer: 'Crown', model: 'DCi 4|1250N', part_number: 'DCI4-1250N', category: 'Audio',
  class: 'amplifier', name: 'Crown DCi 4|1250N', assembly: [SCREW] };

function pricedModel() {
  const m = new BomModel();
  m.id = 'bom_fixture';
  m.addFromPart(AMP);
  m.addFromPart(AMP);
  const at = (key) => m.lines().findIndex((l) => l.key === key);
  m.updateItem(at(AMP.id), 'unitCost', 3800);
  m.updateItem(at(AMP.id), 'status', 'Ordered');
  m.updateItem(at(AMP.id), 'po', 'PO-1001');
  m.updateItem(at(AMP.id), 'supplier', 'Pro Audio Supply');
  m.updateItem(at(AMP.id), 'leadTime', 'P14D');
  m.updateItem(at(SCREW.part), 'unitCost', 0.25);
  return m;
}

test('2 placed DCi amps whose part has assembly [{screw, qty 4}] give 2 amps + 8 screws', () => {
  const m = pricedModel();
  const qty = Object.fromEntries(m.lines().map((l) => [l.key, l.qty]));
  assert.deepEqual(qty, { [AMP.id]: 2, [SCREW.part]: 8 });
  const amps = m.occurrences.filter((o) => o.type === AMP.id);
  for (const a of amps) assert.equal(m.occurrences.filter((o) => o.kitOf === a.gid).length, 4, 'each amp carries its own 4 screws');
  assert.equal(m.getTotalCost(), 2 * 3800 + 8 * 0.25);
  assert.deepEqual(kitClass(SCREW), { entity: 'IfcMechanicalFastenerType', predefined: 'SCREW', elementType: null });
  assert.equal(kitClass({ role: 'fastener', predefined: 'PHILLIPS' }).predefined, 'USERDEFINED', 'a word IFC lacks is USERDEFINED');
});

test('qty is a count of occurrences: editing it plans or drops occurrences, never ones the rig has', () => {
  const m = pricedModel();
  m.updateItem(0, 'qty', 3);
  assert.equal(m.lines()[0].qty, 3);
  assert.equal(m.lines()[1].qty, 12, 'the third amp brought its kit');
  m.updateItem(0, 'qty', 1);
  assert.deepEqual(m.lines().map((l) => l.qty), [1, 4]);
  const b = new BomModel();
  b.loadIfc(BENCH, 'bench.ifc');
  const i = b.lines().findIndex((l) => l.qty === 2);
  const key = b.lines()[i].key;
  b.updateItem(i, 'qty', 0);
  assert.equal(b.lines().find((l) => l.key === key).qty, 2, 'a placed device is not typed away');
});

test('the seed bench .ifc read as a BOM: one line per type, qty = its occurrences (IfcRelDefinesByType)', () => {
  const q = bomQuery(BENCH);
  assert.equal(q.schema, 'IFC4X3_ADD2');
  const f = ifc.parseStep(BENCH);
  const typedOccurrences = new Set(ifc.entitiesByType(f, 'IFCRELDEFINESBYTYPE').flatMap((r) => r.args[4].map((x) => x.id)));
  assert.equal(q.occurrences.length, typedOccurrences.size);
  const m = new BomModel();
  m.loadIfc(BENCH, 'bench.ifc');
  const lines = m.lines();
  assert.equal(lines.reduce((a, l) => a + l.qty, 0), typedOccurrences.size);
  assert.equal(lines.length, new Set(ifc.entitiesByType(f, 'IFCRELDEFINESBYTYPE').map((r) => r.args[5].id)).size);
  for (const o of q.occurrences) assert.ok(![o.gid, o.mac, o.serial].some((v) => /\d+\.\d+\.\d+\.\d+/.test(String(v ?? ''))), 'identity is never an IP');
  assert.ok(lines.every((l) => l.placed === l.qty), 'every bench line is placed');
  assert.ok(q.occurrences.some((o) => o.location === 'The Lab'), 'location is the containing IfcSpace, not text');
});

test('save → open: prices, procurement, PO, supplier, kits and currency come back from the .ifc alone', () => {
  const m = pricedModel();
  const text = bomToIfc(m);
  assert.equal(ifc.schemaOf(ifc.parseStep(text)), 'IFC4X3_ADD2');
  const back = new BomModel();
  back.loadIfc(text, 'bom.ifc');
  const pick = (ls) => ls.map((l) => [l.key, l.qty, l.unitCost, l.status, l.po, l.supplier]);
  assert.deepEqual(pick(back.lines()), pick(m.lines()));
  assert.equal(back.procurement[AMP.id].leadTime, 'P14D');
  assert.equal(back.currency, 'USD');
  assert.equal(back.getTotalCost(), m.getTotalCost());
  const kit = back.occurrences.filter((o) => o.kitOf);
  assert.equal(kit.length, 8);
  assert.ok(kit.every((o) => o.place === 'SITE'));
  assert.ok(kit.every((o) => o.diameterMm === 4.2 && o.lengthMm === 19), 'each screw is a sized occurrence (mm), never a string');
  assert.equal(bomToIfc(back), bomToIfc(back), 'the same model gives the same bytes');
});

test('the twin over a rig keeps the rig whole and replaces its own projection on the next save', () => {
  const m = new BomModel();
  m.id = 'bom_bench';
  m.loadIfc(BENCH, 'bench.ifc');
  m.addFromPart(AMP);
  const twin = bomToIfc(m);
  const rig = ifc.parseStep(BENCH);
  const out = ifc.parseStep(twin);
  for (const e of rig.entities) {
    if (e.type === 'IFCUNITASSIGNMENT' || e.type === 'IFCRELDEFINESBYTYPE') continue;   // the currency joins; nothing else moves
    assert.equal(ifc.writeEntity(out.byId.get(e.id)), ifc.writeEntity(e));
  }
  const again = new BomModel();
  again.loadIfc(twin, 'bench.bom.ifc');
  assert.equal(bomToIfc(again), twin, 'open the twin and save: the same file, no second schedule');
  assert.equal(ifc.entitiesByType(ifc.parseStep(bomToIfc(again)), 'IFCCOSTSCHEDULE').length, 1);
});

test('a twin some other tool rewrote is refused, never guessed at', () => {
  const m = pricedModel();
  const f = ifc.parseStep(bomToIfc(m));
  const marker = ifc.entitiesByType(f, 'IFCCOSTSCHEDULE')[0];
  const project = ifc.entitiesByType(f, 'IFCPROJECT')[0];
  project.args[4] = ifc.ref(marker.id + 1);   // a rig entity now points into the projection by a single reference
  assert.throws(() => IfcOut.over(ifc.writeStep(f), { strip: 'apk.bom/2' }), /rewritten/);
});

test('a discovered thing is an occurrence keyed by MAC — an IP never is — and one the rig has is not added twice', () => {
  const m = new BomModel();
  assert.equal(m.addFromThing({ ips: ['10.0.0.9'], name: 'only an address' }), null);
  const line = m.addFromThing({ mac: '00:07:F5:42:06:A2', vendor: 'Crown', model: 'DCi', ips: ['10.0.0.9'] });
  assert.equal(line.mac, '00:07:f5:42:06:a2');
  assert.equal(m.occurrences[0].gid, ifc.ifcGuid('inst/mac:00:07:f5:42:06:a2'), 'the site-wide occurrence GlobalId');
  assert.equal(m.addFromThing({ mac: '00:07:f5:42:06:a2', ips: ['10.0.0.10'] }), null);
  assert.ok(!bomToIfc(m).includes('10.0.0.9'));
});

test('a v1 block migrates: typed qty becomes occurrences; a site stage moves out of procurement', () => {
  const m = new BomModel();
  assert.ok(m.fromBlock({ type: 'bill_of_materials', items: [
    { id: 'x', sku: 'CORE-110F', mfr: 'QSC', desc: 'Core', qty: 2, unitCost: 4250, status: 'Installed' },
    { id: 'y', sku: 'DCI', mfr: 'Crown', desc: 'Amp', qty: 1, unitCost: 3800, status: 'Quoted', bimId: 'crown/dci' }] }));
  assert.equal(m.occurrences.length, 3);
  assert.deepEqual(m.procurement['line/x'], { status: 'Ordered', site: 'Installed' });
  assert.equal(m.lines()[1].key, 'crown/dci');
  const b = m.toBlock();
  const again = new BomModel();
  assert.ok(again.fromBlock(JSON.parse(JSON.stringify(b))));
  assert.deepEqual(again.toBlock(), b, 'apk.bom/2 round-trips');
});

test('js/ifc/apk-ifc.mjs is the contracts IFC kit (when the contracts checkout is beside this app)', { skip: !available() && 'no contracts checkout' }, async () => {
  assert.equal(fs.readFileSync(OUT, 'utf8'), await render(), 'run: node tests/fixtures/make_ifc_codec.mjs');
});

const PY = process.env.APK_IFC_PYTHON;
test('IfcOpenShell oracle: 0 schema + EXPRESS errors, util.cost totals, get_types counts, kits, actors', { skip: !PY && 'set APK_IFC_PYTHON to a python with ifcopenshell' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bom-ifc-'));
  const oracle = fileURLToPath(new URL('ifc_oracle.py', FIX));
  const fresh = pricedModel();
  fresh.addFromThing({ mac: '00:07:f5:42:06:a2', vendor: 'Crown', model: 'DCi' });
  const bench = new BomModel();
  bench.id = 'bom_bench';
  bench.loadIfc(BENCH, 'bench.ifc');
  bench.addFromPart(AMP);
  bench.updateItem(0, 'unitCost', 12.5);
  for (const [name, m] of [['bom.ifc', fresh], ['bench.bom.ifc', bench]]) {
    const file = path.join(dir, name);
    fs.writeFileSync(file, bomToIfc(m));
    const want = { total: m.getTotalCost(), types: Object.fromEntries(m.lines().map((l) => [l.key, l.qty])),
      kit_units: m.occurrences.filter((o) => o.kitOf).length, makers: ['Crown'] };
    fs.writeFileSync(`${file}.expect.json`, JSON.stringify(want));
    const r = spawnSync(PY, ['-I', oracle, file, `${file}.expect.json`], { encoding: 'utf8', cwd: os.tmpdir() });
    if (r.status === 3) return;
    const got = JSON.parse(r.stdout.trim().split('\n').pop() || '{}');
    assert.deepEqual(got.problems, [], `${name}: ${r.stderr}`);
    assert.equal(got.validate_errors, 0);
    assert.equal(r.status, 0);
  }
});

test('standalone Save Model (vendored apk-softapp.js): bom.ifc and bom.json, both, the .ifc first', async () => {
  const { world } = await import('./softapp-harness.mjs');
  const w = world({ framed: false });
  const m = pricedModel();
  const r = await w.S.saveModel(m, { name: 'bom', toIfc: (x) => bomToIfc(x), toJson: (x) => x.toBlock() });
  assert.equal(r.ok, true);
  assert.deepEqual(w.downloads.map((d) => d.name), ['bom.ifc', 'bom.json']);
  assert.ok(w.downloads[0].text.startsWith('ISO-10303-21;'));
  assert.equal(JSON.parse(w.downloads[1].text).schema, 'apk.bom/2');
});
