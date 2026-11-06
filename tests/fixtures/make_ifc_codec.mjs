// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
/* js/ifc/apk-ifc.mjs is the contracts IFC kit as plain JS, so the page loads it with no build:
     the STEP codec   contracts/src/ifc/step.ts   (parseStep, writeStep, getPsets, entitiesByType, …)
     the GlobalId     contracts/src/ifc/guid.ts   (ifcGuid(...roles) — the one site-wide rule)
     the type choice  contracts/src/ifc-vocab.ts  (ifcTypeFor(part) over contracts/ifc/mapping.json)
   This makes it, and --check says whether it is current (tests/ifcCodec.test.mjs runs the check
   whenever the contracts checkout and its esbuild sit beside this app). The same file sits in
   EDITORS.BOM, EDITORS.Readiness and EDITORS.RACI.

     node tests/fixtures/make_ifc_codec.mjs [--check]     (from the monorepo checkout) */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = new URL('../../', import.meta.url);
export const OUT = new URL('js/ifc/apk-ifc.mjs', HERE);
export const MONO = new URL('../../../../../', HERE);
const CONTRACTS = new URL('contracts/', MONO);
const SOURCES = ['src/ifc/step.ts', 'src/ifc/guid.ts', 'src/ifc-vocab.ts'].map((p) => new URL(p, CONTRACTS));
const ESBUILD = new URL('node_modules/esbuild/package.json', CONTRACTS);

export const BANNER = `// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
// GENERATED — do not edit. The contracts IFC kit as plain ES module JS for a page with no build:
// contracts/src/ifc/step.ts (STEP codec), src/ifc/guid.ts (ifcGuid), src/ifc-vocab.ts (ifcTypeFor).
// Regenerate: node tests/fixtures/make_ifc_codec.mjs
`;

export function available() { return SOURCES.every((u) => fs.existsSync(u)) && fs.existsSync(ESBUILD); }

/* Only the part of contracts/ifc/mapping.json that ifcTypeFor reads goes into the page (the type rules);
   the field tables stay in contracts. */
const TYPE_RULES = ['schema', 'ifc_schema', 'noise_classes', 'entities', 'legacy_predefined', 'categories', 'classes'];
const typeRulesOnly = {
  name: 'type-rules-only',
  setup(b) {
    b.onLoad({ filter: /[\\/]ifc[\\/]mapping\.json$/ }, (args) => {
      const m = JSON.parse(fs.readFileSync(args.path, 'utf8'));
      const out = Object.fromEntries(TYPE_RULES.filter((k) => k in m).map((k) => [k, m[k]]));
      for (const e of Object.values(out.entities || {})) for (const k of Object.keys(e)) if (k !== 'occurrence') delete e[k];
      return { contents: JSON.stringify(out), loader: 'json' };
    });
  },
};

export async function render() {
  const esbuild = createRequire(ESBUILD)('esbuild');
  const r = await esbuild.build({
    stdin: {
      contents: "export * from './src/ifc/step.ts';\nexport * from './src/ifc/guid.ts';\n"
        + "export { ifcTypeFor, IFC_SCHEMA } from './src/ifc-vocab.ts';\n",
      resolveDir: fileURLToPath(CONTRACTS), loader: 'ts',
    },
    bundle: true, format: 'esm', target: 'es2020', write: false, treeShaking: true, legalComments: 'none',
    plugins: [typeRulesOnly],
  });
  return BANNER + r.outputFiles[0].text;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!available()) { console.error('needs contracts/src/ifc/*.ts and contracts/node_modules (cd contracts && npm ci)'); process.exit(2); }
  const want = await render();
  if (process.argv.includes('--check')) {
    const ok = fs.existsSync(OUT) && fs.readFileSync(OUT, 'utf8') === want;
    console.log(ok ? 'js/ifc/apk-ifc.mjs is current' : 'js/ifc/apk-ifc.mjs is STALE: node tests/fixtures/make_ifc_codec.mjs');
    process.exit(ok ? 0 : 1);
  }
  fs.mkdirSync(new URL('./', OUT), { recursive: true });
  fs.writeFileSync(OUT, want);
  console.log(`wrote js/ifc/apk-ifc.mjs (${want.length} bytes) from contracts`);
}
