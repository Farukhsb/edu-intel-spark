import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AssignmentIntegrityCard } from "@/pages/dashboard/assignment-detail/ui";

describe("AssignmentIntegrityCard", () => {
  it("uses the clear status as a dismiss action when a clear handler is provided", () => {
    const onClear = vi.fn();

    render(
      <AssignmentIntegrityCard
        integrityCard={{
          badgeLabel: "Clear",
          cardTone: "clear",
          shouldShowCard: true,
        }}
        onClear={onClear}
        plagiarismFlags={[]}
        plagiarismSummary="No submissions crossed the current integrity thresholds."
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
