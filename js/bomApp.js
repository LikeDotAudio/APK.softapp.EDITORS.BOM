// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
/* bomApp.js — the BOM editor. The block goes in and out over cad.like.audio/host@1
   (window.APKSoftapp.connectHost, vendor/apk-softapp/); the table is APKTable
   'bom-items' (vendor/apk-table/); "Discovered" lists what the bus knows
   (js/discoveredPanel.js, kinds in config/discovery.json). */

import { BomModel, BOM_BLOCK_TYPE, BOM_STATUSES } from './bomModel.js';
import { DiscoveredPanel } from './discoveredPanel.js';

const money = (v) => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export class BomApp {
  constructor() {
    this.model = new BomModel();
    const S = window.APKSoftapp;
    S.inheritTheme();

    this.initElements();
    this.makeTable();
    this.host = S.connectHost({
      editor: 'BOM Editor',
      blockType: BOM_BLOCK_TYPE,
      onLoad: (block, meta) => this.handleBlockLoaded(block, meta),
      onRequest: () => this.model.toBlock(),
    });
    this.discovered = new DiscoveredPanel({
      tableId: 'bom-discovered',
      tableHost: document.getElementById('discovered-table'),
      statusEl: document.getElementById('discovered-status'),
      configUrl: new URL('../config/discovery.json', import.meta.url),
      pickLabel: 'Add line',
      onPick: (thing) => { if (this.model.addFromThing(thing)) this.changed(); },
    });
    this.attachEvents();
    this.render();
  }

  initElements() {
    this.btnOpen = document.getElementById('btn-open');
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
        { key: 'sku', label: 'SKU / Part #' },
        { key: 'mfr', label: 'Manufacturer' },
        { key: 'desc', label: 'Equipment Description' },
        { key: 'qty', label: 'Qty', type: 'number' },
        { key: 'unitCost', label: 'Unit Cost ($)', type: 'number' },
        { key: 'ext', label: 'Ext Cost', editable: false, align: 'right', format: (_v, row) => `$${money(row.qty * row.unitCost)}` },
        { key: 'status', label: 'Status', type: 'select', options: BOM_STATUSES },
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
    this.btnSave?.addEventListener('click', () => this.saveBlock());
    this.btnClose?.addEventListener('click', () => this.host.close());
    this.btnSyncDiscovered?.addEventListener('click', () => {
      if (this.discoveredPanelEl) this.discoveredPanelEl.hidden = !this.discoveredPanelEl.hidden;
      this.discovered.start();
    });
    this.searchInput?.addEventListener('input', () => this.table.filter(this.searchInput.value));
    this.btnAddItem?.addEventListener('click', () => { this.model.addItem(); this.changed(); });
    this.btnExportCsv?.addEventListener('click', () => this.table.exportCsv('bom_schedule.csv'));
  }

  changed() {
    this.render();
    this.host.changed(this.model.toBlock());
  }

  handleBlockLoaded(block, meta = {}) {
    if (!this.model.fromBlock(block)) return;
    const tag = document.getElementById('block-tag');
    if (tag && (meta.title || meta.blockName)) tag.textContent = meta.title || meta.blockName;
    this.render();
  }

  saveBlock() {
    const block = this.model.toBlock();
    this.host.save(block, {
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

  promptOpen() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (re) => {
        try {
          this.handleBlockLoaded(JSON.parse(re.target.result), { title: file.name });
          this.host.changed(this.model.toBlock());
        } catch (err) {
          alert('Invalid JSON BOM block');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    window.bomApp = new BomApp();
  });
}
