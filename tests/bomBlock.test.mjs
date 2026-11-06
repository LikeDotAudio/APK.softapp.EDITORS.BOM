// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
/* ROAD-3489: the BOM block round trip over cad.like.audio/host@1, through the
   vendored apk-softapp.js the page loads — and what a discovered thing becomes. */
import test from 'node:test';
import assert from 'node:assert/strict';

import { BomModel, BOM_BLOCK_TYPE } from '../js/bomModel.js';
import { world, roundTrip, ORIGIN, PROTOCOL } from './softapp-harness.mjs';

const connect = (model) => (S) => S.connectHost({
  editor: 'BOM Editor', blockType: BOM_BLOCK_TYPE,
  onLoad: (b) => model.fromBlock(b), onRequest: () => model.toBlock(),
});

test('BOM: the CAD loads a (v1) block, asks for it back, gets the same lines at its own origin', () => {
  const model = new BomModel();
  const block = { type: BOM_BLOCK_TYPE, items: [{ id: 'a', sku: 'X-1', mfr: 'M', desc: 'd', qty: 3, unitCost: 2.5, status: 'Ordered' }] };
  const { w, ready, saved } = roundTrip({ connect: connect(model), block });
  assert.equal(ready.m.protocol, PROTOCOL);
  assert.equal(ready.m.blockType, BOM_BLOCK_TYPE);
  assert.equal(model.items.length, 1);
  assert.ok(saved, 'blockSave sent');
  assert.equal(saved.o, ORIGIN, 'posted to our own origin, never *');
  assert.equal(saved.m.block.schema, 'apk.bom/2', 'a v1 block comes back as apk.bom/2');
  const [line] = saved.m.block.items;
  assert.deepEqual([line.sku, line.mfr, line.desc, line.qty, line.unitCost, line.status], ['X-1', 'M', 'd', 3, 2.5, 'Ordered']);
  assert.equal(saved.m.block.occurrences.length, 3, 'qty 3 is three occurrences, not a counter');
  assert.equal(saved.m.block.totalCost, 7.5);
  assert.ok(w.toParent.every((x) => x.o === ORIGIN));
  assert.equal(w.downloads.length, 0, 'no download when embedded');
});

test('BOM: a message from another origin is ignored', () => {
  const model = new BomModel();
  const w = world();
  connect(model)(w.S);
  const before = model.items.length;
  w.fire({ protocol: PROTOCOL, type: 'load', block: { items: [] } }, { origin: 'http://evil' });
  assert.equal(model.items.length, before);
});

test('BOM: standalone save downloads bom.json', () => {
  const model = new BomModel();
  const w = world({ framed: false });
  const host = connect(model)(w.S);
  assert.equal(host.save(model.toBlock(), { filename: 'bom' }), 'download');
  assert.equal(w.downloads[0].name, 'bom.json');
});

test('BOM: a discovered thing becomes one line keyed by MAC, no invented price, no duplicate', () => {
  const model = new BomModel();
  const thing = { id: 'x', mac: '00:07:f5:42:06:a2', serial: '', name: 'Amp A', vendor: 'Crown', model: 'DCi', ips: ['10.0.0.9'], protocols: ['aes70'], live: { state: 'good', why: 'seen 3s ago' } };
  const n = model.items.length;
  const it = model.addFromThing(thing);
  assert.equal(model.items.length, n + 1);
  assert.equal(it.mac, thing.mac);
  assert.equal(it.unitCost, 0);
  assert.equal(it.mfr, 'Crown');
  assert.equal(model.addFromThing({ ...thing, ips: ['10.0.0.10'] }), null, 'same MAC, new IP: same thing');
  const { thingRow, thingIdentity } = world().S;   // the shared Discovered panel's rows (vendor/apk-softapp)
  const row = thingRow(thing);
  assert.equal(row.identity, thing.mac);
  assert.equal(row.state, 'good');
  assert.equal(thingIdentity({ ips: ['1.2.3.4'] }), '', 'an IP is never identity');
});

test('a library part becomes a BOM line, and the same part again is one more of it', () => {
  const m = new BomModel();
  const n = m.items.length;
  const part = { id: 'qsc/core-110f', manufacturer: 'QSC', model: 'Core 110f', part_number: 'CORE-110F', name: 'QSC Core 110f' };
  const line = m.addFromPart(part);
  assert.equal(m.items.length, n + 1);
  assert.deepEqual([line.sku, line.mfr, line.unitCost, line.status, line.bimId], ['CORE-110F', 'QSC', 0, 'Specified', 'qsc/core-110f']);
  assert.equal(m.addFromPart(part).qty, 2);
  assert.equal(m.items.length, n + 1);
  assert.equal(m.items[0].qty, 2, 'qty is the count of its occurrences');
  assert.equal(m.occurrences.length, 2);
});

test('a line from a pick keeps its BIM reference, and a saved line without one stays readable', () => {
  const m = new BomModel();
  const ref = { part: 'keysight/34401a', url: 'http://apk.local:8160/api/bim/parts/keysight/34401a', rev: '3f1c0a9be27d4410' };
  const line = m.addFromPart({ id: 'keysight/34401a', manufacturer: 'Keysight', model: '34401A' }, ref);
  assert.deepEqual(line.bimRef, ref);
  assert.deepEqual(m.toBlock().items[0].bimRef, ref, 'the ref is saved with the block');
  const old = new BomModel();
  assert.ok(old.fromBlock({ items: [{ id: 'item_1', sku: 'CORE-110F', mfr: 'Q-SYS', desc: 'typed by hand', qty: 1, unitCost: 1 }] }));
  assert.equal(old.items[0].mfr, 'Q-SYS', 'a typed make from before stays readable');
});
