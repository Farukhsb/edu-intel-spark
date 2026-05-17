import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const LecturerOverviewExportSection = ({
  onExportCsv,
  onExportPdf,
}: {
  onExportCsv: () => void;
  onExportPdf: () => Promise<void>;
}) => (
  <Card className="shadow-sm">
    <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-sm font-medium">Export grade data</p>
        <p className="text-xs text-muted-foreground">
          Download your current overview data for reporting or review.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onExportCsv}>
          <Download className="mr-1.5 h-3.5 w-3.5" /> CSV
        </Button>
        <Button variant="outline" size="sm" onClick={() => void onExportPdf()}>
          <Download className="mr-1.5 h-3.5 w-3.5" /> PDF
        </Button>
      </div>
    </CardContent>
  </Card>
);
