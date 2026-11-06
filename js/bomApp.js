// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
/* bomApp.js — the BOM editor. The block goes in and out over cad.like.audio/host@1
   (window.APKSoftapp.connectHost, vendor/apk-softapp/); the table is APKTable
   'bom-items' (vendor/apk-table/); "Discovered" lists what the bus knows
   (APKSoftapp.discoveredPanel, kinds in config/discovery.json).
   bom-fm-1..3: the lines are a query over a rig's occurrences (Open an .ifc, or Open Bench =
   GET /api/bim/bench.ifc) grouped by type, kits expanded per occurrence; standalone Save writes the
   apk.bom/2 block AND its .ifc twin (APKSoftapp.saveModel; js/bomIfc.js bomToIfc: IfcCostSchedule,
   IfcCostItem, IfcProjectOrder, supplier and maker IfcActors over the rig). */

import { BomModel, BOM_BLOCK_TYPE, BOM_STATUSES } from './bomModel.js';
import { bomToIfc } from './bomIfc.js';

const BENCH_IFC = '/api/bim/bench.ifc';
import { libraryButton, acceptLibraryDrops, bimFields } from './bimLibrary.js';

const money = (v) => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export class BomApp {
  constructor() {
    this.model = new BomModel();
    const S = window.APKSoftapp;
    S.inheritTheme();

    S.describe({
      name: 'BOM Editor',
      does: 'Bill of materials for one drawing: line items with quantity, unit and extended cost, as a BOM block for the CAD.',
      inputs: [
        { name: 'BOM block', from: 'the CAD (when opened from a drawing), or a .json file via Open', kind: 'file' },
        { name: 'Rig model (.ifc)', from: 'Open an .ifc, or Open Bench (GET /api/bim/bench.ifc): each line is a type, qty = its occurrences', kind: 'file' },
        { name: 'Device library', from: 'the BIM library (📚 Library, Ctrl+Shift+L, or a part dragged from it): each line keeps its bimId and bimRef' },
        { name: 'On the network', from: 'the bus: devices discovered by scanners and agents (kinds in config/discovery.json)', kind: 'bus' },
      ],
      outputs: [
        { name: 'BOM block', to: 'the CAD on Save & Return and on every edit', kind: 'file' },
        { name: 'bom.json + bom.ifc', to: 'standalone Save: the apk.bom/2 block and its IFC4X3 twin (cost schedule, orders, suppliers, makers over the rig)', kind: 'file' },
        { name: 'bom_schedule.csv', to: 'a download (Export CSV)', kind: 'file' },
      ],
      controls: [
        { name: 'Open / Open Bench / Save & Return / Close', how: 'header buttons (Open takes .ifc or .json)' },
        { name: '📚 Library', how: 'add one or more parts from the BIM library (Ctrl+Shift+L), or drop a part dragged from it on the table' },
        { name: 'Table cells', how: 'edit description, qty (planned units; placed ones stay), unit cost, procurement status, supplier, PO in place (SKU and maker are the part\'s); row button deletes the planned units' },
        { name: 'Filter', how: 'type to filter the lines by any column' },
        { name: 'Discovered', how: 'shows what the bus has discovered; Add line puts one in the BOM' },
        { name: 'Export CSV', how: 'download the schedule as CSV' },
      ],
      problems: ['bad_json', 'bad_input', 'file_unreadable', 'not_in_cad', 'bus_missing'],
    });

    this.initElements();
    this.makeTable();
    this.host = S.connectHost({
      editor: 'BOM Editor',
      blockType: BOM_BLOCK_TYPE,
      onLoad: (block, meta) => this.handleBlockLoaded(block, meta),
      onRequest: () => this.model.toBlock(),
    });
    // the Discovered panel is the shared client's (ROAD-3502); start() draws it once, on first show
    this.discovered = {
      start: () => (this.discoveredRun ||= window.APKSoftapp?.discoveredPanel(document.getElementById('discovered-table'), {
        id: 'bom-discovered',
        status: document.getElementById('discovered-status'),
        configUrl: new URL('../config/discovery.json', import.meta.url),
        pickLabel: 'Add line',
        onPick: (thing) => { if (this.model.addFromThing(thing)) this.changed(); },
      })),
    };
    this.attachEvents();
    this.render();
  }

  initElements() {
    this.btnOpen = document.getElementById('btn-open');
    this.btnOpenBench = document.getElementById('btn-open-bench');
    this.btnSave = document.getElementById('btn-save');
    this.btnClose = document.getElementById('btn-close');
    this.btnSyncDiscovered = document.getElementById('btn-sync-discovered');
    this.discoveredPanelEl = document.getElementById('discovered-panel');
    this.totalCostEl = document.getElementById('bom-total');
    this.totalItemsEl = document.getElementById('bom-count');
    this.btnAddItem = document.getElementById('btn-add-item');
    this.btnExportCsv = document.getElementById('btn-export');
    this.searchInput = document.getElementById('search-input');
  }

  makeTable() {
    this.table = window.APKTable.create(document.getElementById('bom-table'), {
      id: 'bom-items',
      toolbar: false,
      columns: [
        // the part's own (the BIM library): never typed here (ROAD-3572)
        { key: 'sku', label: 'SKU / Part #', editable: false },
        { key: 'mfr', label: 'Manufacturer', editable: false },
        { key: 'desc', label: 'Equipment Description' },
        { key: 'qty', label: 'Qty', type: 'number' },
        { key: 'placed', label: 'Placed', editable: false, align: 'right' },
        { key: 'unitCost', label: 'Unit Cost ($)', type: 'number' },
        { key: 'ext', label: 'Ext Cost', editable: false, align: 'right', format: (_v, row) => `$${money(row.qty * row.unitCost)}` },
        { key: 'status', label: 'Procurement', type: 'select', options: BOM_STATUSES },
        { key: 'supplier', label: 'Supplier' },
        { key: 'po', label: 'PO #' },
      ],
      rows: this.model.items,
      onEdit: (i, key, value) => {
        this.model.updateItem(i, key, value);
        if (key === 'qty' || key === 'unitCost') this.render();   // Ext Cost moves; other cells already show the edit
        else this.renderMetrics();
        this.host.changed(this.model.toBlock());
      },
      onDelete: (i) => { this.model.removeItem(i); this.changed(); },
      empty: 'No line items yet.',
    });
  }

  attachEvents() {
    this.btnOpen?.addEventListener('click', () => this.promptOpen());
    this.btnOpenBench?.addEventListener('click', () => this.promptOpen({ url: BENCH_IFC }));
    this.btnSave?.addEventListener('click', () => this.saveBlock());
    this.btnClose?.addEventListener('click', () => this.host.close());
    this.btnSyncDiscovered?.addEventListener('click', () => {
      if (this.discoveredPanelEl) this.discoveredPanelEl.hidden = !this.discoveredPanelEl.hidden;
      this.discovered.start();
    });
    this.searchInput?.addEventListener('input', () => this.table.filter(this.searchInput.value));
    // 📚 Library (ROAD-3572): every line is a BIM part, with its BIM reference — no blank, typed line
    const addItems = (items) => { for (const it of items) this.model.addFromPart(it.bim, bimFields(it).bimRef); this.changed(); };
    this.btnAddItem?.replaceWith(libraryButton(addItems, {
      className: 'btn btn-primary btn-sm', title: 'Add equipment from the BIM library', multiple: true }));
    const tableEl = document.getElementById('bom-table');
    if (tableEl) acceptLibraryDrops(tableEl, (it) => addItems([it]));
    this.btnExportCsv?.addEventListener('click', () => this.table.exportCsv('bom_schedule.csv'));
  }

  changed() {
    this.render();
    this.host.changed(this.model.toBlock());
  }

  handleBlockLoaded(block, meta = {}) {
    if (!this.model.fromBlock(block)) return false;
    const tag = document.getElementById('block-tag');
    if (tag && (meta.title || meta.blockName)) tag.textContent = meta.title || meta.blockName;
    this.render();
    return true;
  }

  /** In the CAD: the block goes back (Save & Return). Standalone: the block and its .ifc twin, both or neither. */
  async saveBlock() {
    const block = this.model.toBlock();
    const S = window.APKSoftapp;
    if (window.parent === window) {
      const r = await S.saveModel(this.model, { name: 'bom', toIfc: (m) => bomToIfc(m), toJson: (m) => m.toBlock() });
      if (!r.ok && !r.cancelled && r.problem) S.showProblem(r.problem);
      return r;
    }
    return this.host.save(block, {
      title: `BOM (${block.itemCount} Lines · $${block.totalCost.toFixed(2)})`,
      filename: 'bom',
    });
  }

  render() {
    this.renderMetrics();
    this.table.setRows(this.model.items);
  }

  renderMetrics() {
    const total = this.model.getTotalCost();
    this.totalCostEl.textContent = `Total Extended: $${money(total)}`;
    this.totalItemsEl.textContent = `${this.model.items.length} Line Items`;
  }

  /** Open an .ifc (a rig, a bench, or a twin this editor saved) or a BOM block .json. */
  async promptOpen(opts = {}) {
    const S = window.APKSoftapp;
    const o = await S.openModel({
      ...opts,
      fromIfc: (text, name) => { this.model.loadIfc(text, name); return this.model; },
      fromJson: (data) => {
        if (!this.model.fromBlock(data)) throw new TypeError('no "items" list: this is not a BOM block');
        return this.model;
      },
    });
    if (!o.ok) {
      if (!o.cancelled && o.problem) S.showProblem(o.problem, { onRetry: () => this.promptOpen(opts) });
      return o;
    }
    const tag = document.getElementById('block-tag');
    if (tag) tag.textContent = o.name || (o.kind === 'ifc' ? 'IFC model' : 'BOM block');
    this.changed();
    return o;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    window.bomApp = new BomApp();
  });
}
