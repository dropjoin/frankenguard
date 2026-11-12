# Structure steering: Frankenguard

```
frankenguard/
  .kiro/
    steering/      product.md, tech.md, structure.md (this file)
    specs/
      frankenguard/  requirements.md, design.md, tasks.md
    hooks/         agent hook configs (test-on-save, ledger-check)
    settings/
      mcp.json     MCP server config for Kiro
    agents/        custom agent definitions
  src/
    engine.js      deterministic rule engine (no DOM, no platform APIs)
    parser.js      natural-language intent parser (no DOM)
    ledger.js      hash-chained audit ledger (hash function injected)
  tools/
    mcp-server/    stdio JSON-RPC MCP server exposing the engine
  app/
    index.html     page template; <script src> tags get inlined by build
    app.js         DOM wiring only; all decisions come from src/
  scripts/
    build.mjs      inlines src/ + app.js into dist/index.html
    verify.mjs     static checks: title, secrets, inlining, honesty labels
    deploy.py      Cloudflare Worker upload + custom domain attach
  tests/
    engine.test.js parser.test.js ledger.test.js mcp.test.js
    invariants.test.js
  dist/
    index.html     built artifact; this exact file is what gets deployed
  docs/
    competitor-scan.md  what the field looks like and what we must beat
    devpost-draft.md    submission text, ready for the Devpost form
  BUILD-JOURNAL.md  dated notes: decisions, friction, what tests caught
  README.md
  LICENSE
```

## Rules

- `src/` modules never touch the DOM, `localStorage`, `fetch`, or
  `process`. If a module needs a platform capability, it receives it as an
  injected argument. This is what makes the browser/tests duality honest.
- `app/app.js` never makes a policy decision. It renders state, collects
  input, and calls `src/` functions. A decision found in `app.js` is a bug.
- `dist/index.html` is generated. Never edit it by hand; edit the source
  and run `npm run build`. The build is deterministic: same source, same
  bytes.
- Tests live next to what they prove and are named after the module, plus
  `invariants.test.js` for property-style checks that hold over randomized
  inputs.
