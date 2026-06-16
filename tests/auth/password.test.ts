import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../../lib/auth/password";

describe("password hashing", () => {
  it("verifies a correct password against its hash", () => {
    const hash = hashPassword("correct horse battery staple");
    expect(verifyPassword("correct horse battery staple", hash)).toBe(true);
  });

  it("rejects an incorrect password", () => {
    const hash = hashPassword("correct horse battery staple");
    expect(verifyPassword("wrong password", hash)).toBe(false);
  });

  it("produces a unique salt per call (same password, different hashes)", () => {
    const a = hashPassword("same");
    const b = hashPassword("same");
    expect(a).not.toBe(b);
    // ...but both still verify.
    expect(verifyPassword("same", a)).toBe(true);
    expect(verifyPassword("same", b)).toBe(true);
  });

  it("rejects a malformed stored hash instead of throwing", () => {
    expect(verifyPassword("anything", "")).toBe(false);
    expect(verifyPassword("anything", "no-colon-here")).toBe(false);
    expect(verifyPassword("anything", "deadbeef:")).toBe(false);
  });

  it("rejects when the derived key length is tampered with", () => {
    const [salt] = hashPassword("pw").split(":");
    expect(verifyPassword("pw", `${salt}:abcd`)).toBe(false);
  });
});
