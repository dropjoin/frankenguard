import { describe, expect, it } from "vitest";

import { readEnv } from "../../src/api/env.js";

// The TRUST_PROXY contract (audit M1): the deployment docs say `1`,
// TAMPER_DEMO already uses `1`, and the code used to require the
// string "true" — so a deployment following the docs ran with proxy
// trust off and every visitor sharing one rate-limit bucket.
describe("readEnv flag parsing", () => {
  it("treats TRUST_PROXY=1 as proxy trust on", () => {
    expect(readEnv({ TRUST_PROXY: "1" }).trustProxy).toBe(true);
  });

  it("treats TRUST_PROXY=true as proxy trust on", () => {
    expect(readEnv({ TRUST_PROXY: "true" }).trustProxy).toBe(true);
  });

  it("treats an unset TRUST_PROXY as proxy trust off", () => {
    expect(readEnv({}).trustProxy).toBe(false);
  });

  it("treats other TRUST_PROXY values as proxy trust off", () => {
    expect(readEnv({ TRUST_PROXY: "0" }).trustProxy).toBe(false);
    expect(readEnv({ TRUST_PROXY: "yes" }).trustProxy).toBe(false);
    expect(readEnv({ TRUST_PROXY: "TRUE" }).trustProxy).toBe(false);
  });

  it("keeps the TAMPER_DEMO=1 convention", () => {
    expect(readEnv({ TAMPER_DEMO: "1" }).tamperDemo).toBe(true);
    expect(readEnv({}).tamperDemo).toBe(false);
  });

  it("keeps the documented defaults", () => {
    const env = readEnv({});
    expect(env.port).toBe(3000);
    expect(env.host).toBe("0.0.0.0");
    expect(env.dbPath).toBe("./data/frankenguard.db");
    expect(env.agentMode).toBe("scripted");
    expect(env.cookieSecure).toBe(false);
  });
});
