# 📋 EDITORS.BOM — Bill of Materials

Line items for one drawing — part number, maker, description, quantity, unit and extended cost, status —
as a BOM block for the CAD (Save & Return), or a `.json` standalone; Export CSV.

**📚 Library** adds equipment from the BIM library (`DATABASE.server.BIM`) through the shared picker
(`/api/bim/ui/picker.js`): each pick is a line with its `bimId`; the same part again is one more of it. No
price is invented — the library keeps none, so a line is 0 until quoted. **Discovered** adds what is on the
network. Tests: `node --test tests/*.test.mjs`.
