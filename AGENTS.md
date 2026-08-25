# AGENTS.md

## Cursor Cloud specific instructions

### What this project is
A single-page, client-side web app: **"Creador de Propuestas — Megamedia Digital 2026"**, a Spanish-language advertising-proposal/rate calculator. There is **no build step, no `package.json`, no tests, and no linter**. It is plain static HTML/CSS/JS plus image assets and one optional Vercel serverless function.

- `index.html` — the canonical app (see the comment at the top of the file). `Calculadora_Megamedia_2026_v21.html` and `deploy_calculadora/index.html` are copies that must be kept in sync with `index.html`.
- `Tarifario_Megamedia_Digital_2026 (2).html` — a standalone rate-card page.
- `assets/` — logo images referenced by the HTML.
- `api/propuestas.js` — a Vercel serverless function (ES module) that proxies team-proposal storage to an external JSONBin. `deploy_calculadora/` is a deploy-ready copy with `vercel.json`.

### Running the app (development)
The app is fully functional as static files. Serve the repo root and open `index.html`:

```
python3 -m http.server 3000
# then open http://localhost:3000/index.html
```

This is the recommended, headless-friendly dev server (Python is preinstalled; nothing to install).

### Non-obvious caveats
- **Login is a name picker, not real auth.** On first load a `¿Quién eres?` overlay blocks the UI (`need-login` class). Pick an executive name to proceed; the choice is stored in `localStorage` (`mg_ejecutivo_v1`). To re-trigger it, clear localStorage or click "Salir".
- **The `/api/propuestas` endpoint does NOT run under a plain static server** (returns 404). This is expected and harmless: the client falls back to calling the external store directly and then to `localStorage`. Core functionality (calculator, drafts, history, reports) does not depend on it.
- **The external team store may be unavailable.** `https://jsonbin-zeta.vercel.app/...` currently returns HTTP 402; team-sync silently degrades to `localStorage`. Not a bug in local dev.
- **External CDNs are required for full fidelity.** The app loads Google Fonts, ExcelJS (Excel export), and fetches the USD→CLP rate from `api.frankfurter.dev`. These need network egress; the app still works without them (fonts/exchange-rate degrade gracefully).
- **To exercise the real serverless function locally**, use `vercel dev` (Vercel CLI). This requires an interactive `vercel login` (device flow) and is therefore NOT part of automated startup. The CLI installs to the repo-local `.npm_global/` prefix (gitignored); add it to `PATH` with `export PATH="/workspace/.npm_global/bin:$PATH"` before running `vercel login` && `vercel dev`.
- **Keep the three HTML copies in sync** when editing app behavior (`index.html` is the source of truth).
