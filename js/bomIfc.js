// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
/* bomIfc.js — THE BILL OF MATERIALS AS A QUERY OVER AN IFC MODEL, AND ITS COST SCHEDULE (bom-fm-1..3).

   READ  bomQuery(text) — a rig / bench .ifc (GET /api/bim/bench.ifc, DATABASE.server.BIM bim/bench_ifc.py,
         or a twin this editor saved) read with the contracts STEP codec (js/ifc/apk-ifc.mjs):
           a line        one TYPE object (IfcAudioVisualApplianceType, IfcMechanicalFastenerType, …); its key
                         is the type's Tag (the BIM part id) or, without one, its GlobalId
           qty           the count of occurrences the type defines (IfcRelDefinesByType) — never typed
           a kit         occurrences aggregated (IfcRelAggregates) under a device, through its
                         IfcElementAssembly ACCESSORY_ASSEMBLY: each screw is one typed occurrence, so a kit
                         is counted per device that carries it
           the cost      an apk.bom/2 IfcCostSchedule a save wrote: prices, procurement state, orders, suppliers

   WRITE bomToIfc(model) — the rig the editor opened (kept whole) or a model of its own, plus:
     IfcCostSchedule 'Bill of materials'  Identification apk.bom/2 (the projection marker), PredefinedType
                         PRICEDBILLOFQUANTITIES (UNPRICEDBILLOFQUANTITIES while every price is 0), declared
                         in the project (IfcRelDeclares); currency = IfcMonetaryUnit in the IfcUnitAssignment
       └ IfcCostItem 'Total' (IfcRelAssignsToControl from the schedule), CostValue Category '*' = the sum
           └ one IfcCostItem per line (IfcRelNests): Identification = SKU, CostValues = IfcCostValue
             AppliedValue IfcMonetaryMeasure (unit price), CostQuantities = IfcQuantityCount (the qty),
             controlling the line's occurrences (IfcRelAssignsToControl — what
             ifcopenshell.api.cost.assign_cost_item_quantity writes); APK_Procurement (Status
             Specified|Quoted|Ordered, LeadTime IfcDuration, QuoteReference) — IFC has no word for it
     IfcProjectOrder PURCHASEORDER       one per PO number, controlling that PO's occurrences; the supplier
                         is an IfcActor (IfcOrganization, IfcActorRole SUPPLIER) by IfcRelAssignsToActor
     makers              one IfcActor per manufacturer (IfcOrganization Identification = maker slug, role
                         MANUFACTURER), assigned to its type objects by IfcRelAssignsToActor
     occurrences the editor made (a library pick, a discovered thing, an old typed line) are written as
     occurrences of their type, contained in the model's space (or storey); a kit is an IfcElementAssembly
     ACCESSORY_ASSEMBLY (AssemblyPlace SITE|FACTORY) aggregated under its device, holding one typed
     IfcMechanicalFastener / IfcDiscreteAccessory occurrence per unit.

   Identity is serial / MAC, never an IP. GlobalIds are ifcGuid(...roles) under bom/<project GlobalId>:
   the same model gives the same bytes. */
import * as S from './ifc/apk-ifc.mjs';
import { IfcOut, ref, real, enumv, typed, label, ident, str, refs, enumOf, textOf, referrers, containers } from './ifc/ifcOut.mjs';

export const BOM_PROJECTION = 'apk.bom/2';
export const PROCUREMENT = ['Specified', 'Quoted', 'Ordered'];

/* Attribute layouts that are not the IfcElementType / IfcElement one (checked against IFC4X3_ADD2 by
   tests/fixtures/ifc_oracle.py): index of PredefinedType, and extra trailing attributes. */
