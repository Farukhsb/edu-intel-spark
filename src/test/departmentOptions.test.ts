import { describe, expect, it } from "vitest";

import { ASSIGNMENT_TARGET_DEPARTMENTS, DEPARTMENT_OPTIONS } from "@/lib/departmentOptions";

describe("departmentOptions", () => {
  it("includes the expanded pilot department set and an explicit Other option", () => {
    expect(DEPARTMENT_OPTIONS).toEqual(
      expect.arrayContaining([
        "Chemistry",
        "Law",
        "Medicine",
        "Psychology",
        "Nursing",
        "Education",
        "Languages",
        "Other",
      ]),
    );
  });

  it("keeps assignment targeting aligned with the shared department options", () => {
    expect(ASSIGNMENT_TARGET_DEPARTMENTS).toEqual([...DEPARTMENT_OPTIONS]);
  });
});
