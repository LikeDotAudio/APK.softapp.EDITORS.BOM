// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

export const BOM_BLOCK_TYPE = 'bill_of_materials';
export const BOM_STATUSES = ['Specified', 'Quoted', 'Ordered', 'Received', 'Staged', 'Installed'];

const num = (v, dflt) => (Number.isFinite(Number(v)) && v !== '' && v !== null ? Number(v) : dflt);

export class BomModel {
  constructor() {
    this.items = [
      { id: 'item_1', sku: 'CORE-110F', mfr: 'Q-SYS', desc: 'Audio DSP Core Processor Frame', qty: 1, unitCost: 4250.00, status: 'Ordered' },
      { id: 'item_2', sku: 'CBS350-24P', mfr: 'Cisco', desc: '24-Port Gigabit Managed AV Switch', qty: 2, unitCost: 1150.00, status: 'Received' },
      { id: 'item_3', sku: 'DCI4-1250N', mfr: 'Crown', desc: '4x1250W DriveCore Network Amplifier', qty: 2, unitCost: 3800.00, status: 'Staged' },
      { id: 'item_4', sku: 'ULXD4Q-G50', mfr: 'Shure', desc: 'Quad Digital Wireless Microphone Receiver', qty: 1, unitCost: 5400.00, status: 'Quoted' },
      { id: 'item_5', sku: 'MR610-32', mfr: 'Mr-Label', desc: 'Self-Laminating Cable Label Stock (Pack)', qty: 5, unitCost: 28.50, status: 'Received' },
    ];
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
    for (const k of ['mac', 'serial']) if (item[k]) it[k] = String(item[k]);
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
