# Smoke test — EDITORS.BOM

Is `EDITORS.BOM` deployed? Written by `.apk.scripts/smoke.py` from the module's own shape; what each check means is in that script's header.

← [Wiki home](../README.md)

**✅ PASS** — 3/3 checks, since 2026-11-04 21:31 EST

| Check | Target | Result | Detail |
|---|---|---|---|
| pushed | [APK.softapp.EDITORS.BOM](https://github.com/LikeDotAudio/APK.softapp.EDITORS.BOM.git) | ✅ | HEAD is on origin |
| web | [index.html](https://apk.audio/APK%3ASoftapps/EDITORS/EDITORS.BOM/index.html) | ✅ | HTTP 200 |
| app | `OS/BOM Procurement` → `PODS/POD.THIN/Softapps/EDITORS/EDITORS.BOM/index.html` | ✅ | present |

Re-run: `python3 .apk.scripts/smoke.py PODS/POD.THIN/Softapps/EDITORS/EDITORS.BOM`

<!-- smoke:sig 04fc343d52c4 since 2026-11-04 21:31 EST -->
