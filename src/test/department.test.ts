import { describe, expect, it } from "vitest";

import { getDepartmentName, toDepartmentColumns } from "@/lib/department";

describe("department compatibility bridge", () => {
  it("prefers department_name when both department fields are present", () => {
    expect(
      getDepartmentName({
        department_name: "Economics",
        department_id: "Legacy Economics",
      }),
    ).toBe("Economics");
  });

  it("falls back to department_id when department_name is missing", () => {
    expect(
      getDepartmentName({
        department_name: null,
        department_id: "Economics",
      }),
    ).toBe("Economics");
  });

  it("writes both department fields during the compatibility period", () => {
    expect(toDepartmentColumns("Economics")).toEqual({
      department_name: "Economics",
      department_id: "Economics",
    });
  });
});
