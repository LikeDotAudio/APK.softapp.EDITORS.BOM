// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
// GENERATED — do not edit. The contracts IFC kit as plain ES module JS for a page with no build:
// contracts/src/ifc/step.ts (STEP codec), src/ifc/guid.ts (ifcGuid), src/ifc-vocab.ts (ifcTypeFor).
// Regenerate: node tests/fixtures/make_ifc_codec.mjs
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// ../../../../../contracts/src/ifc/step.ts
var DERIVED = Object.freeze({ kind: "derived" });
var real = (value) => ({ kind: "real", value });
var enumv = (value) => ({ kind: "enum", value });
var ref = (id) => ({ kind: "ref", id });
var typed = (type, value) => ({ kind: "typed", type, value });
var isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
var isRef = (v) => v != null && isObj(v) && v.kind === "ref";
var Reader = class {
  constructor(s) {
    __publicField(this, "s", s);
    __publicField(this, "i", 0);
  }
  fail(msg) {
    const line = this.s.slice(0, this.i).split("\n").length;
    throw new Error(`STEP: ${msg} at line ${line}`);
  }
  ws() {
    for (; ; ) {
      const c = this.s.charCodeAt(this.i);
      if (c === 32 || c === 9 || c === 10 || c === 13) this.i++;
      else if (c === 47 && this.s[this.i + 1] === "*") {
        const end = this.s.indexOf("*/", this.i + 2);
        if (end < 0) this.fail("unterminated comment");
        this.i = end + 2;
      } else return;
    }
  }
  peek() {
    this.ws();
    return this.s[this.i] ?? "";
  }
  eat(ch) {
    if (this.peek() !== ch) this.fail(`expected '${ch}'`);
    this.i++;
  }
  keyword() {
    this.ws();
    const m = /^!?[A-Za-z_][A-Za-z0-9_-]*/.exec(this.s.slice(this.i, this.i + 256));
    if (!m) this.fail("expected a keyword");
    this.i += m[0].length;
    return m[0].toUpperCase();
  }
  /** `KEYWORD(params)` */
  record() {
    const type = this.keyword();
    return { type, args: this.list() };
  }
  list() {
    this.eat("(");
    const out = [];
    if (this.peek() === ")") {
      this.i++;
      return out;
    }
    for (; ; ) {
      out.push(this.value());
      const c = this.peek();
      this.i++;
      if (c === ")") return out;
      if (c !== ",") this.fail("expected ',' or ')'");
    }
  }
  value() {
    const c = this.peek();
    if (c === "'") return this.string();
    if (c === "(") return this.list();
    if (c === "$") return this.i++, null;
    if (c === "*") return this.i++, DERIVED;
    if (c === "#") {
      const m = /^#(\d+)/.exec(this.s.slice(this.i, this.i + 32));
      if (!m) this.fail("bad reference");
      this.i += m[0].length;
      return { kind: "ref", id: Number(m[1]) };
    }
    if (c === ".") {
      const m = /^\.([A-Za-z_][A-Za-z0-9_]*)\./.exec(this.s.slice(this.i, this.i + 256));
      if (!m) this.fail("bad enumeration");
      this.i += m[0].length;
      return { kind: "enum", value: m[1].toUpperCase() };
    }
    if (c === '"') {
      const end = this.s.indexOf('"', this.i + 1);
      if (end < 0) this.fail("unterminated binary");
      const value = this.s.slice(this.i + 1, end);
      this.i = end + 1;
      return { kind: "binary", value };
    }
    if (/[-+0-9]/.test(c)) {
      const m = /^[-+]?\d+(\.\d*)?([eE][-+]?\d+)?/.exec(this.s.slice(this.i, this.i + 64));
      if (!m) this.fail("bad number");
      this.i += m[0].length;
      if (m[1] === void 0 && m[2] === void 0) return Number(m[0]);
      return { kind: "real", value: Number(m[0]), raw: m[0] };
    }
    if (/[A-Za-z_!]/.test(c)) {
      const type = this.keyword();
      const args = this.list();
      return { kind: "typed", type, value: args.length === 1 ? args[0] : args };
    }
    return this.fail(`unexpected '${c}'`);
  }
  string() {
    const s = this.s;
    let i = this.i + 1;
    let out = "";
    for (; ; ) {
      const c = s[i];
      if (c === void 0) this.fail("unterminated string");
      if (c === "'") {
        if (s[i + 1] === "'") {
          out += "'";
          i += 2;
          continue;
        }
        this.i = i + 1;
        return out;
      }
      if (c === "\\") {
        const rest = s.slice(i, i + 4);
        if (rest.startsWith("\\\\")) {
          out += "\\";
          i += 2;
        } else if (rest === "\\X2\\" || rest === "\\X4\\") {
          const width = rest === "\\X2\\" ? 4 : 8;
          const end = s.indexOf("\\X0\\", i + 4);
          if (end < 0) this.fail("unterminated \\X2\\ or \\X4\\");
          const hex = s.slice(i + 4, end);
          if (hex.length % width || /[^0-9A-Fa-f]/.test(hex)) this.fail("bad \\X2\\ or \\X4\\ hex");
          for (let k = 0; k < hex.length; k += width) {
            const code = parseInt(hex.slice(k, k + width), 16);
            out += width === 4 ? String.fromCharCode(code) : String.fromCodePoint(code);
          }
          i = end + 4;
        } else if (rest.startsWith("\\X\\")) {
          out += String.fromCharCode(parseInt(s.slice(i + 3, i + 5), 16));
          i += 5;
        } else if (rest.startsWith("\\S\\")) {
          out += String.fromCharCode(s.charCodeAt(i + 3) + 128);
          i += 4;
        } else if (/^\\P[A-I]\\/.test(rest)) {
          i += 4;
        } else {
          out += "\\";
          i += 1;
        }
        continue;
      }
      out += c;
      i++;
    }
  }
};
function parseStep(text) {
  const r = new Reader(text);
  const word = (w) => {
    if (r.keyword() !== w) r.fail(`expected ${w}`);
  };
  word("ISO-10303-21");
  r.eat(";");
  word("HEADER");
  r.eat(";");
  const header = [];
  for (r.ws(); !/^ENDSEC\b/i.test(text.slice(r.i, r.i + 7)); r.ws()) {
    header.push(r.record());
    r.eat(";");
  }
  word("ENDSEC");
  r.eat(";");
  word("DATA");
  if (r.peek() === "(") r.list();
  r.eat(";");
  const entities = [];
  const byId = /* @__PURE__ */ new Map();
  while (r.peek() === "#") {
    const m = /^#(\d+)/.exec(text.slice(r.i, r.i + 32));
    if (!m) r.fail("bad instance name");
    r.i += m[0].length;
    r.eat("=");
    let e;
    if (r.peek() === "(") {
      r.i++;
      const complex = [];
      while (r.peek() !== ")") complex.push(r.record());
      r.i++;
      e = { id: Number(m[1]), type: "", args: [], complex };
    } else {
      e = { id: Number(m[1]), ...r.record() };
    }
    r.eat(";");
    if (byId.has(e.id)) r.fail(`duplicate #${e.id}`);
    entities.push(e);
    byId.set(e.id, e);
  }
  word("ENDSEC");
  r.eat(";");
  word("END-ISO-10303-21");
  r.eat(";");
  return { header, entities, byId };
}
function encodeString(text) {
  let out = "'";
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (ch === "'") out += "''";
    else if (ch === "\\") out += "\\\\";
    else if (cp >= 32 && cp < 127) out += ch;
    else if (cp <= 65535) out += `\\X2\\${cp.toString(16).toUpperCase().padStart(4, "0")}\\X0\\`;
    else out += `\\X4\\${cp.toString(16).toUpperCase().padStart(8, "0")}\\X0\\`;
  }
  return out + "'";
}
function formatReal(x) {
  if (!Number.isFinite(x)) throw new Error(`STEP has no ${x}`);
  if (Number.isInteger(x) && Math.abs(x) < 1e21) return `${x.toFixed(0)}.`;
  const s = String(x);
  const m = /^(-?\d+)(\.\d+)?e([-+]\d+)$/.exec(s);
  if (!m) return s;
  return `${m[1]}${m[2] ?? "."}E${m[3].replace("+", "")}`;
}
function writeValue(v) {
  if (v === null) return "$";
  if (typeof v === "string") return encodeString(v);
  if (typeof v === "number") {
    if (!Number.isInteger(v)) throw new Error(`STEP INTEGER expected, got ${v} (use real())`);
    return String(v);
  }
  if (Array.isArray(v)) return `(${v.map(writeValue).join(",")})`;
  switch (v.kind) {
    case "real":
      return v.raw !== void 0 && Number(v.raw) === v.value ? v.raw : formatReal(v.value);
    case "enum":
      return `.${v.value}.`;
    case "ref":
      return `#${v.id}`;
    case "typed":
      return `${v.type}(${writeValue(v.value)})`;
    case "binary":
      return `"${v.value}"`;
    case "derived":
      return "*";
  }
}
var writeRecord = (r) => `${r.type}(${r.args.map(writeValue).join(",")})`;
function writeEntity(e) {
  const body = e.complex ? `(${e.complex.map(writeRecord).join("")})` : writeRecord(e);
  return `#${e.id}=${body};`;
}
function writeStep(file) {
  return [
    "ISO-10303-21;",
    "HEADER;",
    ...file.header.map((h) => `${writeRecord(h)};`),
    "ENDSEC;",
    "DATA;",
    ...file.entities.map(writeEntity),
    "ENDSEC;",
    "END-ISO-10303-21;",
    ""
  ].join("\n");
}
function schemaOf(file) {
  const fs = file.header.find((h) => h.type === "FILE_SCHEMA")?.args[0];
  return Array.isArray(fs) && typeof fs[0] === "string" ? fs[0] : void 0;
}
function entitiesByType(file, type) {
  const t = type.toUpperCase();
  return file.entities.filter((e) => e.type === t);
}
var inverses = /* @__PURE__ */ new WeakMap();
function inverseIndex(file) {
  let inv = inverses.get(file);
  if (inv) return inv;
  inv = /* @__PURE__ */ new Map();
  const walk = (v, from, seen) => {
    if (Array.isArray(v)) v.forEach((x) => walk(x, from, seen));
    else if (isRef(v)) {
      if (seen.has(v.id)) return;
      seen.add(v.id);
      const list = inv.get(v.id);
      if (list) list.push(from);
      else inv.set(v.id, [from]);
    } else if (isObj(v) && v.kind === "typed") walk(v.value, from, seen);
  };
  for (const e of file.entities) {
    const seen = /* @__PURE__ */ new Set();
    for (const a of e.args) walk(a, e, seen);
    for (const p of e.complex ?? []) for (const a of p.args) walk(a, e, seen);
  }
  inverses.set(file, inv);
  return inv;
}
function deref(file, v) {
  return isRef(v) ? file.byId.get(v.id) : void 0;
}
var refsIn = (v) => Array.isArray(v) ? v.flatMap(refsIn) : isRef(v) ? [v.id] : [];
function referrers(file, id, type, index) {
  return (inverseIndex(file).get(id) ?? []).filter((r) => r.type === type && refsIn(r.args[index]).includes(id));
}
function unwrap(v) {
  if (v === void 0 || v === null) return null;
  if (typeof v === "string" || typeof v === "number") return v;
  if (Array.isArray(v)) return v.map(unwrap);
  switch (v.kind) {
    case "real":
      return v.value;
    case "enum":
      return v.value === "T" ? true : v.value === "F" ? false : v.value === "U" ? "UNKNOWN" : v.value;
    case "typed":
      return unwrap(v.value);
    case "ref":
      return { ref: v.id };
    case "binary":
      return v.value;
    case "derived":
      return null;
  }
}
var isTypeObject = (type) => type !== "IFCRELDEFINESBYTYPE" && (/TYPE$|^IFCTYPE/.test(type) || /^IFC(DOOR|WINDOW)STYLE$/.test(type));
function propertyValue(file, p) {
  const a = p.args;
  const measured = (v, unitAt) => {
    const out = { value: unwrap(v) };
    if (v != null && isObj(v) && v.kind === "typed") out.measure = v.type;
    const unit = deref(file, a[unitAt]);
    if (unit) out.unit = unit;
    return out;
  };
  switch (p.type) {
    case "IFCPROPERTYSINGLEVALUE":
      return measured(a[2], 3);
    case "IFCPROPERTYLISTVALUE":
    // Name, Specification, ListValues, Unit
    case "IFCPROPERTYENUMERATEDVALUE":
      return measured(a[2], p.type === "IFCPROPERTYLISTVALUE" ? 3 : -1);
    case "IFCPROPERTYBOUNDEDVALUE":
      return {
        value: { UpperBoundValue: unwrap(a[2]), LowerBoundValue: unwrap(a[3]), SetPointValue: unwrap(a[5]) },
        ...deref(file, a[4]) ? { unit: deref(file, a[4]) } : {}
      };
    case "IFCPROPERTYREFERENCEVALUE":
      return { value: unwrap(a[3]) };
    default:
      if (p.type.startsWith("IFCQUANTITY")) return measured(a[3], 2);
      return { value: unwrap(a[2]) };
  }
}
function definitionProps(file, def, detail) {
  const out = {};
  const list = def.type === "IFCELEMENTQUANTITY" ? def.args[5] : def.args[4];
  for (const id of refsIn(list)) {
    const p = file.byId.get(id);
    if (!p || typeof p.args[0] !== "string") continue;
    if (p.type === "IFCCOMPLEXPROPERTY") {
      out[p.args[0]] = definitionProps(file, { ...p, args: [null, null, null, null, p.args[3] ?? null] }, detail);
      continue;
    }
    const v = propertyValue(file, p);
    out[p.args[0]] = detail ? v : v.value;
  }
  return out;
}
function getPsets(file, entity, opts = {}) {
  const detail = opts.detail ?? false;
  const out = {};
  const add = (def) => {
    var _a;
    if (!def || typeof def.args[2] !== "string") return;
    Object.assign(out[_a = def.args[2]] ?? (out[_a] = {}), definitionProps(file, def, detail));
  };
  if (isTypeObject(entity.type)) {
    refsIn(entity.args[5]).forEach((id) => add(file.byId.get(id)));
    return out;
  }
  for (const rel of referrers(file, entity.id, "IFCRELDEFINESBYTYPE", 4)) {
    const type = deref(file, rel.args[5]);
    if (type) Object.assign(out, getPsets(file, type, opts));
  }
  for (const rel of referrers(file, entity.id, "IFCRELDEFINESBYPROPERTIES", 4)) {
    refsIn(rel.args[5]).forEach((id) => add(file.byId.get(id)));
  }
  return out;
}
function ports(file, element) {
  const out = [];
  for (const rel of referrers(file, element.id, "IFCRELNESTS", 4)) {
    for (const id of refsIn(rel.args[5])) {
      const p = file.byId.get(id);
      if (p?.type === "IFCDISTRIBUTIONPORT") out.push(p);
    }
  }
  for (const rel of referrers(file, element.id, "IFCRELCONNECTSPORTTOELEMENT", 5)) {
    const p = deref(file, rel.args[4]);
    if (p) out.push(p);
  }
  return out;
}
function connections(file) {
  return entitiesByType(file, "IFCRELCONNECTSPORTS").map((rel) => ({
    rel,
    relating: deref(file, rel.args[4]),
    related: deref(file, rel.args[5]),
    realizing: deref(file, rel.args[6])
  }));
}

