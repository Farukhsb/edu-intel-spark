import type { Dispatch, SetStateAction } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown, Plus } from "lucide-react";

import { RubricBuilder, type RubricCriterion } from "@/components/RubricBuilder";
import { STARTER_ASSIGNMENT_TEMPLATES } from "@/data/assignmentSets";
import { cn } from "@/lib/utils";

interface AssignmentFormDialogProps {
  applyStarterTemplate: (templateId: string) => void;
  creating: boolean;
  departments: string[];
  dialogOpen: boolean;
  dueDate: string;
  editingAssignmentId: string | null;
  maxScore: string;
  moduleCode: string;
  onDialogOpenChange: (open: boolean) => void;
  onOpenCreateDialog: () => void;
  onSave: () => void;
  resetAssignmentForm: () => void;
  rubric: RubricCriterion[];
  selectedCohorts: string[];
  selectedDepartments: string[];
  selectedTemplateId: string;
  setDescription: Dispatch<SetStateAction<string>>;
  setDueDate: Dispatch<SetStateAction<string>>;
  setMaxScore: Dispatch<SetStateAction<string>>;
  setModuleCode: Dispatch<SetStateAction<string>>;
  setRubric: Dispatch<SetStateAction<RubricCriterion[]>>;
  setTitle: Dispatch<SetStateAction<string>>;
  summarizeSelection: (
    selected: string[] | null | undefined,
    labelForValue: (value: string) => string,
    emptyLabel: string,
  ) => string;
  targetCohorts: Array<{ value: string; label: string }>;
  title: string;
  toggleCohort: (cohortId: string) => void;
  toggleDepartment: (departmentId: string) => void;
  description: string;
}

export const AssignmentFormDialog = ({
  applyStarterTemplate,
  creating,
  departments,
  dialogOpen,
  dueDate,
  editingAssignmentId,
  maxScore,
  moduleCode,
  onDialogOpenChange,
  onOpenCreateDialog,
  onSave,
  resetAssignmentForm,
  rubric,
  selectedCohorts,
  selectedDepartments,
  selectedTemplateId,
  setDescription,
  setDueDate,
  setMaxScore,
  setModuleCode,
  setRubric,
  setTitle,
  summarizeSelection,
  targetCohorts,
  title,
  toggleCohort,
  toggleDepartment,
  description,
}: AssignmentFormDialogProps) => (
  <Dialog
    open={dialogOpen}
    onOpenChange={(open) => {
      onDialogOpenChange(open);
      if (!open) resetAssignmentForm();
    }}
  >
    <DialogTrigger asChild>
      <Button onClick={onOpenCreateDialog}>
        <Plus className="mr-2 h-4 w-4" />
        New Assignment
      </Button>
    </DialogTrigger>
    <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{editingAssignmentId ? "Edit Assignment" : "Create Assignment"}</DialogTitle>
        <DialogDescription>
          {editingAssignmentId
            ? "Update the brief and cohort targeting before the next publish or release step."
            : "Set up the brief now, then publish when you are ready to accept submissions."}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 pt-2">
        {!editingAssignmentId && (
          <div className="space-y-2">
            <Label htmlFor="starterTemplate">Use sample assignment</Label>
            <Select value={selectedTemplateId} onValueChange={applyStarterTemplate}>
              <SelectTrigger id="starterTemplate">
                <SelectValue placeholder="Start from a reusable sample" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Start from blank</SelectItem>
                {STARTER_ASSIGNMENT_TEMPLATES.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Loads a starter brief and rubric into this form only. Nothing is saved or published until you review and create the draft.
            </p>
          </div>
        )}
        <div className="rounded-lg border bg-muted/30 p-4 text-sm">
          <p className="font-medium">What happens next</p>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            <li>New assignments start as drafts.</li>
            <li>Students only see assignments after you publish them.</li>
            <li>Adding a rubric now gives cleaner AI grading later.</li>
          </ul>
        </div>
        <div className="space-y-2">
          <Label htmlFor="title">Title *</Label>
          <Input id="title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Assignment 1 - Data Structures" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="module">Module Code</Label>
          <Input id="module" value={moduleCode} onChange={(event) => setModuleCode(event.target.value)} placeholder="e.g. CS301" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description / Instructions</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Describe what students should submit..."
            rows={3}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="maxScore">Max Score</Label>
            <Input id="maxScore" type="number" value={maxScore} onChange={(event) => setMaxScore(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dueDate">Due Date</Label>
            <Input id="dueDate" type="datetime-local" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Target Cohorts (optional)</Label>
          <p className="text-xs text-muted-foreground">
            Published assignment notifications only go to cohorts linked here.
          </p>
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" className="w-full justify-between font-normal">
                <span className="truncate text-left">
                  {summarizeSelection(
                    selectedCohorts,
                    (value) => targetCohorts.find((cohort) => cohort.value === value)?.label ?? value,
                    "Select target cohorts",
                  )}
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-3" align="start">
              <div className="space-y-2">
                {targetCohorts.map((cohort) => (
                  <label
                    key={cohort.value}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-muted",
                      selectedCohorts.includes(cohort.value) && "bg-muted",
                    )}
                  >
                    <Checkbox
                      checked={selectedCohorts.includes(cohort.value)}
                      onCheckedChange={() => toggleCohort(cohort.value)}
                    />
                    {cohort.label}
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <Label>Target Departments (optional)</Label>
          <p className="text-xs text-muted-foreground">
            If set, published assignment visibility is also restricted to these departments.
          </p>
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" className="w-full justify-between font-normal">
                <span className="truncate text-left">
                  {summarizeSelection(selectedDepartments, (value) => value, "Select target departments")}
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-3" align="start">
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {departments.map((department) => (
                  <label
                    key={department}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-muted",
                      selectedDepartments.includes(department) && "bg-muted",
                    )}
                  >
                    <Checkbox
                      checked={selectedDepartments.includes(department)}
                      onCheckedChange={() => toggleDepartment(department)}
                    />
                    {department}
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <RubricBuilder rubric={rubric} onChange={setRubric} maxScore={Number(maxScore) || 100} />
        <Button onClick={onSave} disabled={creating} className="w-full">
          {creating
            ? (editingAssignmentId ? "Saving..." : "Creating...")
            : (editingAssignmentId ? "Save Assignment Changes" : "Create Draft Assignment")}
        </Button>
      </div>
    </DialogContent>
  </Dialog>
);
