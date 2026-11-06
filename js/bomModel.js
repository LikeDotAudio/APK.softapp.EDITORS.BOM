// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
/* bomModel.js — THE BOM AS OCCURRENCES GROUPED BY TYPE (bom-fm-1, apk.bom/2).

   The model holds what the bill is a query over, and the project data the bill adds:
     types        key -> the type a line is: the BIM part id (or the rig type's GlobalId), maker, model,
                  SKU, description, IFC class; a part's kit (`assembly` [{part, qty, role, place}])
     occurrences  one per placed thing: {gid, type, tag, name, serial?, mac?, kitOf?, place?, from}
                  from 'rig' (read from an .ifc), 'pick' (📚 Library), 'thing' (Discovered), 'kit' (one
                  unit of a device's kit), 'line' (a v1 typed line, kept until it is picked as a part)
     prices       key -> unit price (project data — the BIM library keeps none)
     procurement  key -> {status Specified|Quoted|Ordered, supplier?, po?, leadTime?, quote?}

   A line's qty is the count of its type's occurrences, never a typed counter: editing it adds or takes
   away planned ('pick') occurrences, never one the rig carries. Kits are expanded per occurrence, so two
   amps whose part has assembly [{screw, qty 4}] give 2 amps and 8 screws. A fastener entry may give its
   size (diameter_mm, length_mm): IfcMechanicalFastener NominalDiameter / NominalLength, never a string. Received / Staged / Installed
   are site stages, not procurement: they belong to EDITORS.Readiness (bom-fm-4); a v1 line that had one
   is Ordered here and keeps the old word as procurement.site.

   Identity is serial / MAC (ifcGuid inst/mac:<mac>, inst/serial:<maker>/<serial>), never an IP. */
import { ifcGuid, ifcTypeFor } from './ifc/apk-ifc.mjs';
import { bomQuery, kitClass, slug } from './bomIfc.js';

export const BOM_BLOCK_TYPE = 'bill_of_materials';
export const BOM_SCHEMA = 'apk.bom/2';
export const BOM_STATUSES = ['Specified', 'Quoted', 'Ordered'];
const SITE_STAGES = ['Received', 'Staged', 'Installed'];

const num = (v, dflt) => (Number.isFinite(Number(v)) && v !== '' && v !== null ? Number(v) : dflt);
const clone = (v) => JSON.parse(JSON.stringify(v));
const MAC = /^[0-9a-f]{2}(:[0-9a-f]{2}){5,7}$/;

export class BomModel {
  constructor() {
    /* No demo lines: every line comes from the BIM library (📚 Library, ROAD-3572), from Discovered,
       from a rig .ifc, or from an opened BOM block. */
    this.id = `bom_${Date.now().toString(36)}`;
    this.title = 'Bill of materials';
    this.currency = 'USD';
    this.source = null;        // {name, project} of the rig .ifc the occurrences were read from
    this.baseText = null;      // that rig's text, kept whole: the twin is written over it
    this.types = {};
    this.occurrences = [];
    this.prices = {};
    this.procurement = {};
  }

  /* ---- the query -------------------------------------------------------------------------------- */

  /** The lines: one per type with an occurrence, qty = how many, in the order the types came. */
  lines() {
    const count = new Map();
    for (const o of this.occurrences) count.set(o.type, (count.get(o.type) || 0) + 1);
    const out = [];
    for (const key of Object.keys(this.types)) {
      const qty = count.get(key) || 0;
      if (!qty) continue;
      const t = this.types[key];
      const own = this.occurrences.filter((o) => o.type === key);
      const p = this.procurement[key] || {};
      const line = {
        id: key, key, sku: t.sku || t.model || '', mfr: t.mfr || '', desc: t.desc || t.name || key, qty,
        unitCost: num(this.prices[key], 0), status: BOM_STATUSES.includes(p.status) ? p.status : 'Specified',
        supplier: p.supplier || '', po: p.po || '',
        placed: own.filter((o) => o.from === 'rig' || o.from === 'thing').length,
        kit: own.every((o) => o.kitOf),
      };
      if (t.part) line.bimId = t.part;
      if (t.bimRef) line.bimRef = { ...t.bimRef };
      const ids = own.filter((o) => o.mac || o.serial);
      if (ids.length === 1) { if (ids[0].mac) line.mac = ids[0].mac; if (ids[0].serial) line.serial = ids[0].serial; }
      out.push(line);
    }
    return out;
  }