const TYPE_LAYOUT = {
  IFCMECHANICALFASTENERTYPE: (base, pre, size) => [...base, pre, ...size],      // …, ElementType, PredefinedType, NominalDiameter, NominalLength
  IFCFURNITURETYPE: (base, pre) => [...base, enumv('NOTDEFINED'), pre],         // …, ElementType, AssemblyPlace, PredefinedType
};
const OCC_LAYOUT = {
  IFCMECHANICALFASTENER: (base, pre, size) => [...base, ...size, pre],          // …, Tag, NominalDiameter, NominalLength, PredefinedType
  IFCELEMENTASSEMBLY: (base, pre) => [...base, enumv('NOTDEFINED'), pre],       // …, Tag, AssemblyPlace, PredefinedType
};
/** A fastener's NominalDiameter / NominalLength (mm in the part, IfcPositiveLengthMeasure in the file's unit). */
const sizeArgs = (mmPer, d, l) => [d > 0 ? real(d / mmPer) : null, l > 0 ? real(l / mmPer) : null];
const sizeMm = (mmPer, v) => (v && typeof v === 'object' && v.kind === 'real' ? +(v.value * mmPer).toFixed(6) : undefined);
/* The kit roles of a part's assembly (bom-fm-1: assembly [{part, qty, role, place}]) and the class each is. */
const KIT_ROLE = {
  fastener: { entity: 'IfcMechanicalFastenerType', occurrence: 'IfcMechanicalFastener' },
  mount: { entity: 'IfcDiscreteAccessoryType', occurrence: 'IfcDiscreteAccessory', predefined: 'BRACKET' },
  accessory: { entity: 'IfcDiscreteAccessoryType', occurrence: 'IfcDiscreteAccessory' },
  supply: { entity: 'IfcDiscreteAccessoryType', occurrence: 'IfcDiscreteAccessory' },
};
export const FASTENER_PREDEFINED = ['ANCHORBOLT', 'BOLT', 'CHAIN', 'COUPLER', 'DOWEL', 'NAIL', 'NAILPLATE', 'RAILFASTENING',
  'RAILJOINT', 'RIVET', 'ROPE', 'SCREW', 'SHEARCONNECTOR', 'STAPLE', 'STUDSHEARCONNECTOR'];
export const ACCESSORY_PREDEFINED = ['ANCHORPLATE', 'BRACKET', 'CABLEARRANGER', 'FILLER', 'INSULATOR', 'LOCK', 'SHOE'];
const PLACES = new Set(['SITE', 'FACTORY']);

export const slug = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-');
const occClass = (typeEntity) => (typeEntity && /Type$/.test(typeEntity) ? typeEntity.slice(0, -4) : 'IfcBuildingElementProxy');

/** The IFC class a kit entry is: its role's, with the entry's own PredefinedType when IFC has the word. */
export function kitClass(entry = {}) {
  const role = KIT_ROLE[entry.role] || KIT_ROLE.accessory;
  const want = String(entry.predefined || role.predefined || '').toUpperCase();
  const words = role.entity === 'IfcMechanicalFastenerType' ? FASTENER_PREDEFINED : ACCESSORY_PREDEFINED;
  const predefined = words.includes(want) ? want : 'USERDEFINED';
  return { entity: role.entity, predefined, elementType: predefined === 'USERDEFINED' ? (entry.name || entry.role || 'kit item') : null };
}

/* ================================================================== READ */

