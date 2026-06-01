import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getGradeSourcePresentation } from "@/lib/gradeSource";

export const GradeSourceBadge = ({
  source,
  className,
}: {
  source: string | null | undefined;
  className?: string;
}) => {
  const presentation = getGradeSourcePresentation(source);
  if (!presentation) return null;

  return (
    <Badge
      variant={presentation.variant as BadgeProps["variant"]}
      className={cn("text-[10px] uppercase tracking-wide", presentation.className, className)}
    >
      {presentation.label}
    </Badge>
  );
};