  /** The lines, as the table shows them (the old name). */
  get items() { return this.lines(); }

  getTotalCost() {
    return this.lines().reduce((acc, l) => acc + l.qty * l.unitCost, 0);
  }

  /* ---- adding ----------------------------------------------------------------------------------- */

  type(key, t) {
    if (!this.types[key]) this.types[key] = { key, ...t };
    return this.types[key];
  }

  /** A part picked from the BIM library: one more occurrence of its type (and one of each kit unit).
      `bimRef` is the pick's BIM reference {part, url, rev} (bimLibrary.js bimFields). */
  addFromPart(part = {}, bimRef = null) {
    const key = part.id || (bimRef && bimRef.part);
    if (!key) return null;
    const choice = ifcTypeFor(part);
    const t = this.type(key, {
      part: key, name: part.name || part.model || key, desc: part.description || part.name || part.model || '',
      mfr: part.manufacturer || '', model: part.model || '', sku: part.part_number || part.model || '',
      entity: choice.entity || 'IfcBuildingElementProxyType', predefined: choice.entity ? choice.predefined : 'USERDEFINED',
      elementType: choice.entity ? choice.element_type : String(part.class || part.category || 'APK part'),
    });
    if (bimRef || part.ref) t.bimRef = { ...(bimRef || part.ref) };
    if (Array.isArray(part.assembly) && part.assembly.length) t.kit = clone(part.assembly);
    return this.plan(key);
  }

  /** One planned occurrence of a type, with its kit. */
  plan(key) {
    const n = this.nextIndex(key);
    const t = this.types[key];
    const o = { gid: ifcGuid('bom', this.id, 'planned', key, String(n)), type: key, tag: `${slug(t.model || t.name || key).toUpperCase() || 'ITEM'}-${n}`, name: t.name || key, from: 'pick' };
    this.occurrences.push(o);
    this.expandKit(o);
    return this.lines().find((l) => l.key === key);
  }

  nextIndex(key) {
    const used = new Set(this.occurrences.filter((o) => o.type === key && o.from === 'pick').map((o) => Number(String(o.tag).split('-').pop())));
    let n = 1;
    while (used.has(n)) n++;
    return n;
  }

  /** One typed occurrence per kit unit, aggregated under the device (bom-fm-1). */
  expandKit(device, seen = new Set()) {
    const t = this.types[device.type];
    if (!t || !Array.isArray(t.kit) || seen.has(device.type)) return;   // a kit that holds itself is cut
    seen.add(device.type);
    t.kit.forEach((entry, i) => {
      if (!entry || !entry.part) return;
      const cls = kitClass(entry);
      this.type(entry.part, {
        part: entry.part, name: entry.name || entry.part, desc: entry.name || entry.part, mfr: entry.manufacturer || '',
        model: entry.model || '', sku: entry.part_number || '', entity: cls.entity, predefined: cls.predefined, elementType: cls.elementType,
        ...(num(entry.diameter_mm, 0) > 0 ? { diameterMm: num(entry.diameter_mm, 0) } : {}),
        ...(num(entry.length_mm, 0) > 0 ? { lengthMm: num(entry.length_mm, 0) } : {}),
      });
      const qty = Math.max(0, Math.round(num(entry.qty, 1)));
      for (let n = 1; n <= qty; n++) {
        const unit = { gid: ifcGuid('bom', 'kit', device.gid, String(i), String(n)), type: entry.part, tag: '', name: entry.name || entry.part,
          kitOf: device.gid, place: String(entry.place || 'site').toUpperCase() === 'FACTORY' ? 'FACTORY' : 'SITE', from: 'kit' };
        this.occurrences.push(unit);
        this.expandKit(unit, new Set(seen));
      }
    });
  }

