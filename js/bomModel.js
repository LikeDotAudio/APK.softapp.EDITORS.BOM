// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

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
    return this.items.reduce((acc, i) => acc + (i.qty * i.unitCost), 0);
  }
}
