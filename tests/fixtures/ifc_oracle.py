# Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
# MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
"""The IFC oracle for the BOM's saved .ifc: IfcOpenShell, independent of the contracts STEP codec.

    python -I tests/fixtures/ifc_oracle.py <file.ifc> <expect.json>     (prints one JSON line, exit 0 = holds)

Checks, each against the expectation tests/ifcOracle.test.mjs wrote from the BOM model:
  - ifcopenshell.validate (schema + EXPRESS rules): 0 errors
  - every attribute layout this editor writes is the IFC4X3_ADD2 one (schema_by_name)
  - qty of each line == len(ifcopenshell.util.element.get_types(type)) (bom-fm-1)
  - kit units are aggregated under an IfcElementAssembly ACCESSORY_ASSEMBLY that the device aggregates
  - ifcopenshell.util.cost: the Total item's value == the block's totalCost; each line item's quantity
    == its qty, and every IfcCostItem has CostValues (bom-fm-2)
  - IfcCostSchedule.PredefinedType is PRICED/UNPRICEDBILLOFQUANTITIES; every IfcProjectOrder is a
    PURCHASEORDER with a SUPPLIER actor; makers are IfcActor + IfcOrganization MANUFACTURER over types
Exit 3 when IfcOpenShell is not installed (the node test then skips).
"""
import json
import sys

try:
    import ifcopenshell
    import ifcopenshell.util.cost as C
    import ifcopenshell.util.element as E
    import ifcopenshell.validate as V
except ImportError:
    print(json.dumps({"skip": "ifcopenshell not installed"}))
    sys.exit(3)


def main(path, expect_path):
    want = json.load(open(expect_path, encoding="utf-8"))
    f = ifcopenshell.open(path)
    problems = []
    log = V.json_logger()
    V.validate(f, log, express_rules=True)
    for s in log.statements:
        problems.append("validate: %s" % str(s.get("message", s))[:300])

    schedule = [s for s in f.by_type("IfcCostSchedule") if s.Identification == "apk.bom/2"]
    if len(schedule) != 1:
        problems.append("expected one apk.bom/2 IfcCostSchedule, found %d" % len(schedule))
    else:
        sch = schedule[0]
        if sch.PredefinedType not in ("PRICEDBILLOFQUANTITIES", "UNPRICEDBILLOFQUANTITIES"):
            problems.append("schedule PredefinedType %s" % sch.PredefinedType)
        roots = C.get_root_cost_items(sch)
        total = [r for r in roots if r.Name == "Total"]
        if len(total) != 1:
            problems.append("no Total cost item")
        else:
            got = C.calculate_applied_value(total[0], total[0].CostValues[0])
            if abs(got - want["total"]) > 1e-6:
                problems.append("util.cost total %s != block total %s" % (got, want["total"]))
        for item in C.get_all_nested_cost_items(sch):
            if not item.CostValues:
                problems.append("cost item %s has no CostValues" % item.Name)
    for o in f.by_type("IfcProjectOrder"):
        if o.PredefinedType != "PURCHASEORDER":
            problems.append("order %s is %s" % (o.Identification, o.PredefinedType))

    counts = {}
    for t in f.by_type("IfcTypeProduct"):
        key = t.Tag or ("gid:" + t.GlobalId)
        n = len(E.get_types(t))
        if n:
            counts[key] = counts.get(key, 0) + n
    for key, qty in want["types"].items():
        if counts.get(key) != qty:
            problems.append("type %s: %s occurrences, the BOM says %s" % (key, counts.get(key), qty))
        item = [i for i in f.by_type("IfcCostItem") if any(
            (E.get_type(o) and (E.get_type(o).Tag or "gid:" + E.get_type(o).GlobalId) == key)
            for rel in i.Controls for o in rel.RelatedObjects)]
        if len(item) != 1:
            problems.append("type %s: %d cost items" % (key, len(item)))
        elif C.get_total_quantity(item[0]) != qty:
            problems.append("type %s: cost quantity %s != %s" % (key, C.get_total_quantity(item[0]), qty))

    kits = 0
    for a in f.by_type("IfcElementAssembly"):
        if a.PredefinedType != "ACCESSORY_ASSEMBLY":
            continue
        parent = E.get_aggregate(a)
        parts = E.get_parts(a) or []
        if parent is None or not E.get_type(parent):
            problems.append("kit %s is not under a typed device" % a.Name)
        if a.AssemblyPlace not in ("SITE", "FACTORY"):
            problems.append("kit %s AssemblyPlace %s" % (a.Name, a.AssemblyPlace))
        for p in parts:
            if not E.get_type(p) or not (p.is_a("IfcMechanicalFastener") or p.is_a("IfcDiscreteAccessory")):
                problems.append("kit %s holds %s" % (a.Name, p))
        kits += len(parts)
    if kits != want.get("kit_units", 0):
        problems.append("kit units %d != %d" % (kits, want.get("kit_units", 0)))

    makers = {}
    for rel in f.by_type("IfcRelAssignsToActor"):
        role = rel.ActingRole.Role if rel.ActingRole else None
        org = rel.RelatingActor.TheActor
        if role == "MANUFACTURER":
            if not org.is_a("IfcOrganization") or not any(r.Role == "MANUFACTURER" for r in (org.Roles or [])):
                problems.append("maker actor %s has no MANUFACTURER organisation" % org)
            for t in rel.RelatedObjects:
                if not t.is_a("IfcTypeObject"):
                    problems.append("maker %s assigned to a non-type %s" % (org.Name, t))
                makers.setdefault(org.Name, set()).add(t.Tag)
        if role == "SUPPLIER" and not all(o.is_a("IfcProjectOrder") for o in rel.RelatedObjects):
            problems.append("supplier %s assigned to a non-order" % org.Name)
    for name in want.get("makers", []):
        if name not in makers:
            problems.append("no MANUFACTURER actor for %s" % name)

    print(json.dumps({"ok": not problems, "problems": problems, "validate_errors": len(log.statements),
                      "types": counts, "kit_units": kits, "makers": sorted(makers)}))
    return 0 if not problems else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1], sys.argv[2]))