  /** A discovered thing: the occurrence it is, keyed by MAC / serial — an IP is never identity. */
  addFromThing(t = {}) {
    const mac = MAC.test(String(t.mac || '').toLowerCase()) ? String(t.mac).toLowerCase() : '';
    const serial = String(t.serial || '').trim();
    if (!mac && !serial) return null;
    if (this.occurrences.some((o) => (mac && o.mac === mac) || (serial && o.serial === serial))) return null;
    const key = t.part || `thing/${slug(t.vendor || 'unknown')}/${slug(t.model || 'device')}`;
    this.type(key, { part: t.part || null, name: [t.vendor, t.model].filter(Boolean).join(' ') || t.name || key, desc: t.name || t.model || '',
      mfr: t.vendor || '', model: t.model || '', sku: t.model || '', entity: 'IfcBuildingElementProxyType', predefined: 'USERDEFINED', elementType: 'Discovered device' });
    const o = { gid: ifcGuid(mac ? `inst/mac:${mac}` : `inst/serial:${slug(t.vendor || 'unknown')}/${serial}`), type: key, tag: '', name: t.name || t.model || mac || serial, from: 'thing' };
    if (mac) o.mac = mac;
    if (serial) o.serial = serial;
    this.occurrences.push(o);
    return this.lines().find((l) => l.key === key);
  }

  /** A v1 typed line (kept readable): its qty as that many occurrences, until it is picked as a part. */
  addItem(item = {}) {
    const key = item.bimId || `line/${item.id || `item_${Date.now()}_${Object.keys(this.types).length + 1}`}`;
    this.type(key, { part: item.bimId || null, name: item.desc || item.sku || key, desc: item.desc || '', mfr: item.mfr || '', model: '', sku: item.sku || '',
      entity: 'IfcBuildingElementProxyType', predefined: 'USERDEFINED', elementType: 'BOM line' });
    if (item.bimRef && item.bimRef.part) this.types[key].bimRef = { ...item.bimRef };
    const qty = Math.max(0, Math.round(num(item.qty, 1)));
    for (let n = 1; n <= qty; n++) {
      const o = { gid: ifcGuid('bom', this.id, 'line', key, String(n)), type: key, tag: `${slug(item.sku || 'line').toUpperCase()}-${n}`, name: item.desc || item.sku || key, from: 'line' };
      if (n === 1 && item.mac) o.mac = String(item.mac).toLowerCase();
      if (n === 1 && item.serial) o.serial = String(item.serial);
      this.occurrences.push(o);
    }
    if (item.unitCost != null) this.prices[key] = num(item.unitCost, 0);
    const status = String(item.status || 'Specified');
    this.procurement[key] = SITE_STAGES.includes(status) ? { status: 'Ordered', site: status } : { status: BOM_STATUSES.includes(status) ? status : 'Specified' };
    return this.lines().find((l) => l.key === key);
  }

  /* ---- editing ---------------------------------------------------------------------------------- */

  /** qty: planned occurrences come and go; one the rig (or the network) has is never taken away. */
  setQty(key, want) {
    const own = this.occurrences.filter((o) => o.type === key && !o.kitOf);
    if (!own.length) return;   // a kit line follows its devices
    const fixed = own.filter((o) => o.from !== 'pick' && o.from !== 'line').length;
    const target = Math.max(fixed, Math.round(num(want, own.length)));
    while (this.occurrences.filter((o) => o.type === key && !o.kitOf).length < target) this.plan(key);
    for (let have = own.length; have > target; have--) {
      const planned = this.occurrences.filter((o) => o.type === key && (o.from === 'pick' || o.from === 'line'));
      const last = planned[planned.length - 1];
      if (!last) break;
      this.dropOccurrence(last.gid);
    }
  }

  dropOccurrence(gid) {
    const kids = this.occurrences.filter((o) => o.kitOf === gid).map((o) => o.gid);
    this.occurrences = this.occurrences.filter((o) => o.gid !== gid);
    kids.forEach((k) => this.dropOccurrence(k));
  }

  updateItem(index, field, value) {
    const line = this.lines()[index];
    if (!line) return;
    const key = line.key;
    if (field === 'qty') this.setQty(key, value);
    else if (field === 'unitCost') this.prices[key] = num(value, 0);
    else if (field === 'status' || field === 'supplier' || field === 'po' || field === 'leadTime' || field === 'quote') {
      const p = (this.procurement[key] ||= { status: 'Specified' });
      if (field === 'status') p.status = BOM_STATUSES.includes(value) ? value : 'Specified';
      else if (value) p[field] = String(value);
      else delete p[field];
    } else if (field === 'desc') this.types[key].desc = String(value);
  }