/** Read an IFC text (or a parsed StepFile) into the BOM's types, occurrences and cost data. */
export function bomQuery(input) {
  const file = typeof input === 'string' ? S.parseStep(input) : input;
  const project = S.entitiesByType(file, 'IFCPROJECT')[0];
  const types = new Map();       // key -> type record
  const occurrences = [];
  const occById = new Map();     // entity id -> occurrence record
  const typeKeyById = new Map(); // type entity id -> key
  const mmPer = mmPerLengthUnit(file.entities);

  for (const rel of S.entitiesByType(file, 'IFCRELDEFINESBYTYPE')) {
    const t = S.deref(file, rel.args[5]);
    if (!t) continue;
    let key = typeKeyById.get(t.id);
    if (!key) {
      key = textOf(t.args[7]) || `gid:${t.args[0]}`;
      typeKeyById.set(t.id, key);
      const mt = S.getPsets(file, t).Pset_ManufacturerTypeInformation || {};
      const name = textOf(t.args[2]);
      const rec = {
        key, gid: t.args[0], entity: ifcName(t.type), predefined: enumOf(typeLayoutPredefined(t)) || 'NOTDEFINED',
        elementType: textOf(t.args[8]) || null, name, desc: textOf(t.args[3]) || name,
        mfr: str(mt.Manufacturer) || '', model: str(mt.ModelReference) || '', sku: str(mt.ArticleNumber) || str(mt.ModelReference) || '',
        part: textOf(t.args[7]) || null,
      };
      if (t.type === 'IFCMECHANICALFASTENERTYPE') {
        const d = sizeMm(mmPer, t.args[10]), l = sizeMm(mmPer, t.args[11]);
        if (d) rec.diameterMm = d;
        if (l) rec.lengthMm = l;
      }
      types.set(key, rec);
    }
    for (const r of refs(rel.args[4])) {
      const e = file.byId.get(r.id);
      if (!e || occById.has(e.id)) continue;
      const ps = S.getPsets(file, e);
      const o = { gid: e.args[0], type: key, entity: ifcName(e.type), tag: textOf(e.args[7]), name: textOf(e.args[2]), from: 'rig' };
      const serial = str(ps.Pset_ManufacturerOccurrence?.SerialNumber);
      const mac = str(ps.APK_Identity?.MacAddress);
      if (serial) o.serial = serial;
      if (mac) o.mac = mac.toLowerCase();
      if (e.type === 'IFCMECHANICALFASTENER') {
        const d = sizeMm(mmPer, e.args[8]), l = sizeMm(mmPer, e.args[9]);
        if (d) o.diameterMm = d;
        if (l) o.lengthMm = l;
      }
      occById.set(e.id, o);
      occurrences.push(o);
    }
  }

  // kits: walk IfcRelAggregates up from each occurrence to the nearest typed occurrence above it
  const parent = new Map();
  for (const rel of S.entitiesByType(file, 'IFCRELAGGREGATES')) {
    const host = S.deref(file, rel.args[4]);
    if (host) for (const r of refs(rel.args[5])) parent.set(r.id, host);
  }
  const placeOf = new Map();
  for (const [id, o] of occById) {
    for (let up = parent.get(id), hops = 0; up && hops < 16; up = parent.get(up.id), hops++) {
      if (up.type === 'IFCELEMENTASSEMBLY' && !placeOf.has(id)) {
        const place = enumOf(up.args[8]);
        if (PLACES.has(place)) placeOf.set(id, place);
      }
      const host = occById.get(up.id);
      if (host) { o.kitOf = host.gid; if (placeOf.has(id)) o.place = placeOf.get(id); break; }
    }
  }

  // where each occurrence is: its (or its aggregate's) spatial container
  const within = containers(file);
  for (const [id, o] of occById) {
    let at = within.get(id);
    for (let up = parent.get(id), hops = 0; !at && up && hops < 16; up = parent.get(up.id), hops++) at = within.get(up.id);
    if (at) o.location = textOf(at.args[2]);
  }

  return { schema: S.schemaOf(file), project: project ? { gid: project.args[0], name: textOf(project.args[2]) } : null,
    types, occurrences, ...readCosts(file, occById), file };
}

/** mm per unit of the file's IfcSIUnit LENGTHUNIT (1 when it is the millimetre, as APK writes). */
function mmPerLengthUnit(entities) {
  const prefix = { MILLI: 1, CENTI: 10, DECI: 100, KILO: 1e6 };
  for (const u of entities) {
    if (u.type !== 'IFCSIUNIT' || enumOf(u.args[1]) !== 'LENGTHUNIT') continue;
    const p = enumOf(u.args[2]);
    return p ? prefix[p] ?? 1000 : 1000;
  }
  return 1;
}

const ifcName = (upper) => {
  const known = ['IfcAudioVisualApplianceType', 'IfcCommunicationsApplianceType', 'IfcFlowInstrumentType', 'IfcElectricApplianceType',
    'IfcMechanicalFastenerType', 'IfcDiscreteAccessoryType', 'IfcElementAssemblyType', 'IfcCableSegmentType', 'IfcBuildingElementProxyType',
    'IfcElectricGeneratorType', 'IfcDistributionBoardType', 'IfcElectricDistributionBoardType', 'IfcFurnitureType', 'IfcOutletType',
    'IfcLightFixtureType', 'IfcControllerType', 'IfcSwitchingDeviceType', 'IfcProtectiveDeviceType', 'IfcTransformerType',
    'IfcUnitaryControlElementType', 'IfcCableFittingType', 'IfcElectricFlowStorageDeviceType', 'IfcMobileTelecommunicationsApplianceType'];
  const all = [...known, ...known.map((k) => k.slice(0, -4))];
  return all.find((k) => k.toUpperCase() === upper) || upper;
};
const typeLayoutPredefined = (t) => (t.type === 'IFCMECHANICALFASTENERTYPE' ? t.args[9] : t.type === 'IFCFURNITURETYPE' ? t.args[10] : t.args[9]);

