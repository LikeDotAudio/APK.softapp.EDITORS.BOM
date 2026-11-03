// Part of the APK.audio project — Anthony Kuzub
// MIT Licence.

export class BomModel {
  constructor() {
    this.items = [
      { sku: 'DSP-CORE-110', mfr: 'QSC', desc: 'Q-SYS Core 110f Processor', qty: 2, unitCost: 3200, status: 'Ordered' },
      { sku: 'CBS350-24P', mfr: 'Cisco', desc: 'CBS350 24-Port Managed PoE Switch', qty: 4, unitCost: 850, status: 'Received' },
      { sku: 'NC3MXX-B', mfr: 'Neutrik', desc: 'XLR-M Cable Connector (Black/Gold)', qty: 100, unitCost: 4.50, status: 'In Stock' }
    ];
  }

  getTotalCost() {
    return this.items.reduce((sum, item) => sum + (item.qty * item.unitCost), 0);
  }

  addItem(item) {
    this.items.push(item);
  }
}
