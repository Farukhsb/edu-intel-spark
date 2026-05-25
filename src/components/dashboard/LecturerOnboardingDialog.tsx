import { Brain } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onDismiss: () => void;
};

const lecturerOnboardingActions = [
  {
    title: "Review your workspace overview",
    description: "Start on Overview to see current teaching pressure, recent submissions, and the next workflow that needs attention.",
  },
  {
    title: "Create or open an assignment",
    description: "Use Assignments to create new assessment work or reopen an existing assignment for grading and release activity.",
  },
  {
    title: "Check grading, integrity, and moderation before release",
    description: "Before students see results, confirm the grading flow is complete and review any integrity or moderation work that still needs action.",
  },
] as const;

export const LecturerOnboardingDialog = ({ open, onDismiss }: Props) => (
  <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onDismiss() : undefined)}>
    <DialogContent className="max-w-3xl gap-5 p-0">
      <div className="border-b border-border/70 px-6 py-5">
        <DialogHeader className="space-y-2 text-left">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Welcome to GradeAI</DialogTitle>
              <DialogDescription>
                GradeAI helps you manage teaching and assessment work in one place. Start with these three first actions.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
      </div>

      <div className="px-6">
        <div className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
          <p className="text-sm font-medium text-foreground">Start here</p>
          <ol className="mt-2 space-y-1 text-sm text-muted-foreground">
            <li>1. Review your <span className="font-medium text-foreground">workspace overview</span>.</li>
            <li>2. Create or open an <span className="font-medium text-foreground">assignment</span>.</li>
            <li>3. Check <span className="font-medium text-foreground">grading, integrity, and moderation</span> before release.</li>
          </ol>
        </div>
      </div>

      <div className="grid gap-3 px-6 pb-1 md:grid-cols-3">
        {lecturerOnboardingActions.map((card) => (
          <div key={card.title} className="rounded-2xl border border-border/70 bg-background px-4 py-3 shadow-sm">
            <p className="text-sm font-semibold text-foreground">{card.title}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{card.description}</p>
          </div>
        ))}
      </div>

      <DialogFooter className="border-t border-border/70 px-6 py-4 sm:justify-between sm:space-x-0">
        <p className="text-xs text-muted-foreground">
          You can close this now and start working immediately.
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="ghost" onClick={onDismiss}>
            Skip for now
          </Button>
          <Button type="button" onClick={onDismiss}>
            Start using GradeAI
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
