import { describe, expect, it } from "vitest";
import { mergeFieldErrors } from "../forms/errors";

describe("field errors", () => {
  it("keeps the autosave error when the field's submit error was cleared by an edit", () => {
    const merged = mergeFieldErrors({ phoneNumber: "Enter a 9-digit Mozambican mobile number." }, { phoneNumber: undefined });
    expect(merged.phoneNumber).toBe("Enter a 9-digit Mozambican mobile number.");
  });

  it("lets a submit error take precedence", () => {
    expect(mergeFieldErrors({ headline: "A" }, { headline: "B" }).headline).toBe("B");
  });

  it("shows nothing when there are no errors", () => {
    expect(mergeFieldErrors(undefined, { headline: undefined })).toEqual({});
  });
});