/** Prices, procurement, orders and currency from an apk.bom/2 cost schedule in the file. */
function readCosts(file, occById) {
  const prices = {}, procurement = {};
  let currency = null;
  const mu = S.entitiesByType(file, 'IFCMONETARYUNIT')[0];
  if (mu) currency = textOf(mu.args[0]) || null;
  const schedule = S.entitiesByType(file, 'IFCCOSTSCHEDULE').find((e) => e.args[5] === BOM_PROJECTION);
  if (!schedule) return { prices, procurement, currency, priced: false };
  const controls = referrers(file, 'IFCRELASSIGNSTOCONTROL', 6);
  const keyOf = (ctrl) => {
    for (const rel of controls.get(ctrl.id) || []) for (const r of refs(rel.args[4])) { const o = occById.get(r.id); if (o) return o.type; }
    return null;
  };
  for (const item of S.entitiesByType(file, 'IFCCOSTITEM')) {
    const key = keyOf(item);
    if (!key) continue;
    const cv = S.deref(file, refs(item.args[7])[0]);
    const v = cv && S.unwrap(cv.args[2]);
    prices[key] = typeof v === 'number' ? v : 0;
    const p = S.getPsets(file, item).APK_Procurement || {};
    const rec = { status: PROCUREMENT.includes(p.Status) ? p.Status : 'Specified' };
    if (p.LeadTime) rec.leadTime = String(p.LeadTime);
    if (p.QuoteReference) rec.quote = String(p.QuoteReference);
    procurement[key] = rec;
  }
  const actors = referrers(file, 'IFCRELASSIGNSTOACTOR', 4);
  for (const order of S.entitiesByType(file, 'IFCPROJECTORDER')) {
    const po = textOf(order.args[5]);
    let supplier = '';
    for (const rel of actors.get(order.id) || []) {
      const actor = S.deref(file, rel.args[6]);
      const org = actor && S.deref(file, actor.args[5]);
      if (org) supplier = textOf(org.args[1]) || textOf(actor.args[2]);
    }
    const seen = new Set();
    for (const rel of controls.get(order.id) || []) {
      for (const r of refs(rel.args[4])) {
        const o = occById.get(r.id);
        if (!o || seen.has(o.type)) continue;
        seen.add(o.type);
        const rec = (procurement[o.type] ||= { status: 'Specified' });
        if (po) rec.po = po;
        if (supplier) rec.supplier = supplier;
      }
    }
  }
  return { prices, procurement, currency, priced: true };
}

/* ================================================================== WRITE */

