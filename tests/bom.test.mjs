// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

import test from 'node:test';
import assert from 'node:assert/strict';

import { BomModel } from '../js/bomModel.js';

test('BOM Model Cost Calculation', () => {
  const model = new BomModel();
  assert.equal(model.items.length, 0, 'no demo lines: every line is a BIM part (ROAD-3572)');
  model.addItem({ sku: 'CORE-110F', mfr: 'Q-SYS', qty: 1, unitCost: 4250 });
  model.addItem({ sku: 'DCI4-1250N', mfr: 'Crown', qty: 2, unitCost: 3800 });
  const total = model.getTotalCost();
  assert.ok(total > 5000);
  assert.equal(typeof total, 'number');
});
