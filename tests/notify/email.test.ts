import { describe, it, expect } from "vitest";

import { isHighSeverity } from "../../lib/notify/email";

describe("isHighSeverity", () => {
  it("treats HIGH and CRITICAL as notifiable", () => {
    expect(isHighSeverity("HIGH")).toBe(true);
    expect(isHighSeverity("CRITICAL")).toBe(true);
  });

  it("treats LOW and MEDIUM as not notifiable", () => {
    expect(isHighSeverity("LOW")).toBe(false);
    expect(isHighSeverity("MEDIUM")).toBe(false);
    expect(isHighSeverity("anything-else")).toBe(false);
  });
});
