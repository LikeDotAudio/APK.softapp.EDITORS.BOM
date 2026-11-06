// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
/* ifcOut.mjs — WRITING AN IFC4X3_ADD2 MODEL ON THE CONTRACTS STEP CODEC (js/ifc/apk-ifc.mjs).
   The same file sits in EDITORS.BOM, EDITORS.Readiness and EDITORS.RACI.

     IfcOut.over(text)    a rig / bench .ifc (GET /api/bim/bench.ifc, or any IFC4X3 file): every entity
                          is kept as read and new ones are appended after the highest id, so the editor's
                          projection rides in the rig file without touching what was there
     IfcOut.fresh(opts)   a model of its own: the header and owner history bim/ifc.py writes, the units
                          (mm, kg, W) and one IfcProject

   Nothing is a clock: FILE_NAME carries 1970-01-01T00:00:00 as DATABASE.server.BIM does, and every
   GlobalId is ifcGuid(...roles) (contracts/src/ifc/guid.ts), so the same input gives the same bytes.
   Standard IFC names only where IFC4X3 has them; APK_* sets for the rest (Pset_ is reserved). */
import * as S from './apk-ifc.mjs';

export const { ref, real, enumv, typed, ifcGuid } = S;
export const label = (v) => (v == null || v === '' ? null : typed('IFCLABEL', String(v)));
export const ident = (v) => (v == null || v === '' ? null : typed('IFCIDENTIFIER', String(v)));
export const textv = (v) => (v == null || v === '' ? null : typed('IFCTEXT', String(v)));
export const str = (v) => (v == null || v === '' ? null : String(v));
export const isRef = (v) => !!v && typeof v === 'object' && v.kind === 'ref';
export const refs = (v) => (Array.isArray(v) ? v.filter(isRef) : isRef(v) ? [v] : []);
export const enumOf = (v) => (v && typeof v === 'object' && v.kind === 'enum' ? v.value : '');
export const textOf = (v) => (typeof v === 'string' ? v : '');

const EPOCH = '1970-01-01T00:00:00';
const clone = (v) => (Array.isArray(v) ? v.map(clone) : v && typeof v === 'object' ? { ...v } : v);
/** The first entity of an APK projection: IfcCostSchedule / IfcWorkSchedule / IfcWorkPlan, Identification apk.<x>/<n>. */
export const isMarker = (e) => /^IFC(COSTSCHEDULE|WORKSCHEDULE|WORKPLAN)$/.test(e.type) && /^apk\.[a-z]+\/\d+$/.test(String(e.args[5] ?? ''));

export class IfcOut {
  constructor(file) {
    this.header = file.header;
    this.entities = file.entities.map((e) => ({ ...e, args: clone(e.args) }));
    this.byId = new Map(this.entities.map((e) => [e.id, e]));
    this.next = this.entities.reduce((m, e) => Math.max(m, e.id), 0) + 1;
  }

  /** Over an existing model (text or a parsed StepFile). `strip` = the projection id (e.g. 'apk.bom/2')
      an earlier save of this editor wrote into the file: it is taken out first, so a save of an opened
      twin replaces its projection instead of adding a second one. */
  static over(textOrFile, { strip = null } = {}) {
    const f = typeof textOrFile === 'string' ? S.parseStep(textOrFile) : textOrFile;
    const out = new IfcOut(f);
    if (!out.first('IFCPROJECT')) throw new Error('this IFC file has no IfcProject');
    if (strip) out.strip(strip);
    return out;
  }

  /* A projection is appended as one run of entities that starts with its marker (an IfcCostSchedule or
     IfcWorkSchedule whose Identification is the projection id) and ends where the next projection's
     marker, or the file, ends. Taking it out: the run goes, and a list in the rest that points into it
     (the IfcUnitAssignment the currency joined, an IfcRelDefinesByType that gained occurrences) loses
     those members. A single reference into the run from outside it means another tool rewrote the
     file: that is an error, never a guess. */
  strip(projection) {
    const at = this.entities.findIndex((e) => isMarker(e) && e.args[5] === projection);
    if (at < 0) return false;
    let end = this.entities.findIndex((e, i) => i > at && isMarker(e));
    if (end < 0) end = this.entities.length;
    const dead = new Set(this.entities.slice(at, end).map((e) => e.id));
    const live = this.entities.filter((e) => !dead.has(e.id));
    const prune = (v, who) => {
      if (Array.isArray(v)) return v.filter((x) => !(isRef(x) && dead.has(x.id))).map((x) => prune(x, who));
      if (isRef(v) && dead.has(v.id)) throw new Error(`#${who.id}=${who.type} points into the ${projection} projection: the file was rewritten after it was saved`);
      return v;
    };
    for (const e of live) e.args = e.args.map((a) => prune(a, e));
    this.entities = live;
    this.byId = new Map(live.map((e) => [e.id, e]));
    this._gids = null;
    this.next = live.reduce((m, e) => Math.max(m, e.id), 0) + 1;
    return true;
  }