// ../../../../../contracts/src/ifc/guid.ts
var IFC_GUID_NAMESPACE = "6f1d3a52-7c0b-4b8e-9a51-6b8f0a7d3e11";
var IFC_GUID_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$";
var IFC_GUID_RE = /^[0-3][0-9A-Za-z_$]{21}$/;
function sha1(bytes) {
  const ml = bytes.length;
  const words = ((ml + 8 >> 6) + 1) * 16;
  const w32 = new Uint32Array(words);
  for (let i = 0; i < ml; i++) w32[i >> 2] |= bytes[i] << 24 - i % 4 * 8;
  w32[ml >> 2] |= 128 << 24 - ml % 4 * 8;
  w32[words - 2] = Math.floor(ml * 8 / 4294967296);
  w32[words - 1] = ml * 8 >>> 0;
  let h0 = 1732584193, h1 = 4023233417, h2 = 2562383102, h3 = 271733878, h4 = 3285377520;
  const w = new Uint32Array(80);
  for (let off = 0; off < words; off += 16) {
    for (let t = 0; t < 16; t++) w[t] = w32[off + t];
    for (let t = 16; t < 80; t++) {
      const x = w[t - 3] ^ w[t - 8] ^ w[t - 14] ^ w[t - 16];
      w[t] = x << 1 | x >>> 31;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4;
    for (let t = 0; t < 80; t++) {
      const f = t < 20 ? b & c | ~b & d : t < 40 ? b ^ c ^ d : t < 60 ? b & c | b & d | c & d : b ^ c ^ d;
      const k = t < 20 ? 1518500249 : t < 40 ? 1859775393 : t < 60 ? 2400959708 : 3395469782;
      const tmp = (a << 5 | a >>> 27) + f + e + k + w[t] >>> 0;
      e = d;
      d = c;
      c = b << 30 | b >>> 2;
      b = a;
      a = tmp;
    }
    h0 = h0 + a >>> 0;
    h1 = h1 + b >>> 0;
    h2 = h2 + c >>> 0;
    h3 = h3 + d >>> 0;
    h4 = h4 + e >>> 0;
  }
  const out = new Uint8Array(20);
  [h0, h1, h2, h3, h4].forEach((h, i) => {
    out[i * 4] = h >>> 24;
    out[i * 4 + 1] = h >>> 16 & 255;
    out[i * 4 + 2] = h >>> 8 & 255;
    out[i * 4 + 3] = h & 255;
  });
  return out;
}
function uuidBytes(uuid) {
  const hex = uuid.replace(/-/g, "");
  if (!/^[0-9a-fA-F]{32}$/.test(hex)) throw new Error(`not a UUID: ${uuid}`);
  const b = new Uint8Array(16);
  for (let i = 0; i < 16; i++) b[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return b;
}
function uuid5Bytes(namespace, name) {
  const ns = uuidBytes(namespace);
  const nm = new TextEncoder().encode(name);
  const buf = new Uint8Array(ns.length + nm.length);
  buf.set(ns);
  buf.set(nm, ns.length);
  const h = sha1(buf).slice(0, 16);
  h[6] = h[6] & 15 | 80;
  h[8] = h[8] & 63 | 128;
  return h;
}
function compressGuid(bytes) {
  if (bytes.length !== 16) throw new Error("a GUID is 16 bytes");
  const A = IFC_GUID_ALPHABET;
  let out = A[bytes[0] >> 6] + A[bytes[0] & 63];
  for (let i = 1; i < 16; i += 3) {
    const n = bytes[i] << 16 | bytes[i + 1] << 8 | bytes[i + 2];
    out += A[n >> 18 & 63] + A[n >> 12 & 63] + A[n >> 6 & 63] + A[n & 63];
  }
  return out;
}
function expandGuid(gid) {
  if (!IFC_GUID_RE.test(gid)) throw new Error(`not an IFC GlobalId: ${gid}`);
  const v = (c) => IFC_GUID_ALPHABET.indexOf(c);
  const b = [v(gid[0]) << 6 | v(gid[1])];
  for (let i = 2; i < 22; i += 4) {
    const n = v(gid[i]) << 18 | v(gid[i + 1]) << 12 | v(gid[i + 2]) << 6 | v(gid[i + 3]);
    b.push(n >> 16 & 255, n >> 8 & 255, n & 255);
  }
  const hex = b.map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
function ifcGuid(...roles) {
  return compressGuid(uuid5Bytes(IFC_GUID_NAMESPACE, roles.join("/")));
}

// ../../../../../contracts/ifc/mapping.json
var mapping_default = { schema: "apk.ifc.mapping/1", ifc_schema: "IFC4X3_ADD2", noise_classes: "^(none|.*\\(by (maker|ports)\\))$", entities: { IfcAudioVisualApplianceType: { occurrence: "IfcAudioVisualAppliance" }, IfcCommunicationsApplianceType: { occurrence: "IfcCommunicationsAppliance" }, IfcMobileTelecommunicationsApplianceType: { occurrence: "IfcMobileTelecommunicationsAppliance" }, IfcFlowInstrumentType: { occurrence: "IfcFlowInstrument" }, IfcDistributionBoardType: { occurrence: "IfcDistributionBoard" }, IfcElectricDistributionBoardType: { occurrence: "IfcElectricDistributionBoard" }, IfcElectricFlowStorageDeviceType: { occurrence: "IfcElectricFlowStorageDevice" }, IfcElectricApplianceType: { occurrence: "IfcElectricAppliance" }, IfcTransformerType: { occurrence: "IfcTransformer" }, IfcProtectiveDeviceType: { occurrence: "IfcProtectiveDevice" }, IfcUnitaryControlElementType: { occurrence: "IfcUnitaryControlElement" }, IfcControllerType: { occurrence: "IfcController" }, IfcSwitchingDeviceType: { occurrence: "IfcSwitchingDevice" }, IfcLightFixtureType: { occurrence: "IfcLightFixture" }, IfcOutletType: { occurrence: "IfcOutlet" }, IfcCableSegmentType: { occurrence: "IfcCableSegment" }, IfcCableFittingType: { occurrence: "IfcCableFitting" }, IfcElementAssemblyType: { occurrence: "IfcElementAssembly" }, IfcFurnitureType: { occurrence: "IfcFurniture" }, IfcDiscreteAccessoryType: { occurrence: "IfcDiscreteAccessory" }, IfcMechanicalFastenerType: { occurrence: "IfcMechanicalFastener" }, IfcElectricGeneratorType: { occurrence: "IfcElectricGenerator" }, IfcBuildingElementProxyType: { occurrence: "IfcBuildingElementProxy" } }, legacy_predefined: { IfcFlowInstrumentType: { VOLTMETER: "VOLTMETER_RMS" } }, categories: { Audio: { entity: "IfcAudioVisualApplianceType", predefined: "USERDEFINED", element_type: "{class}" }, Microphones: { entity: "IfcAudioVisualApplianceType", predefined: "MICROPHONE" }, Video: { entity: "IfcAudioVisualApplianceType", predefined: "USERDEFINED", element_type: "{class}" }, Network: { entity: "IfcCommunicationsApplianceType", predefined: "NETWORKAPPLIANCE" }, Control: { entity: "IfcCommunicationsApplianceType", predefined: "USERDEFINED", element_type: "{class}" }, Power: { entity: "IfcElectricApplianceType", predefined: "USERDEFINED", element_type: "{class}" }, Infrastructure: { entity: "IfcBuildingElementProxyType", predefined: "USERDEFINED", element_type: "{class}" }, "Test & Measurement": { entity: "IfcFlowInstrumentType", predefined: "USERDEFINED", element_type: "{class}" }, Computing: { entity: "IfcCommunicationsApplianceType", predefined: "COMPUTER" }, Accessories: { entity: "IfcDiscreteAccessoryType", predefined: "USERDEFINED", element_type: "{class}" }, Concepts: { entity: null, note: "Not a physical element: a schematic/dataflow concept (adapter, mux, ST 2022-7, logic). No IFC type is written; the twin is the IfcProjectLibrary carrying APK_Part (ROAD-3587/3588)." }, Other: { entity: "IfcBuildingElementProxyType", predefined: "USERDEFINED", element_type: "{class}" } }, classes: [{ class: "^(software|protocol|dnssd|nmos|ravenna|avb|midi|serial_port|assumed fabric)$", entity: null, note: "Not a physical element: software, a protocol part or an assumed fabric. No IFC type is written." }, { class: "^(loudspeaker|smart speaker)$", entity: "IfcAudioVisualApplianceType", predefined: "SPEAKER", class_pset: "Pset_AudioVisualApplianceTypeSpeaker" }, { class: "^amplifier$", entity: "IfcAudioVisualApplianceType", predefined: "AMPLIFIER", class_pset: "Pset_AudioVisualApplianceTypeAmplifier" }, { class: "^dsp / mixer$", entity: "IfcAudioVisualApplianceType", predefined: "USERDEFINED", element_type: "DSP / Mixer" }, { class: "^audio i/o$", entity: "IfcAudioVisualApplianceType", predefined: "USERDEFINED", element_type: "Audio I/O" }, { class: "^communications$", entity: "IfcAudioVisualApplianceType", predefined: "COMMUNICATIONTERMINAL", note: "Intercom stations and beltpacks." }, { class: "^wireless handheld transmitter$", entity: "IfcAudioVisualApplianceType", predefined: "MICROPHONE" }, { class: "^wireless bodypack transmitter$", entity: "IfcAudioVisualApplianceType", predefined: "USERDEFINED", element_type: "Wireless Transmitter" }, { class: "^wireless$", category: "Audio", text: "transmitter|bodypack|beltpack", entity: "IfcAudioVisualApplianceType", predefined: "USERDEFINED", element_type: "Wireless Transmitter" }, { class: "^wireless$", category: "Audio", entity: "IfcAudioVisualApplianceType", predefined: "RECEIVER" }, { class: "mic set", category: "Microphones", entity: "IfcElementAssemblyType", predefined: "ACCESSORY_ASSEMBLY", note: "A set of microphones sold as one: an assembly aggregating MICROPHONE occurrences." }, { class: "wireless (microphone )?system", category: "Microphones", entity: "IfcElementAssemblyType", predefined: "ACCESSORY_ASSEMBLY", note: "Transmitter + receiver sold as one system." }, { class: "^display$", text: "projector", entity: "IfcAudioVisualApplianceType", predefined: "PROJECTOR" }, { class: "^display$", entity: "IfcAudioVisualApplianceType", predefined: "DISPLAY" }, { class: "^camera$", entity: "IfcAudioVisualApplianceType", predefined: "CAMERA" }, { class: "^player / recorder$", text: "record", entity: "IfcAudioVisualApplianceType", predefined: "RECORDINGEQUIPMENT" }, { class: "^(player / recorder|media player)$", entity: "IfcAudioVisualApplianceType", predefined: "PLAYER" }, { class: "^video processing$", text: "router|matrix|switcher", entity: "IfcAudioVisualApplianceType", predefined: "SWITCHER" }, { class: "^video processing$", entity: "IfcAudioVisualApplianceType", predefined: "USERDEFINED", element_type: "Video Processing" }, { class: "^sync & timing$", entity: "IfcAudioVisualApplianceType", predefined: "USERDEFINED", element_type: "Sync & Timing" }, { class: "^conferencing$", entity: "IfcAudioVisualApplianceType", predefined: "COMMUNICATIONTERMINAL" }, { class: "^lighting$", entity: "IfcLightFixtureType", predefined: "DIRECTIONSOURCE" }, { class: "^rf & satellite$", entity: "IfcCommunicationsApplianceType", predefined: "USERDEFINED", element_type: "RF & Satellite" }, { class: "^camera support$", entity: "IfcDiscreteAccessoryType", predefined: "USERDEFINED", element_type: "Camera Support" }, { class: "^(switch|network)$", text: "router", entity: "IfcCommunicationsApplianceType", predefined: "ROUTER" }, { class: "^switch$", entity: "IfcCommunicationsApplianceType", predefined: "IPNETWORKEQUIPMENT", note: "An Ethernet switch: IPNETWORKEQUIPMENT (4.3)." }, { class: "^transceiver$", entity: "IfcCommunicationsApplianceType", predefined: "TRANSITIONCOMPONENT" }, { class: "^network$", text: "\\bsfp|transceiver|media converter|\\bqsfp", entity: "IfcCommunicationsApplianceType", predefined: "TRANSITIONCOMPONENT", note: "Optics and media converters change the transmission medium." }, { class: "^(network|wireless)$", category: "Network", text: "access point", entity: "IfcMobileTelecommunicationsApplianceType", predefined: "ACCESSPOINT" }, { class: "^network$", text: "gateway", entity: "IfcCommunicationsApplianceType", predefined: "GATEWAY" }, { class: "^network$", text: "switch", entity: "IfcCommunicationsApplianceType", predefined: "IPNETWORKEQUIPMENT" }, { class: "^network$", text: "\\bhub\\b", entity: "IfcCommunicationsApplianceType", predefined: "NETWORKHUB" }, { class: "^network$", text: "bridge", entity: "IfcCommunicationsApplianceType", predefined: "NETWORKBRIDGE" }, { class: "^network$", text: "modem", entity: "IfcCommunicationsApplianceType", predefined: "MODEM" }, { class: "^(computer|computing)$", entity: "IfcCommunicationsApplianceType", predefined: "COMPUTER" }, { class: "^server & parts$", text: "server", entity: "IfcCommunicationsApplianceType", predefined: "COMPUTER" }, { class: "^server & parts$", entity: "IfcCommunicationsApplianceType", predefined: "USERDEFINED", element_type: "Server Part" }, { class: "^peripheral$", text: "printer", entity: "IfcCommunicationsApplianceType", predefined: "PRINTER" }, { class: "^peripheral$", text: "scanner", entity: "IfcCommunicationsApplianceType", predefined: "SCANNER" }, { class: "^peripheral$", entity: "IfcCommunicationsApplianceType", predefined: "INTELLIGENTPERIPHERAL" }, { class: "^(wall station|control surface|touch panel)$", entity: "IfcUnitaryControlElementType", predefined: "CONTROLPANEL", note: "Owner 2026-11-06 (ROAD-3598): a wall station (EDITORS.SurfaceDesigner's plate), a control surface (keys, encoders, faders on a desk or a rack face: a Stream Deck) and a touch panel (EDITORS.TouchPanelBuilder's screen) are physical BIM parts; what each presents stays APK-native, by hash." }, { class: "^control$", text: "touch ?panel|touch ?screen", entity: "IfcUnitaryControlElementType", predefined: "CONTROLPANEL" }, { class: "^control$", text: "keypad", entity: "IfcSwitchingDeviceType", predefined: "KEYPAD" }, { class: "^control$", text: "processor|controller", entity: "IfcControllerType", predefined: "PROGRAMMABLE" }, { category: "Power", text: "\\bups\\b|uninterruptible", entity: "IfcElectricFlowStorageDeviceType", predefined: "UPS" }, { category: "Power", text: "\\bpdu\\b|power distribution|rack ?power|\\bdistro\\b", entity: "IfcElectricDistributionBoardType", predefined: "DISTRIBUTIONBOARD", note: "A PDU is a small distribution board: Pset_DistributionBoardTypeCommon, Qto_DistributionBoardBaseQuantities." }, { category: "Power", text: "conditioner|surge", entity: "IfcElectricDistributionBoardType", predefined: "USERDEFINED", element_type: "Power Conditioner" }, { category: "Power", text: "breaker", entity: "IfcProtectiveDeviceType", predefined: "CIRCUITBREAKER" }, { category: "Power", text: "charger", entity: "IfcElectricFlowStorageDeviceType", predefined: "RECHARGER" }, { category: "Power", text: "battery", entity: "IfcElectricFlowStorageDeviceType", predefined: "BATTERY" }, { category: "Power", text: "power supply|\\bpsu\\b", entity: "IfcTransformerType", predefined: "RECTIFIER", note: "An AC-to-DC power supply." }, { class: "^patch panel$", entity: "IfcDistributionBoardType", predefined: "DISTRIBUTIONFRAME", class_pset: "Pset_DistributionBoardTypeDistributionFrame" }, { class: "^rack & enclosure$", entity: "IfcElementAssemblyType", predefined: "USERDEFINED", element_type: "EquipmentRack", frame: { entity: "IfcFurnitureType", predefined: "TECHNICALCABINET" }, note: "The rack is an assembly of the occurrences mounted in it (IfcRelAggregates); its empty frame is an IfcFurnitureType TECHNICALCABINET inside the assembly." }, { class: "^frame / chassis$", entity: "IfcAudioVisualApplianceType", predefined: "USERDEFINED", element_type: "Card Frame" }, { class: "^panel & plate$", text: "\\bpower\\b|\\bac\\b|duplex|\\bnema\\b", entity: "IfcOutletType", predefined: "POWEROUTLET" }, { class: "^panel & plate$", text: "\\bdata\\b|network|rj-?45|ethernet|cat ?6|cat ?5", entity: "IfcOutletType", predefined: "DATAOUTLET" }, { class: "^panel & plate$", entity: "IfcOutletType", predefined: "AUDIOVISUALOUTLET" }, { class: "^furniture$", text: "desk|console", entity: "IfcFurnitureType", predefined: "DESK" }, { class: "^furniture$", text: "table", entity: "IfcFurnitureType", predefined: "TABLE" }, { class: "^furniture$", text: "chair", entity: "IfcFurnitureType", predefined: "CHAIR" }, { class: "^furniture$", text: "shel(f|ves)", entity: "IfcFurnitureType", predefined: "SHELF" }, { class: "^furniture$", entity: "IfcFurnitureType", predefined: "USERDEFINED", element_type: "Technical Furniture" }, { class: "^staging & truss$", entity: "IfcElementAssemblyType", predefined: "TRUSS" }, { class: "^acoustic treatment$", entity: "IfcDiscreteAccessoryType", predefined: "SOUNDABSORPTION" }, { class: "^cable$", text: "fib(er|re)|optical", entity: "IfcCableSegmentType", predefined: "OPTICALCABLESEGMENT" }, { class: "^cable$", entity: "IfcCableSegmentType", predefined: "CABLESEGMENT" }, { class: "^(mount & hardware|hardware & components)$", text: "screw", entity: "IfcMechanicalFastenerType", predefined: "SCREW", element_type: "Robertson (square-drive) screw", note: "House rule: every screw is square-drive." }, { class: "^(mount & hardware|hardware & components)$", text: "\\bbolt", entity: "IfcMechanicalFastenerType", predefined: "BOLT" }, { class: "^mount & hardware$", entity: "IfcDiscreteAccessoryType", predefined: "BRACKET" }, { class: "^hardware & components$", entity: "IfcDiscreteAccessoryType", predefined: "USERDEFINED", element_type: "Hardware & Components" }, { class: "^accessory$", text: "adapter|adaptor|converter", entity: "IfcCableFittingType", predefined: "TRANSITION", note: "A passive connector adapter: one end port per side." }, { class: "^tool$", entity: "IfcBuildingElementProxyType", predefined: "USERDEFINED", element_type: "Tool" }, { class: "^dmm$", entity: "IfcFlowInstrumentType", predefined: "VOLTMETER_RMS", note: "Owner 2026-11-06: VOLTMETER parts become VOLTMETER_RMS." }, { class: "^counter$", entity: "IfcFlowInstrumentType", predefined: "FREQUENCYMETER" }, { category: "Test & Measurement", entity: "IfcFlowInstrumentType", predefined: "USERDEFINED", element_type: "{class}" }] };

// ../../../../../contracts/src/ifc-vocab.ts
var IFC_SCHEMA = "IFC4X3_ADD2";
var IFC_MAPPING = mapping_default;
var rxCache = /* @__PURE__ */ new Map();
function rx(pattern) {
  let r = rxCache.get(pattern);
  if (!r) {
    r = new RegExp(pattern, "i");
    rxCache.set(pattern, r);
  }
  return r;
}
function partIfc(part) {
  const own = part.ifc && typeof part.ifc === "object" ? part.ifc : null;
  const ext = part.ext && typeof part.ext === "object" ? part.ext.ifc : void 0;
  const block = own ?? ext;
  return block && typeof block === "object" && block.entity ? block : {};
}
var str = (v) => v === void 0 || v === null ? "" : String(v);
function ifcTypeFor(part) {
  const m = IFC_MAPPING;
  const cls = str(part.class).trim();
  const category = typeof part.category === "string" && part.category in m.categories ? part.category : "Other";
  const clsWord = !cls || rx(m.noise_classes).test(cls) ? "" : cls;
  const own = partIfc(part);
  let rule;
  let source;
  if (own.entity) {
    let entity2 = String(own.entity);
    if (!entity2.endsWith("Type")) entity2 += "Type";
    rule = {
      entity: entity2,
      predefined: str(own.predefined_type ?? own.predefined) || "NOTDEFINED",
      ...own.element_type ? { element_type: String(own.element_type) } : {}
    };
    source = "part";
  } else {
    const text = [part.name, part.model, part.description].map(str).join(" ");
    rule = m.classes.find(
      (r) => (r.category === void 0 || r.category === category) && (r.class === void 0 || rx(r.class).test(cls)) && (r.text === void 0 || rx(r.text).test(text))
    );
    source = rule ? "class" : "category";
    rule ?? (rule = m.categories[category]);
  }
  const entity = rule.entity;
  if (entity === null) return { entity: null, predefined: null, element_type: null, occurrence: null, qto: null, source };
  let pre = rule.predefined ?? "NOTDEFINED";
  pre = m.legacy_predefined[entity]?.[pre] ?? pre;
  let et = rule.element_type ? rule.element_type.replace("{class}", clsWord || category) : null;
  if (pre === "USERDEFINED" && !et) et = clsWord || category;
  const info = m.entities[entity];
  const out = {
    entity,
    predefined: pre,
    element_type: et,
    occurrence: info?.occurrence ?? (entity.endsWith("Type") ? entity.slice(0, -4) : entity),
    qto: info?.qto ?? null,
    source
  };
  if (rule.class_pset) out.class_pset = rule.class_pset;
  if (rule.frame) out.frame = rule.frame;
  return out;
}
export {
  DERIVED,
  IFC_GUID_ALPHABET,
  IFC_GUID_NAMESPACE,
  IFC_GUID_RE,
  IFC_SCHEMA,
  compressGuid,
  connections,
  deref,
  encodeString,
  entitiesByType,
  enumv,
  expandGuid,
  formatReal,
  getPsets,
  ifcGuid,
  ifcTypeFor,
  inverseIndex,
  isRef,
  isTypeObject,
  parseStep,
  ports,
  real,
  ref,
  schemaOf,
  sha1,
  typed,
  unwrap,
  uuid5Bytes,
  writeEntity,
  writeStep,
  writeValue
};
