import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "../safeRedirect";

describe("safeRedirectPath", () => {
  it.each([
    [null, "/"],
    [undefined, "/"],
    ["", "/"],
    ["/calendar", "/calendar"],
    ["/analyze/abc?x=1", "/analyze/abc?x=1"],
    ["//evil.com", "/"],                    // protocol-relative open redirect
    ["//evil.com/back", "/"],
    ["/\\\\evil.com", "/"],                 // backslash trick
    ["https://evil.com", "/"],              // absolute URL
    ["javascript:alert(1)", "/"],
    ["calendar", "/"],                      // relative, not root-relative
  ])("safeRedirectPath(%j) === %j", (input, expected) => {
    expect(safeRedirectPath(input)).toBe(expected);
  });
});
