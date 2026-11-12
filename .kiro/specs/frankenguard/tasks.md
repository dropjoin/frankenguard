# Tasks: Frankenguard

Spec-first: this list was written before the implementation. Boxes get
checked as each piece lands with passing tests.

- [x] 1. Spec and steering: requirements (EARS), design, tasks, steering docs
- [x] 2. Rule engine (`src/engine.js`): six gates in fixed order, verdict trace, reason codes
- [x] 3. Engine tests: every gate, edge cases (empty payee, NaN, exponents, Unicode digits), determinism
- [x] 4. Intent parser (`src/parser.js`): strict amount grammar, payee resolution, invoice refs
- [x] 5. Parser tests: happy paths, amount tricks, injection-shaped input, unparseable input
- [x] 6. Hash-chained ledger (`src/ledger.js`): append, verify, tamper detection, injected hash fn
- [x] 7. Ledger tests: chain growth, verification, tamper fuzz
- [x] 8. Invariant tests: P1-P5 over randomized inputs
- [x] 9. MCP server (`tools/mcp-server/`): stdio JSON-RPC, three tools, smoke test
- [x] 10. Kiro hooks + MCP config + custom agent definition in `.kiro/`
- [ ] 11. UI (`app/`): hero, console, verdict trace, policy panel, ledger, anatomy, honesty block
- [ ] 12. Build script: inline `src/` + `app.js` into `dist/index.html`, deterministic bytes
- [ ] 13. Verify script: title check, secret scan, inlining check, honesty-label check
- [ ] 14. Deploy script: Cloudflare Worker + custom subdomain, live verification
- [ ] 15. README, build journal, competitor scan, Devpost draft
- [ ] 16. Final pass: full test suite green, live demo exercised end to end, no secrets committed
