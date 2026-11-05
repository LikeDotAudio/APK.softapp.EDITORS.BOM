// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
/* discoveredPanel.js — "On the network": what the bus knows, live (ROAD-3489).

   The only source is window.APKSoftapp.discovered() (vendor/apk-softapp/), which
   reads the bus through APKBus + APKContracts.Topics. No URL is guessed and no
   topic is written here. Which things show is a tunable: config/discovery.json
   { "kinds": [...] } (an empty list shows everything), never a list in source.

   Identity is MAC, else serial, else the agent's own name — never an IP. Each
   row shows live.state (good | kinda | dead) and live.why, re-judged every 15 s
   by APKSoftapp, so trust decays on screen. No SDK, no bus or no broker: the
   status line says so and the editor keeps working on files. */

/** The one identity a thing has: MAC, else serial, else agent, else '' (never an IP). */
export function thingIdentity(t) {
  return String((t && (t.mac || t.serial || t.agent)) || '');
}

/** A discovered thing as a plain table row (text only: APKTable writes cells with textContent). */
export function thingRow(t) {
  const live = (t && t.live) || {};
  return {
    name: String(t?.name || t?.model || thingIdentity(t) || t?.id || ''),
    identity: thingIdentity(t),
    vendor: String(t?.vendor || ''),
    model: String(t?.model || ''),
    protocols: Array.isArray(t?.protocols) ? t.protocols.join(', ') : '',
    state: ['good', 'kinda', 'dead'].includes(live.state) ? live.state : 'dead',
    why: String(live.why || ''),
    thing: t,
  };
}

/** Reads config/discovery.json next to this app; a missing file means "show everything". */
export async function loadDiscoveryConfig(url) {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return { kinds: [], why: `${res.status} reading ${url}` };
    const cfg = await res.json();
    return { kinds: Array.isArray(cfg.kinds) ? cfg.kinds.map(String) : [], why: '' };
  } catch (err) {
    return { kinds: [], why: `could not read ${url} (${err.message})` };
  }
}

/* Mounts the panel once: the APKTable named `tableId` in `tableHost`, a status line in
   `statusEl`. `pickLabel` + `onPick(thing)` add a button per row; `onThings(things)`
   hears every update (re-judged every 15 s). */
export class DiscoveredPanel {
  constructor({ tableId, tableHost, statusEl, configUrl, pickLabel = '', onPick = null, onThings = null }) {
    this.tableId = tableId;
    this.tableHost = tableHost;
    this.statusEl = statusEl;
    this.configUrl = configUrl;
    this.pickLabel = pickLabel;
    this.onPick = onPick;
    this.onThings = onThings;
    this.started = null;
    this.handle = null;
  }

  say(state, text) {
    if (!this.statusEl) return;
    this.statusEl.textContent = text;
    this.statusEl.setAttribute('data-apk-state', state);
  }

  columns() {
    const cols = [
      { key: 'name', label: 'Name', editable: false },
      { key: 'identity', label: 'MAC / Serial', editable: false, mono: true },
      { key: 'vendor', label: 'Vendor', editable: false },
      { key: 'model', label: 'Model', editable: false },
      { key: 'protocols', label: 'Seen by', editable: false },
      {
        key: 'state', label: 'State',
        render: (v) => {
          const s = document.createElement('span');
          s.setAttribute('data-apk-state', v);
          s.textContent = v;
          return s;
        },
      },
      { key: 'why', label: 'Why', editable: false },
    ];
    if (this.onPick) {
      cols.push({
        key: 'pick', label: '',
        render: (_v, row) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'btn btn-secondary btn-sm';
          b.textContent = this.pickLabel || 'Add';
          b.addEventListener('click', () => this.onPick(row.thing));
          return b;
        },
      });
    }
    return cols;
  }

  start() {
    if (!this.started) this.started = this.run();
    return this.started;
  }

  async run() {
    const S = window.APKSoftapp;
    const T = window.APKTable;
    if (!S || !T) return this.say('dead', 'vendor/apk-softapp or vendor/apk-table did not load.');
    this.table = T.create(this.tableHost, {
      id: this.tableId,
      columns: this.columns(),
      rows: [],
      empty: 'Nothing discovered yet.',
    });
    const cfg = await loadDiscoveryConfig(this.configUrl);
    this.say('kinda', 'Connecting to the bus…');
    let things = [];
    let link = null;
    const what = cfg.kinds.length ? cfg.kinds.join(', ') : 'anything';
    const note = cfg.why ? ` · config: ${cfg.why}` : '';
    const tell = () => {
      if (link && !link.connected) {
        return this.say('dead', `Bus not connected${link.url ? ` (${link.url})` : ''}: nothing here is verified now${note}.`);
      }
      this.say(things.length ? 'good' : 'kinda', `${things.length} on the network (kinds: ${what})${note}`);
    };
    const show = (list) => {
      things = list;
      this.table.setRows(things.map(thingRow));
      if (this.onThings) this.onThings(things);
      tell();
    };
    this.handle = await S.discovered({ kinds: cfg.kinds, onChange: show });
    if (!this.handle.ok) return this.say('dead', this.handle.reason);
    link = this.handle.bus || null;
    if (link && typeof link.on === 'function') link.on('connect', tell).on('close', tell);
    show(this.handle.things());
  }
}