  /** A model of its own. scope = the roles every GlobalId of this file starts with. */
  static fresh({ fileName = 'model.ifc', app = 'APK.audio', project = 'Project', description = null, scope = 'model' } = {}) {
    const out = new IfcOut({ header: [], entities: [] });
    out.header = [
      { type: 'FILE_DESCRIPTION', args: [['ViewDefinition [ReferenceView]'], '2;1'] },
      { type: 'FILE_NAME', args: [fileName, EPOCH, ['APK.audio'], ['APK.audio'], app, `APK.audio ${app}`, ''] },
      { type: 'FILE_SCHEMA', args: [['IFC4X3_ADD2']] },
    ];
    const person = out.add('IFCPERSON', [null, 'APK.audio', null, null, null, null, null, null]);
    const org = out.add('IFCORGANIZATION', [null, 'APK.audio', app, null, null]);
    const po = out.add('IFCPERSONANDORGANIZATION', [person, org, null]);
    const application = out.add('IFCAPPLICATION', [org, '1', `APK.audio ${app}`, app]);
    out.add('IFCOWNERHISTORY', [po, application, null, null, null, null, null, 0]);
    const units = [
      out.add('IFCSIUNIT', [S.DERIVED, enumv('LENGTHUNIT'), enumv('MILLI'), enumv('METRE')]),
      out.add('IFCSIUNIT', [S.DERIVED, enumv('MASSUNIT'), enumv('KILO'), enumv('GRAM')]),
      out.add('IFCSIUNIT', [S.DERIVED, enumv('POWERUNIT'), null, enumv('WATT')]),
    ];
    const ua = out.add('IFCUNITASSIGNMENT', [units]);
    out.add('IFCPROJECT', [ifcGuid(scope, 'project'), out.oh, project, str(description), null, null, null, null, ua]);
    return out;
  }

  add(type, args) {
    const id = this.next++;
    const e = { id, type, args };
    this.entities.push(e);
    this.byId.set(id, e);
    return ref(id);
  }

  get(r) { return isRef(r) ? this.byId.get(r.id) : undefined; }
  all(type) { return this.entities.filter((e) => e.type === type); }
  first(type) { return this.entities.find((e) => e.type === type); }
  get oh() { const e = this.first('IFCOWNERHISTORY'); return e ? ref(e.id) : null; }
  get project() { return ref(this.first('IFCPROJECT').id); }
  get projectGid() { return this.first('IFCPROJECT').args[0]; }

  /** The entity with this GlobalId (a rooted entity's attribute 0). */
  byGid(gid) {
    if (!this._gids) {
      this._gids = new Map();
      for (const e of this.entities) if (typeof e.args[0] === 'string' && S.IFC_GUID_RE.test(e.args[0])) this._gids.set(e.args[0], e);
    }
    const e = this._gids.get(gid);
    return e ? ref(e.id) : null;
  }

  /** A rooted entity: GlobalId from roles, owner history, then the rest of its attributes. */
  rooted(type, roles, rest) {
    const gid = ifcGuid(...roles);
    const r = this.add(type, [gid, this.oh, ...rest]);
    if (this._gids) this._gids.set(gid, this.byId.get(r.id));
    return r;
  }

  /** The IfcMonetaryUnit of the file (added to its IfcUnitAssignment when it has none). */
  currency(code) {
    const ua = this.first('IFCUNITASSIGNMENT');
    const have = this.all('IFCMONETARYUNIT').find((u) => u.args[0] === code);
    if (have) return ref(have.id);
    const mu = this.add('IFCMONETARYUNIT', [code]);
    if (ua) ua.args = [[...(Array.isArray(ua.args[0]) ? ua.args[0] : []), mu]];
    else this.first('IFCPROJECT').args[8] = this.add('IFCUNITASSIGNMENT', [[mu]]);
    return mu;
  }

  /** IfcPropertySet + IfcRelDefinesByProperties. props: [[name, StepValue]]; null values are left out. */
  pset(roles, name, objects, props) {
    const values = props.filter(([, v]) => v != null)
      .map(([n, v]) => this.add('IFCPROPERTYSINGLEVALUE', [n, null, v, null]));
    if (!values.length || !objects.length) return null;
    const ps = this.rooted('IFCPROPERTYSET', [...roles, 'pset', name], [name, null, values]);
    this.rooted('IFCRELDEFINESBYPROPERTIES', [...roles, 'pset', name, 'rel'], [null, null, objects, ps]);
    return ps;
  }

  /** IfcRelDeclares from the project: what a control or a type belongs to. */
  declare(roles, defs) {
    if (defs.length) this.rooted('IFCRELDECLARES', [...roles, 'declares'], [null, null, this.project, defs]);
  }

  text() { return S.writeStep({ header: this.header, entities: this.entities }); }
}

/* ---- reading helpers the three editors share ------------------------------------------------- */

/** id -> [entities that reference it at argument `at`] for one relationship type. */
export function referrers(file, type, at) {
  const out = new Map();
  for (const rel of S.entitiesByType(file, type)) {
    for (const r of refs(rel.args[at])) {
      const list = out.get(r.id) || [];
      list.push(rel);
      out.set(r.id, list);
    }
  }
  return out;
}

/** element id -> the IfcSpace / IfcBuildingStorey / … it is contained in (IfcRelContainedInSpatialStructure). */
export function containers(file) {
  const out = new Map();
  for (const rel of S.entitiesByType(file, 'IFCRELCONTAINEDINSPATIALSTRUCTURE')) {
    const host = S.deref(file, rel.args[5]);
    for (const r of refs(rel.args[4])) if (host && !out.has(r.id)) out.set(r.id, host);
  }
  return out;
}

/** An ISO 8601 date (YYYY-MM-DD) as an IfcDateTime at 00:00, or null. */
export function dateTime(d) {
  const m = /^(\d{4}-\d{2}-\d{2})(T\d{2}:\d{2}(:\d{2})?)?/.exec(String(d || ''));
  if (!m) return null;
  return m[1] + (m[2] ? (m[3] ? m[2] : `${m[2]}:00`) : 'T00:00:00');
}
