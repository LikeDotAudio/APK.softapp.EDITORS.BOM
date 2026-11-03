import test from 'node:test';
import assert from 'node:assert/strict';
import { BomModel } from '../js/bomApp.js';

test('BomModel tracks equipment items and calculates extended cost rollups', () => {
  const bom = new BomModel();
  assert.equal(bom.items.length, 3);
  const cost = bom.getTotalCost();
  assert.equal(cost, 2 * 3200 + 4 * 850 + 100 * 4.5);

  bom.addItem({ sku: 'SPK-12', mfr: 'Genelec', desc: 'Active Monitor', qty: 2, unitCost: 1500, status: 'Quoted' });
  assert.equal(bom.items.length, 4);
  assert.equal(bom.getTotalCost(), cost + 3000);
});
