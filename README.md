# 📋 EDITORS.BOM — Bill of Materials

Line items for one drawing — part number, maker, description, quantity, unit and extended cost, status —
as a BOM block for the CAD (Save & Return), or a `.json` standalone; Export CSV.

**📚 Library** (Ctrl+Shift+L, or a part dragged from the library onto the table) adds equipment from the BIM
library (`DATABASE.server.BIM`) through the shared picker (`APKLibrary.pick`, loaded by `js/bimLibrary.js`):
each pick is a line with its `bimId` and its BIM reference `bimRef` {part, url, rev}; the same part again is
one more of it. There is no blank, hand-typed line: SKU and maker are the part's. No
price is invented — the library keeps none, so a line is 0 until quoted. **Discovered** adds what is on the
network.

**IFC (bom-fm-1..3).** The bill is a query over occurrences grouped by type: **Open** an `.ifc` (or **Open
Bench** = `GET /api/bim/bench.ifc`) and each line is a type object, its qty the count of occurrences it
types (`IfcRelDefinesByType`) — never a typed counter. A part's kit (`assembly: [{part, qty, role, place,
diameter_mm?, length_mm?}]`) is expanded per occurrence: one typed `IfcMechanicalFastener` /
`IfcDiscreteAccessory` each, aggregated under an `IfcElementAssembly` ACCESSORY_ASSEMBLY that its device
aggregates. Standalone **Save** writes the `apk.bom/2` block and its `.ifc` twin over the rig: an
`IfcCostSchedule` (Identification `apk.bom/2`) with an `IfcCostItem` per line (`IfcMonetaryMeasure` unit
price, `IfcQuantityCount`, `IfcRelAssignsToControl` to its occurrences, `APK_Procurement` Status/LeadTime/
QuoteReference), `IfcProjectOrder` PURCHASEORDER per PO with its SUPPLIER `IfcActor`, and a MANUFACTURER
`IfcActor` (`IfcOrganization`) over each maker's types. Procurement is Specified / Quoted / Ordered only;
Received / Staged / Installed are readiness stages (EDITORS.Readiness). Code: `js/bomIfc.js`, the contracts
IFC kit `js/ifc/apk-ifc.mjs` (generated: `node tests/fixtures/make_ifc_codec.mjs [--check]`), the writer
`js/ifc/ifcOut.mjs` (the same file in EDITORS.Readiness and EDITORS.RACI).

Tests: `node --test tests/*.test.mjs`; with `APK_IFC_PYTHON=<python with ifcopenshell>` the IfcOpenShell
oracle (`tests/fixtures/ifc_oracle.py`: schema + EXPRESS, util.cost totals, get_types counts, kits, actors)
runs too.

<!-- wiki:smoke -->
**Smoke test** — ❌ FAIL 2/3 since 2026-11-12 00:16 EST — [results](Documentation/%F0%9F%A7%A9Manual%20and%20Artifacts/SMOKE.md)
<!-- /wiki:smoke -->
