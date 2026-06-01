import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GradeSourceBadge } from "@/components/dashboard/GradeSourceBadge";

describe("GradeSourceBadge", () => {
  it("renders the source labels", () => {
    render(
      <div>
        <GradeSourceBadge source="ai_graded" />
        <GradeSourceBadge source="lecturer_reviewed" />
        <GradeSourceBadge source="lecturer_uploaded" />
      </div>,
    );

    expect(screen.getByText("AI Graded")).toBeInTheDocument();
    expect(screen.getByText("Lecturer Reviewed")).toBeInTheDocument();
    expect(screen.getByText("Uploaded")).toBeInTheDocument();
  });

  it("renders nothing for unknown sources", () => {
    const { container } = render(<GradeSourceBadge source={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
