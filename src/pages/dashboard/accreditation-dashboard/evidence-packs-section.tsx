import { Award, Download, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const EvidencePacksSection = ({
  onExportOfsB3EvidencePack,
  onExportTefNarrativeSubmission,
}: {
  onExportOfsB3EvidencePack: () => void;
  onExportTefNarrativeSubmission: () => void;
}) => (
  <Card className="border-primary/20">
    <CardHeader>
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-primary" />
        <CardTitle className="text-base">B3 & TEF Exports</CardTitle>
      </div>
    </CardHeader>
    <CardContent className="grid gap-3 sm:grid-cols-2">
      <Button variant="outline" className="w-full justify-start" onClick={onExportOfsB3EvidencePack}>
        <Award className="mr-2 h-4 w-4" />
        OfS B3 export
      </Button>
      <Button variant="outline" className="w-full justify-start" onClick={onExportTefNarrativeSubmission}>
        <FileText className="mr-2 h-4 w-4" />
        TEF narrative export
      </Button>
    </CardContent>
  </Card>
);
