// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

import { BlockBridge } from './blockBridge.js';
import { BomModel } from './bomModel.js';

export class BomApp {
  constructor() {
    this.model = new BomModel();

    this.bridge = new BlockBridge({
      name: 'BOM Editor',
      type: 'bill_of_materials',
      onBlockLoaded: (block, meta) => this.handleBlockLoaded(block, meta),
      onBlockChanged: () => {},
    });

    this.initElements();
    this.attachEvents();
    this.loadInitialData();
  }

  initElements() {
    this.btnOpen = document.getElementById('btn-open');
    this.btnSave = document.getElementById('btn-save');
    this.btnClose = document.getElementById('btn-close');
    this.btnSyncDiscovered = document.getElementById('btn-sync-discovered');

    this.tableBody = document.getElementById('bom-table-body');
    this.totalCostEl = document.getElementById('bom-total');
    this.totalItemsEl = document.getElementById('bom-count');

    this.btnAddItem = document.getElementById('btn-add-item');
    this.btnExportCsv = document.getElementById('btn-export');
    this.searchInput = document.getElementById('search-input');
  }

  attachEvents() {
    this.btnOpen?.addEventListener('click', () => this.promptOpen());
    this.btnSave?.addEventListener('click', () => this.saveBlock());
    this.btnClose?.addEventListener('click', () => this.bridge.close());
    this.btnSyncDiscovered?.addEventListener('click', () => this.loadFromDiscoveredProject());

    this.searchInput?.addEventListener('input', () => this.renderTable());

    this.btnAddItem?.addEventListener('click', () => {
      this.model.items.push({
        id: `item_${Date.now()}`,
        sku: 'NEW-SKU-01',
        mfr: 'Manufacturer',
        desc: 'Equipment Item Description',
        qty: 1,
        unitCost: 100.00,
        status: 'Specified',
      });
      this.render();
      this.bridge.notifyChanged();
    });

    this.btnExportCsv?.addEventListener('click', () => {
      const headers = ['SKU', 'Manufacturer', 'Description', 'Qty', 'UnitCost', 'ExtendedCost', 'Status'];
      const rows = this.model.items.map(i =>
        `"${i.sku}","${i.mfr}","${i.desc}",${i.qty},${i.unitCost},${i.qty * i.unitCost},"${i.status}"`
      );
      const csv = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `bom_schedule_${Date.now()}.csv`;
      a.click();
    });
  }

  loadInitialData() {
    this.loadFromDiscoveredProject().catch(() => {
      this.render();
    });
  }

  async loadFromDiscoveredProject() {
    try {
      const data = await this.bridge.fetchDiscoveredProject();
      if (data && (data.bom || data.equipment || data.devices)) {
        const raw = data.bom || data.equipment || data.devices;
        if (Array.isArray(raw) && raw.length > 0) {
          this.model.items = raw.map((item, i) => ({
            id: item.id || `item_${i + 1}`,
            sku: item.sku || item.partNumber || item.model || 'SKU',
            mfr: item.manufacturer || item.mfr || 'Manufacturer',
            desc: item.desc || item.name || item.model || 'Device',
            qty: item.qty || 1,
            unitCost: item.unitCost || item.cost || 500,
            status: item.status || 'Received',
          }));
          this.render();
          return;
        }
      }
    } catch (_) {}
    this.render();
  }

  handleBlockLoaded(block, meta = {}) {
    if (!block) return;
    if (Array.isArray(block.items)) {
      this.model.items = block.items;
    } else if (Array.isArray(block)) {
      this.model.items = block;
    }
    this.render();
  }

  saveBlock() {
    const block = {
      type: 'bill_of_materials',
      items: this.model.items,
      totalCost: this.model.getTotalCost(),
      itemCount: this.model.items.length,
      timestamp: new Date().toISOString(),
    };
    this.bridge.saveBlock(block, {
      title: `BOM (${this.model.items.length} Lines · $${block.totalCost.toFixed(2)})`,
      filename: `bom_${Date.now()}`,
    });
  }

  render() {
    this.renderMetrics();
    this.renderTable();
  }

  renderMetrics() {
    const total = this.model.getTotalCost();
    this.totalCostEl.textContent = `Total Extended: $${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    this.totalItemsEl.textContent = `${this.model.items.length} Line Items`;
  }

  renderTable() {
    this.tableBody.innerHTML = '';
    const q = (this.searchInput?.value || '').toLowerCase();

    this.model.items
      .filter(i => !q || i.sku.toLowerCase().includes(q) || i.mfr.toLowerCase().includes(q) || i.desc.toLowerCase().includes(q))
      .forEach((item) => {
        const globalIdx = this.model.items.indexOf(item);
        const tr = document.createElement('tr');
        const extCost = (item.qty * item.unitCost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        tr.innerHTML = `
          <td><input type="text" class="cell-input" data-idx="${globalIdx}" data-field="sku" value="${item.sku}"></td>
          <td><input type="text" class="cell-input" data-idx="${globalIdx}" data-field="mfr" value="${item.mfr}"></td>
          <td><input type="text" class="cell-input" data-idx="${globalIdx}" data-field="desc" value="${item.desc}"></td>
          <td style="width:65px;"><input type="number" class="cell-input text-center" data-idx="${globalIdx}" data-field="qty" value="${item.qty}"></td>
          <td style="width:100px;"><input type="number" step="0.01" class="cell-input text-center" data-idx="${globalIdx}" data-field="unitCost" value="${item.unitCost}"></td>
          <td style="width:100px; text-align:right; font-weight:bold; color:var(--osc-accent-secondary);">$${extCost}</td>
          <td style="width:110px;">
            <select class="cell-input" data-idx="${globalIdx}" data-field="status">
              <option value="Specified" ${item.status === 'Specified' ? 'selected' : ''}>Specified</option>
              <option value="Quoted" ${item.status === 'Quoted' ? 'selected' : ''}>Quoted</option>
              <option value="Ordered" ${item.status === 'Ordered' ? 'selected' : ''}>Ordered</option>
              <option value="Received" ${item.status === 'Received' ? 'selected' : ''}>Received</option>
              <option value="Staged" ${item.status === 'Staged' ? 'selected' : ''}>Staged</option>
              <option value="Installed" ${item.status === 'Installed' ? 'selected' : ''}>Installed</option>
            </select>
          </td>
          <td class="col-actions">
            <button class="btn-icon btn-del-item" data-idx="${globalIdx}" title="Delete Item">🗑</button>
          </td>
        `;
        this.tableBody.appendChild(tr);
      });

    this.tableBody.querySelectorAll('.cell-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const i = parseInt(e.target.dataset.idx, 10);
        const f = e.target.dataset.field;
        let val = e.target.value;
        if (f === 'qty') val = parseInt(val, 10) || 1;
        if (f === 'unitCost') val = parseFloat(val) || 0;
        this.model.items[i][f] = val;
        this.renderMetrics();
        const row = this.tableBody.children[i];
        if (row) {
          const extCell = row.children[5];
          if (extCell) {
            const extCost = (this.model.items[i].qty * this.model.items[i].unitCost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            extCell.textContent = `$${extCost}`;
          }
        }
        this.bridge.notifyChanged();
      });
    });

    this.tableBody.querySelectorAll('.btn-del-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const i = parseInt(e.target.dataset.idx, 10);
        this.model.items.splice(i, 1);
        this.render();
        this.bridge.notifyChanged();
      });
    });
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
          const parsed = JSON.parse(re.target.result);
          this.handleBlockLoaded(parsed, { title: file.name });
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
