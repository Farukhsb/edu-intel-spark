import { expect, test } from "@playwright/test";
import { setE2EAuth } from "./helpers/auth";
import { createMockSupabaseState, installSupabaseMocks } from "./helpers/mockSupabase";

const lecturer = {
  id: "lecturer-1",
  email: "lecturer@gradeai.test",
  fullName: "Dr. Ada Lecturer",
};

test.describe("assignment management workflows", () => {
  test("lecturer can edit assignment targeting and persist the updated links", async ({ page }) => {
    const state = createMockSupabaseState({
      assignments: [
        {
          id: "assignment-targeting",
          title: "Targeted Coursework",
          description: "Draft assignment with saved targeting.",
          module_code: "BIO201",
          max_score: 100,
          due_date: "2026-05-10T09:00:00.000Z",
          status: "draft",
          lecturer_id: lecturer.id,
          rubric: [],
        },
      ],
      assignment_cohorts: [
        { assignment_id: "assignment-targeting", cohort_id: "100" },
      ],
      assignment_departments: [
        { assignment_id: "assignment-targeting", department_id: "Economics" },
      ],
      profiles: [
        {
          id: lecturer.id,
          full_name: lecturer.fullName,
          email: lecturer.email,
          role: "lecturer",
          avatar_url: null,
          cohort_id: null,
          department_id: null,
        },
      ],
    });

    await installSupabaseMocks(page, state);
    await setE2EAuth(page, { role: "lecturer", ...lecturer });

    await page.goto("/dashboard/assignments");
    await page.waitForURL("**/dashboard/assignments");
    await expect(page.getByRole("heading", { name: "Manage Assignments" })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Targeted Coursework")).toBeVisible();

    await page.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByRole("heading", { name: "Edit Assignment" })).toBeVisible();

    await page.getByRole("button", { name: /Level 100/i }).click();
    await page.getByText("Level 200").click();

    await page.getByRole("button", { name: /Economics/i }).click();
    await page.getByText("Biology").click();

    await page.getByRole("button", { name: "Save Assignment Changes" }).click();
    await expect(page.getByRole("heading", { name: "Edit Assignment" })).not.toBeVisible();
    await expect(page.getByText("Level 200")).toBeVisible();
    await expect(page.getByText("Biology")).toBeVisible();

    expect(
      state.tables.assignment_cohorts
        .filter((row) => row.assignment_id === "assignment-targeting")
        .map((row) => row.cohort_id)
        .sort(),
    ).toEqual(["100", "200"]);

    expect(
      state.tables.assignment_departments
        .filter((row) => row.assignment_id === "assignment-targeting")
        .map((row) => row.department_id)
        .sort(),
    ).toEqual(["Biology", "Economics"]);
  });

  test("lecturer can preview and complete a bulk student upload from the dashboard", async ({ page }) => {
    const state = createMockSupabaseState({
      profiles: [
        {
          id: lecturer.id,
          full_name: lecturer.fullName,
          email: lecturer.email,
          role: "lecturer",
          avatar_url: null,
          cohort_id: null,
          department_id: null,
        },
      ],
    });

    await installSupabaseMocks(page, state);
    await setE2EAuth(page, { role: "lecturer", ...lecturer });

    await page.goto("/dashboard/assignments");
    await page.waitForURL("**/dashboard/assignments");
    await page.getByRole("button", { name: /Admin/i }).click();
    await page.getByRole("button", { name: "Bulk Upload Students" }).click();
    await expect(page.getByRole("heading", { name: "Bulk Student Upload" })).toBeVisible();

    const csv = [
      "name,email,cohort,department",
      "Sam Student,sam@student.test,200,Computer Science",
      "Mina Student,mina@student.test,300,Biology",
    ].join("\n");

    await page.locator('input[type="file"]').setInputFiles({
      name: "students.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });

    await expect(page.getByText("students.csv")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create 2 Student Accounts" })).toBeVisible();

    await page.getByRole("button", { name: "Create 2 Student Accounts" }).click();
    await expect(page.getByText("2 student(s) created")).toBeVisible();
    await expect(page.getByText("Verified student profiles")).toBeVisible();
    await expect(page.getByText("Sam Student").first()).toBeVisible();
    await expect(page.getByText("mina@student.test")).toBeVisible();

    expect(
      state.tables.profiles.filter((row) => row.role === "student").map((row) => row.email).sort(),
    ).toEqual(["mina@student.test", "sam@student.test"]);
  });
});
