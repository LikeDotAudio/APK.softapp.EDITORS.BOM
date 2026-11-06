# 📋 EDITORS.BOM — Bill of Materials

Line items for one drawing — part number, maker, description, quantity, unit and extended cost, status —
as a BOM block for the CAD (Save & Return), or a `.json` standalone; Export CSV.

**📚 Library** (Ctrl+Shift+L, or a part dragged from the library onto the table) adds equipment from the BIM
library (`DATABASE.server.BIM`) through the shared picker (`APKLibrary.pick`, loaded by `js/bimLibrary.js`):
each pick is a line with its `bimId` and its BIM reference `bimRef` {part, url, rev}; the same part again is
one more of it. There is no blank, hand-typed line: SKU and maker are the part's. No
price is invented — the library keeps none, so a line is 0 until quoted. **Discovered** adds what is on the
network. Tests: `node --test tests/*.test.mjs`.

<!-- wiki:smoke -->
**Smoke test** — ✅ PASS 3/3 since 2026-11-04 21:31 EST — [results](Documentation/%F0%9F%A7%A9Manual%20and%20Artifacts/SMOKE.md)
<!-- /wiki:smoke -->