  /** Take a line away: its planned occurrences go; the line stays while the rig still has some. */
  removeItem(index) {
    const line = this.lines()[index];
    if (!line) return null;
    for (const o of this.occurrences.filter((x) => x.type === line.key && (x.from === 'pick' || x.from === 'line' || x.from === 'thing'))) this.dropOccurrence(o.gid);
    if (!this.occurrences.some((o) => o.type === line.key)) delete this.types[line.key];
    return line;
  }

  /* ---- IFC in ----------------------------------------------------------------------------------- */

  /** Open a rig / bench .ifc (or a twin this editor saved): the occurrences are the file's; prices and
      procurement come from its cost schedule, else stay what this model had for the same type. What the
      editor added that the rig does not have (a pick, a discovered thing) stays. */
  loadIfc(text, name = 'model.ifc') {
    const q = bomQuery(text);
    if (!q.project) throw new Error('no IfcProject in this file');
    const rigGids = new Set(q.occurrences.map((o) => o.gid));
    const rigIds = new Set(q.occurrences.flatMap((o) => [o.mac && `m:${o.mac}`, o.serial && `s:${o.serial}`].filter(Boolean)));
    const kept = this.occurrences.filter((o) => o.from !== 'rig' && !rigGids.has(o.gid) && !(o.mac && rigIds.has(`m:${o.mac}`)) && !(o.serial && rigIds.has(`s:${o.serial}`)));
    const keptTypes = Object.fromEntries(Object.entries(this.types).filter(([k]) => kept.some((o) => o.type === k)));
    const types = {};
    for (const [k, t] of q.types) types[k] = { ...(this.types[k] || {}), ...t };   // the file's facts win; a pick's bimRef / kit stays
    for (const [k, t] of Object.entries(keptTypes)) if (!types[k]) types[k] = t;
    this.types = types;
    this.occurrences = [...q.occurrences, ...kept.filter((o) => !o.kitOf || kept.some((d) => d.gid === o.kitOf))];
    if (q.priced) { this.prices = { ...this.prices, ...q.prices }; this.procurement = { ...this.procurement, ...q.procurement }; }
    if (q.currency) this.currency = q.currency;
    this.source = { name, project: q.project.gid, schema: q.schema };
    this.baseText = text;
    return q;
  }

  /* ---- the block -------------------------------------------------------------------------------- */

  toBlock() {
    const items = this.lines();
    return {
      type: BOM_BLOCK_TYPE,
      schema: BOM_SCHEMA,
      id: this.id,
      title: this.title,
      currency: this.currency,
      source: this.source ? { ...this.source } : null,
      types: clone(this.types),
      occurrences: clone(this.occurrences),
      prices: { ...this.prices },
      procurement: clone(this.procurement),
      // derived, for a reader of the v1 block and the CSV report: never read back as counts
      items,
      totalCost: items.reduce((a, l) => a + l.qty * l.unitCost, 0),
      itemCount: items.length,
    };
  }

  fromBlock(block) {
    if (!block) return false;
    if (block.schema === BOM_SCHEMA && block.types && Array.isArray(block.occurrences)) {
      this.id = String(block.id || this.id);
      this.title = block.title || this.title;
      this.currency = block.currency || 'USD';
      this.source = block.source || null;
      this.baseText = null;
      this.types = clone(block.types);
      this.occurrences = clone(block.occurrences);
      this.prices = { ...(block.prices || {}) };
      this.procurement = clone(block.procurement || {});
      return true;
    }
    const raw = Array.isArray(block) ? block : block.items;
    if (!Array.isArray(raw)) return false;
    // apk.bom/1: typed lines -> types with that many occurrences (migration; a pick replaces them later)
    this.types = {}; this.occurrences = []; this.prices = {}; this.procurement = {}; this.source = null; this.baseText = null;
    for (const it of raw) this.addItem(it);
    return true;
  }
}
