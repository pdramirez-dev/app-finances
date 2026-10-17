import { describe, expect, it } from "vitest";

import { companyProfile } from "@/lib/company";

describe("companyProfile", () => {
  it("only exposes masked payment identifiers", () => {
    expect(companyProfile.accountNumber).toMatch(/^•{4}\s\d{4}$/);
    expect(companyProfile.routeAch).toMatch(/^•{4}\s\d{4}$/);
    expect(companyProfile.routeWire).toMatch(/^•{4}\s\d{4}$/);
  });
});
