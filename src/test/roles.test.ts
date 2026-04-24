import { describe, expect, it } from "vitest";
import {
  isAdminRole,
  isLecturerEquivalentRole,
  isStudentRole,
  parseAppRole,
} from "@/lib/roles";

describe("role helpers", () => {
  it("parses supported application roles explicitly", () => {
    expect(parseAppRole("lecturer")).toBe("lecturer");
    expect(parseAppRole("student")).toBe("student");
    expect(parseAppRole("admin")).toBe("admin");
    expect(parseAppRole("owner")).toBeNull();
    expect(parseAppRole(null)).toBeNull();
  });

  it("treats admin as lecturer-equivalent without treating students as staff", () => {
    expect(isAdminRole("admin")).toBe(true);
    expect(isAdminRole("lecturer")).toBe(false);
    expect(isLecturerEquivalentRole("admin")).toBe(true);
    expect(isLecturerEquivalentRole("lecturer")).toBe(true);
    expect(isLecturerEquivalentRole("student")).toBe(false);
    expect(isStudentRole("student")).toBe(true);
    expect(isStudentRole("admin")).toBe(false);
  });
});
