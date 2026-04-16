import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, GripVertical } from "lucide-react";

export interface RubricCriterion {
  criterion: string;
  weight: number;
  description: string;
}

interface RubricBuilderProps {
  rubric: RubricCriterion[];
  onChange: (rubric: RubricCriterion[]) => void;
  maxScore: number;
}

export const RubricBuilder = ({ rubric, onChange, maxScore }: RubricBuilderProps) => {
  const totalWeight = rubric.reduce((sum, r) => sum + r.weight, 0);
  const remaining = maxScore - totalWeight;

  const addCriterion = () => {
    onChange([
      ...rubric,
      { criterion: "", weight: Math.max(remaining, 0), description: "" },
    ]);
  };

  const updateCriterion = (index: number, field: keyof RubricCriterion, value: string | number) => {
    const updated = rubric.map((r, i) =>
      i === index ? { ...r, [field]: field === "weight" ? Number(value) || 0 : value } : r
    );
    onChange(updated);
  };

  const removeCriterion = (index: number) => {
    onChange(rubric.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Rubric Criteria</p>
        <span className={`text-xs font-medium ${remaining < 0 ? "text-destructive" : remaining === 0 ? "text-success" : "text-muted-foreground"}`}>
          {totalWeight}/{maxScore} pts allocated
        </span>
      </div>

      {rubric.map((item, i) => (
        <Card key={i} className="border-dashed">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                value={item.criterion}
                onChange={(e) => updateCriterion(i, "criterion", e.target.value)}
                placeholder="Criterion name (e.g. Code Quality)"
                className="flex-1"
              />
              <Input
                type="number"
                value={item.weight}
                onChange={(e) => updateCriterion(i, "weight", e.target.value)}
                className="w-20"
                placeholder="pts"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeCriterion(i)}
                className="shrink-0 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <Textarea
              value={item.description}
              onChange={(e) => updateCriterion(i, "description", e.target.value)}
              placeholder="Describe what earns full marks..."
              rows={2}
              className="text-xs"
            />
          </CardContent>
        </Card>
      ))}

      <Button variant="outline" size="sm" onClick={addCriterion} className="w-full">
        <Plus className="mr-2 h-3 w-3" />
        Add Criterion
      </Button>
    </div>
  );
};
