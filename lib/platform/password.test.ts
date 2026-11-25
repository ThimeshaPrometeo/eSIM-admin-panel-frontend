import { describe, expect, it } from "vitest";
import { passwordRules, passwordStrength } from "./password";

describe("password strength", () => {
  it("is empty, then weak until 10 characters", () => {
    expect(passwordStrength("").label).toBe("");
    expect(passwordStrength("Ab1!").label).toBe("Weak");
  });
  it("goes up with each extra rule", () => {
    expect(passwordStrength("abcdefghij").label).toBe("Fair");
    expect(passwordStrength("Abcdefghij1").label).toBe("Good");
    expect(passwordStrength("Abcdefghij1!").label).toBe("Strong");
  });
  it("only the length rule is required", () => {
    const rules = passwordRules("abcdefghij");
    expect(rules.filter((r) => r.required).map((r) => r.key)).toEqual(["length"]);
    expect(rules.find((r) => r.key === "length")!.met).toBe(true);
    expect(rules.find((r) => r.key === "number")!.met).toBe(false);
  });
});
