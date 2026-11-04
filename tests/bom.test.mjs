// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

import test from 'node:test';
import assert from 'node:assert/strict';

import { BomModel } from '../js/bomModel.js';

test('BOM Model Cost Calculation', () => {
  const model = new BomModel();
  assert.ok(model.items.length >= 4);
  const total = model.getTotalCost();
  assert.ok(total > 5000);
  assert.equal(typeof total, 'number');
});
