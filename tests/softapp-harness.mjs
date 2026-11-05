// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
/* softapp-harness.mjs — runs THIS app's vendored vendor/apk-softapp/apk-softapp.js
   in a stub window (vm), the WEB.Frontend-Assets apk-softapp.test.js world()/fire()
   way, so a test can drive connectHost() as the CAD would: framed → messages to
   the parent at our own origin; standalone → a .json download. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.join(HERE, '../vendor/apk-softapp/apk-softapp.js'), 'utf8');
export const ORIGIN = 'http://bench:8080';
export const PROTOCOL = 'cad.like.audio/host@1';

export function world({ framed = true } = {}) {
  const listeners = [];
  const toParent = [];
  const downloads = [];
  const body = { children: [], appendChild(n) { this.children.push(n); return n; } };
  const doc = {
    title: 'Test Editor',
    body,
    documentElement: { style: { setProperty() {} } },
    getElementById: (id) => body.children.find((n) => n.id === id) || null,
    createElement: (tag) => ({
      tag, style: {}, attrs: {}, textContent: '',
      setAttribute(k, v) { this.attrs[k] = v; },
      click() { downloads.push({ name: this.download, href: this.href }); },
      remove() {},
    }),
  };
  const win = {
    location: { origin: ORIGIN },
    document: doc,
    addEventListener: (t, fn) => { if (t === 'message') listeners.push(fn); },
    removeEventListener: (t, fn) => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); },
    Blob: class { constructor(parts, o) { this.text = parts.join(''); this.type = o.type; } },
    URL: { createObjectURL: (b) => { downloads.blob = b; return 'blob:1'; }, revokeObjectURL() {} },
    setTimeout: (fn) => { fn(); return 1; },
    setInterval: () => 1, clearInterval() {},
    JSON, Date, Math, Promise, Object, Array, String, Number, isFinite, parseInt, RegExp,
  };
  win.window = win; win.globalThis = win;
  const parent = { postMessage: (m, o) => toParent.push({ m: JSON.parse(JSON.stringify(m)), o }) };
  win.parent = framed ? parent : win;
  vm.runInNewContext(SRC, win);
  const fire = (data, { source = parent, origin = ORIGIN } = {}) =>
    listeners.slice().forEach((fn) => fn({ data, source, origin }));
  return { win, S: win.APKSoftapp, toParent, downloads, fire, parent };
}

/** The CAD's side of one block round trip: load `block`, ask for it back, return what came back. */
export function roundTrip({ connect, block, meta = { blockName: 'test block' } }) {
  const w = world();
  const host = connect(w.S);
  const ready = w.toParent.find((x) => x.m.type === 'editorReady');
  w.fire({ protocol: PROTOCOL, type: 'load', block, meta });
  w.fire({ protocol: PROTOCOL, type: 'request' });
  const saved = w.toParent.filter((x) => x.m.type === 'blockSave').pop();
  return { w, host, ready, saved };
}