/** The BOM model (bomModel.js BomModel) as IFC4X3_ADD2 STEP text: over its rig when it has one. */
export function bomToIfc(model) {
  const out = model.baseText
    ? IfcOut.over(model.baseText, { strip: BOM_PROJECTION })
    : IfcOut.fresh({ fileName: 'bom.ifc', app: 'EDITORS.BOM', project: model.title || 'Bill of materials', scope: `bom/${model.id}` });
  const R = ['bom', out.projectGid];
  const lines = model.lines();

  // the marker first: everything after it, to the next projection, is this projection
  const priced = lines.some((l) => l.unitCost > 0);
  const schedule = out.rooted('IFCCOSTSCHEDULE', [...R, 'schedule'], ['Bill of materials', null, null, BOM_PROJECTION,
    enumv(priced ? 'PRICEDBILLOFQUANTITIES' : 'UNPRICEDBILLOFQUANTITIES'), overallStatus(lines), null, null]);
  out.currency(model.currency || 'USD');

  const host = spatialHost(out, R);
  const mmPer = mmPerLengthUnit(out.entities);
  const typeRef = typesOf(out);
  const occRef = new Map();
  for (const o of model.occurrences) { const r = out.byGid(o.gid); if (r) occRef.set(o.gid, r); }

  // types the rig does not carry
  const newTypes = [];
  for (const l of lines) {
    if (typeRef.has(l.key)) continue;
    const t = model.types[l.key] || {};
    const entity = String(t.entity || 'IfcBuildingElementProxyType').toUpperCase();
    const pre = enumv(t.predefined || 'NOTDEFINED');
    const mti = [
      ['Manufacturer', label(t.mfr)], ['ModelReference', label(t.model)], ['ModelLabel', label(t.name)], ['ArticleNumber', ident(t.sku)],
    ].filter(([, v]) => v).map(([n, v]) => out.add('IFCPROPERTYSINGLEVALUE', [n, null, v, null]));
    const psets = mti.length ? [out.rooted('IFCPROPERTYSET', ['part', l.key, 'mti', 'pset'], ['Pset_ManufacturerTypeInformation', null, mti])] : null;
    const base = [str(t.name || t.desc || l.key), str(t.desc && t.desc !== t.name ? t.desc : null), null, psets, null,
      t.part || (l.key.startsWith('gid:') ? null : l.key), str(t.predefined === 'USERDEFINED' ? (t.elementType || t.name || 'APK part') : t.elementType)];
    const make = TYPE_LAYOUT[entity] || ((b, p) => [...b, p]);
    const gid = l.key.startsWith('gid:') ? l.key.slice(4) : S.ifcGuid('part', l.key);
    const r = out.add(entity, [gid, out.oh, ...make(base, pre, sizeArgs(mmPer, t.diameterMm, t.lengthMm))]);
    typeRef.set(l.key, { ref: r, rel: null, entity });
    newTypes.push(r);
  }
  if (newTypes.length) out.declare([...R, 'types'], newTypes);

  // occurrences the rig does not carry (a pick, a discovered thing, an old typed line, a kit unit)
  // The occurrence leaves PredefinedType and ObjectType unset: its type says what it is (as bench_ifc.py writes).
  const contained = [];
  const byType = new Map();
  const written = new Set();
  for (const o of model.occurrences) {
    if (occRef.has(o.gid)) continue;
    const t = model.types[o.type] || {};
    const entity = (o.entity || occClass(t.entity)).toUpperCase();
    const base = [str(o.name || t.name || o.type), null, null, null, null, str(o.tag)];
    const make = OCC_LAYOUT[entity] || ((b, p) => [...b, p]);
    const r = out.add(entity, [o.gid, out.oh, ...make(base, null, sizeArgs(mmPer, o.diameterMm ?? t.diameterMm, o.lengthMm ?? t.lengthMm))]);
    occRef.set(o.gid, r);
    written.add(o.gid);
    if (!o.kitOf) contained.push(r);
    (byType.get(o.type) || byType.set(o.type, []).get(o.type)).push(r);
    out.pset(['bom', 'occ', o.gid], 'Pset_ManufacturerOccurrence', [r], [['SerialNumber', ident(o.serial)]]);
    out.pset(['bom', 'occ', o.gid], 'APK_Identity', [r], [
      ['IdentityKey', ident(o.mac ? `mac:${o.mac}` : o.serial ? `serial:${slug(t.mfr || 'unknown')}/${o.serial}` : null)],
      ['MacAddress', ident(o.mac)]]);
  }
  for (const [key, list] of byType) {
    const t = typeRef.get(key);
    if (t.rel) t.rel.args[4] = [...refs(t.rel.args[4]), ...list];   // IfcTypeObject.Types is SET [0:1]: one rel per type
    else t.rel = out.byId.get(out.rooted('IFCRELDEFINESBYTYPE', [...R, 'type', key], [null, null, list, t.ref]).id);
  }
  if (contained.length) out.rooted('IFCRELCONTAINEDINSPATIALSTRUCTURE', [...R, 'contained'], [null, null, contained, host]);

  // kits: device ─IfcRelAggregates─▶ IfcElementAssembly ACCESSORY_ASSEMBLY ─IfcRelAggregates─▶ one occurrence per unit
  const kits = new Map();
  for (const o of model.occurrences) {
    if (!o.kitOf || !occRef.has(o.kitOf) || !written.has(o.gid)) continue;
    const place = PLACES.has(o.place) ? o.place : 'SITE';
    const k = `${o.kitOf}|${place}`;
    (kits.get(k) || kits.set(k, { device: o.kitOf, place, parts: [] }).get(k)).parts.push(occRef.get(o.gid));
  }
  const byDevice = new Map();
  for (const kit of kits.values()) {
    const dev = model.occurrences.find((x) => x.gid === kit.device) || {};
    const asm = out.rooted('IFCELEMENTASSEMBLY', [...R, 'kit', kit.device, kit.place],
      [`Kit ${dev.tag || dev.name || ''}`.trim(), null, null, null, null, str(dev.tag), enumv(kit.place), enumv('ACCESSORY_ASSEMBLY')]);
    out.rooted('IFCRELAGGREGATES', [...R, 'kit', kit.device, kit.place, 'parts'], ['Kit', null, asm, kit.parts]);
    (byDevice.get(kit.device) || byDevice.set(kit.device, []).get(kit.device)).push(asm);
  }
  for (const [device, asms] of byDevice) out.rooted('IFCRELAGGREGATES', [...R, 'kit', device], ['Kits', null, occRef.get(device), asms]);

  // the cost items: a total over one item per line
  const lineItems = [];
  for (const l of lines) {
    const occs = model.occurrences.filter((o) => o.type === l.key).map((o) => occRef.get(o.gid)).filter(Boolean);
    const value = out.add('IFCCOSTVALUE', ['Unit price', null, typed('IFCMONETARYMEASURE', real(Number(l.unitCost) || 0)), null, null, null, null, null, null, null]);
    const qty = out.add('IFCQUANTITYCOUNT', ['Count', null, null, occs.length, null]);   // IfcCountMeasure is an INTEGER in IFC4X3
    const item = out.rooted('IFCCOSTITEM', [...R, 'cost', l.key], [str(l.desc || l.key), null, null, str(l.sku || l.key), enumv('NOTDEFINED'), [value], [qty]]);
    if (occs.length) out.rooted('IFCRELASSIGNSTOCONTROL', [...R, 'cost', l.key, 'occurrences'], [null, null, occs, null, item]);
    const p = model.procurement[l.key] || {};
    out.pset([...R, 'cost', l.key], 'APK_Procurement', [item], [
      ['Status', label(PROCUREMENT.includes(p.status) ? p.status : 'Specified')],
      ['LeadTime', p.leadTime && /^P/.test(p.leadTime) ? typed('IFCDURATION', String(p.leadTime)) : null],
      ['QuoteReference', ident(p.quote)]]);
    lineItems.push(item);
  }
  const totalValue = out.add('IFCCOSTVALUE', ['Total', null, null, null, null, null, '*', null, null, null]);
  const total = out.rooted('IFCCOSTITEM', [...R, 'cost', 'total'], ['Total', null, null, null, enumv('NOTDEFINED'), [totalValue], null]);
  out.rooted('IFCRELASSIGNSTOCONTROL', [...R, 'schedule', 'items'], [null, null, [total], null, schedule]);
  if (lineItems.length) out.rooted('IFCRELNESTS', [...R, 'cost', 'total', 'lines'], [null, null, total, lineItems]);

  // purchase orders, by PO number, and their suppliers
  const controls = [schedule];
  const orders = new Map();
  for (const l of lines) {
    const p = model.procurement[l.key] || {};
    if (!p.po) continue;
    const o = orders.get(p.po) || orders.set(p.po, { po: p.po, supplier: '', keys: [], statuses: [] }).get(p.po);
    o.keys.push(l.key);
    o.statuses.push(p.status || 'Specified');
    if (p.supplier && !o.supplier) o.supplier = p.supplier;
  }
  const suppliers = new Map();
  for (const o of orders.values()) {
    const occs = model.occurrences.filter((x) => o.keys.includes(x.type)).map((x) => occRef.get(x.gid)).filter(Boolean);
    const status = o.statuses.includes('Ordered') ? 'Ordered' : o.statuses.includes('Quoted') ? 'Quoted' : 'Specified';
    const order = out.rooted('IFCPROJECTORDER', [...R, 'order', o.po], [`PO ${o.po}`, null, null, o.po, enumv('PURCHASEORDER'), status, null]);
    controls.push(order);
    if (occs.length) out.rooted('IFCRELASSIGNSTOCONTROL', [...R, 'order', o.po, 'occurrences'], [null, null, occs, null, order]);
    if (o.supplier) (suppliers.get(o.supplier) || suppliers.set(o.supplier, []).get(o.supplier)).push(order);
  }
  for (const [name, list] of suppliers) {
    const actor = actorFor(out, [...R, 'supplier', slug(name)], slug(name), name, 'SUPPLIER');
    out.rooted('IFCRELASSIGNSTOACTOR', [...R, 'supplier', slug(name), 'orders'], [null, null, list, null, actor, out.add('IFCACTORROLE', [enumv('SUPPLIER'), null, null])]);
  }
  out.declare([...R, 'controls'], controls);

  // makers: one MANUFACTURER actor per maker, over its type objects
  const makers = new Map();
  for (const l of lines) {
    const t = model.types[l.key] || {};
    if (!t.mfr) continue;
    const id = (t.part && t.part.includes('/') ? t.part.split('/')[0] : '') || slug(t.mfr);
    const m = makers.get(id) || makers.set(id, { name: t.mfr, types: [] }).get(id);
    const tr = typeRef.get(l.key);
    if (tr && !m.types.some((x) => x.id === tr.ref.id)) m.types.push(tr.ref);
  }
  const haveMaker = new Set(out.all('IFCORGANIZATION').filter((o) => refs(o.args[3]).some((r) => {
    const role = out.byId.get(r.id); return role && enumOf(role.args[0]) === 'MANUFACTURER';
  })).map((o) => textOf(o.args[0])));
  for (const [id, m] of makers) {
    if (haveMaker.has(id) || !m.types.length) continue;
    const actor = actorFor(out, [...R, 'maker', id], id, m.name, 'MANUFACTURER');
    out.rooted('IFCRELASSIGNSTOACTOR', [...R, 'maker', id, 'types'], [null, null, m.types, null, actor, out.add('IFCACTORROLE', [enumv('MANUFACTURER'), null, null])]);
  }
  return out.text();
}

