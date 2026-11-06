// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
/* Open Bench when the BIM API is up: GET /api/bim/bom (DATABASE.server.BIM bim/bom.py) laid over the model it
   counts, GET /api/bim/bom.ifc. Fixtures: the server's answer for 2 amps whose part's kit is 4 site screws +
   1 pair of ears (each pair with 2 factory screws), written by DATABASE.server.BIM SRC/tests/test_bom.py's rig. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

import { BomModel } from '../js/bomModel.js';

const here = new URL('./fixtures/', import.meta.url);
const BOM = JSON.parse(readFileSync(new URL('bom-kit.json', here), 'utf8'));
const IFC = gunzipSync(readFileSync(new URL('bom-kit.ifc.gz', here))).toString('utf8');

test('the server BOM and the model it counts agree, line by line', () => {
  const m = new BomModel();
  m.loadIfc(IFC, 'bom.ifc');
  const got = m.applyServerBom(BOM);
  assert.deepEqual(got.differ, []);
  const qty = Object.fromEntries(m.lines().map((l) => [l.key, l.qty]));
  assert.deepEqual(qty, { 'powersoft/dci-4-600': 2, 'apk/rack-ears-2u': 2, 'apk/rack-screw-10-32': 12 });
  const screw = m.lines().find((l) => l.key === 'apk/rack-screw-10-32');
  assert.equal(screw.drive, 'Robertson (square-drive)');
  assert.equal(screw.kit, true);
  assert.equal(screw.bimRef.part, 'apk/rack-screw-10-32');
  assert.equal(m.source.bom, 'apk.bim.bom/1');
});

test('a line the model no longer counts the same is named, never overwritten', () => {
  const m = new BomModel();
  m.loadIfc(IFC, 'bom.ifc');
  const stale = { ...BOM, lines: BOM.lines.map((l) => (l.type === 'powersoft/dci-4-600' ? { ...l, qty: 3 } : l)) };
  const got = m.applyServerBom(stale);
  assert.deepEqual(got.differ, [{ type: 'powersoft/dci-4-600', server: 3, model: 2 }]);
  assert.equal(m.lines().find((l) => l.key === 'powersoft/dci-4-600').qty, 2);
  assert.throws(() => m.applyServerBom({ lines: [] }), TypeError);
});
