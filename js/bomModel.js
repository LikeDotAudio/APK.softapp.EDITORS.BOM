// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

export const BOM_BLOCK_TYPE = 'bill_of_materials';
export const BOM_STATUSES = ['Specified', 'Quoted', 'Ordered', 'Received', 'Staged', 'Installed'];

const num = (v, dflt) => (Number.isFinite(Number(v)) && v !== '' && v !== null ? Number(v) : dflt);

export class BomModel {
  constructor() {
    /* No demo lines: every line comes from the BIM library (📚 Library, ROAD-3572), from
       Discovered, or from an opened BOM block. */
    this.items = [];
  }

  getTotalCost() {
    return this.items.reduce((acc, i) => acc + (num(i.qty, 0) * num(i.unitCost, 0)), 0);
  }

  addItem(item = {}) {
    const it = {
      id: item.id || `item_${Date.now()}_${this.items.length + 1}`,
      sku: item.sku ?? 'NEW-SKU-01',
      mfr: item.mfr ?? 'Manufacturer',
      desc: item.desc ?? 'Equipment Item Description',
      qty: num(item.qty, 1),
      unitCost: num(item.unitCost, 0),
      status: item.status || 'Specified',
    };
    for (const k of ['mac', 'serial', 'bimId']) if (item[k]) it[k] = String(item[k]);
    if (item.bimRef && item.bimRef.part) it.bimRef = { ...item.bimRef };   // the BIM reference (ROAD-3572)
    this.items.push(it);
    return it;
  }

  removeItem(index) {
    return index >= 0 && index < this.items.length ? this.items.splice(index, 1)[0] : null;
  }

  updateItem(index, field, value) {
    const it = this.items[index];
    if (!it) return;
    if (field === 'qty') it.qty = Math.max(0, Math.round(num(value, 1)));
    else if (field === 'unitCost') it.unitCost = num(value, 0);
    else it[field] = value;
  }

  /** A line for a part picked from the BIM library (DATABASE.server.BIM). The same part
      again is one more of it, not a second line. The library keeps no prices: 0 until quoted.
      `bimRef` is the pick's BIM reference {part, url, rev} (bimLibrary.js bimFields). */
  addFromPart(part = {}, bimRef = null) {
    const same = part.id && this.items.find((i) => i.bimId === part.id);
    if (same) {
      same.qty = num(same.qty, 0) + 1;
      return same;
    }
    return this.addItem({
      sku: part.part_number || part.model || '',
      mfr: part.manufacturer || '',
      desc: part.description || part.name || part.model || '',
      qty: 1,
      unitCost: 0,
      status: 'Specified',
      bimId: part.id || '',
      bimRef: bimRef || part.ref || null,
    });
  }

  /** A line for one discovered thing: what is on the network, as found. No price is invented (0 until quoted). */
  addFromThing(t = {}) {
    const ident = t.mac || t.serial || '';
    const dupe = ident && this.items.find((i) => (t.mac && i.mac === t.mac) || (t.serial && i.serial === t.serial));
    if (dupe) return null;
    return this.addItem({
      sku: t.model || '',
      mfr: t.vendor || '',
      desc: t.name || t.model || ident,
      qty: 1,
      unitCost: 0,
      status: 'Installed',
      mac: t.mac || '',
      serial: t.serial || '',
    });
  }

  toBlock() {
    const items = JSON.parse(JSON.stringify(this.items));
    return {
      type: BOM_BLOCK_TYPE,
      items,
      totalCost: this.getTotalCost(),
      itemCount: items.length,
    };
  }

  fromBlock(block) {
    if (!block) return false;
    const raw = Array.isArray(block) ? block : block.items;
    if (!Array.isArray(raw)) return false;
    this.items = JSON.parse(JSON.stringify(raw));
    return true;
  }
}