function actorFor(out, roles, id, name, role) {
  const org = out.add('IFCORGANIZATION', [str(id), name, null, [out.add('IFCACTORROLE', [enumv(role), null, null])], null]);
  return out.rooted('IFCACTOR', roles, [name, null, null, org]);
}

function overallStatus(lines) {
  if (!lines.length) return 'Specified';
  const s = new Set(lines.map((l) => l.status));
  return s.size === 1 ? [...s][0] : s.has('Ordered') ? 'Partly ordered' : s.has('Quoted') ? 'Partly quoted' : 'Specified';
}

/** type key -> {ref, rel, entity} of every type object the file already carries (Tag = part id). */
function typesOf(out) {
  const map = new Map();
  const rels = new Map();
  for (const rel of out.all('IFCRELDEFINESBYTYPE')) { const t = refs(rel.args[5])[0]; if (t) rels.set(t.id, rel); }
  for (const e of out.entities) {
    if (!S.isTypeObject(e.type) || e.type === 'IFCPROJECTLIBRARY') continue;
    const key = textOf(e.args[7]) || `gid:${e.args[0]}`;
    if (!map.has(key)) map.set(key, { ref: ref(e.id), rel: rels.get(e.id) || null, entity: e.type });
  }
  return map;
}

/** Where new occurrences go: the rig's space (else storey, building, site); a model with none gets its own spine. */
function spatialHost(out, R) {
  for (const t of ['IFCSPACE', 'IFCBUILDINGSTOREY', 'IFCBUILDING', 'IFCSITE']) { const e = out.first(t); if (e) return ref(e.id); }
  const site = out.rooted('IFCSITE', [...R, 'site'], ['Site', null, null, null, null, null, enumv('ELEMENT'), null, null, null, null, null]);
  const building = out.rooted('IFCBUILDING', [...R, 'building'], ['Building', null, null, null, null, null, enumv('ELEMENT'), null, null, null]);
  const storey = out.rooted('IFCBUILDINGSTOREY', [...R, 'storey'], ['Level 0', null, null, null, null, null, enumv('ELEMENT'), null]);
  out.rooted('IFCRELAGGREGATES', [...R, 'site', 'agg'], [null, null, out.project, [site]]);
  out.rooted('IFCRELAGGREGATES', [...R, 'building', 'agg'], [null, null, site, [building]]);
  out.rooted('IFCRELAGGREGATES', [...R, 'storey', 'agg'], [null, null, building, [storey]]);
  return storey;
}
