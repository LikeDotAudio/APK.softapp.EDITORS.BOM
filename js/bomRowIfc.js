// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
/* bomRowIfc.js — the BOM table's row→IFC mapping (ROAD-3598: every table offers IFC beside CSV).
   APKTable 'bom-items' takes it as opts.ifc, so its IFC export (handle.exportIfc, the Export IFC
   button) writes the lines shown as IFC4X3_ADD2: each line one IfcCostItem — Name the description,
   Identification the SKU, CostValues its unit cost (IfcCostValue 'Unit', IfcMonetaryMeasure),
   CostQuantities its qty (IfcQuantityCount) — with APK_Procurement (Status, LeadTime when it is an
   ISO 8601 duration, QuoteReference). Save writes the whole model (bomIfc.js bomToIfc); this is the
   table as rows. */
export function bomRowIfc(model) {
  return {
    file: 'bom_schedule',
    project: 'Bill of materials',
    get roles() { return ['bom', model?.id || 'bom', 'table']; },
    row: (r) => ({
      entity: 'IfcCostItem',
      key: r.key || r.id || r.sku || r.desc,
      name: r.desc || r.sku || null,
      identification: r.sku || null,
      description: [r.mfr, r.sku].filter(Boolean).join(' ') || null,
      cost: { unit: Number.isFinite(Number(r.unitCost)) && r.unitCost !== '' ? Number(r.unitCost) : null, quantity: Number(r.qty) || 0, currency: 'USD' },
      psets: {
        APK_Procurement: {
          Status: r.status || null,
          LeadTime: /^P(?=\d|T\d)/.test(String(r.leadTime || '')) ? { value: r.leadTime, measure: 'IfcDuration' } : null,
          QuoteReference: r.quote || r.po ? { value: r.quote || r.po, measure: 'IfcIdentifier' } : null,
        },
      },
    }),
  };
}
