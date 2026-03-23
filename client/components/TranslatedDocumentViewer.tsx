import React, { useState } from "react";
import { Loader2, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import { getClinicAuthHeader } from "@/lib/clinic-auth";
import type { ClinicPatientDetailsResponse, SharedMedicalRecord } from "@shared/api";

interface TranslatedDocumentViewerProps {
  record: SharedMedicalRecord;
  appointmentId: string;
}

export const TranslatedDocumentViewer: React.FC<TranslatedDocumentViewerProps> = ({
  record,
  appointmentId,
}) => {
  const [translating, setTranslating] = useState(false);
  const [translated, setTranslated] = useState<string | null>(null);

  const handleTranslate = async () => {
    setTranslating(true);
    try {
      let base64 = record.data;

      // Fetch record data if not already loaded
      if (!base64) {
        const dataResponse = await fetch(
          `/api/clinic/appointments/${appointmentId}/patient?includeRecordData=true`,
          { headers: { ...getClinicAuthHeader() } },
        );
        if (!dataResponse.ok) {
          throw new Error("Failed to load document data.");
        }
        const payload = (await dataResponse.json()) as ClinicPatientDetailsResponse;
        base64 = payload.sharedRecord?.data;
      }

      if (!base64) {
        throw new Error("Document data is unavailable.");
      }

      const response = await fetch("/api/clinic/documents/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getClinicAuthHeader(),
        },
        body: JSON.stringify({ base64, mimeType: record.type, fileName: record.name }),
      });

      const data = (await response.json()) as {
        success: boolean;
        translated?: string;
        message?: string;
      };

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "Translation failed.");
      }

      setTranslated(data.translated ?? "");
    } catch (err) {
      toast({
        title: "Translation failed",
        description: err instanceof Error ? err.message : "Unable to translate document.",
        variant: "destructive",
      });
    } finally {
      setTranslating(false);
    }
  };

  if (!translated) {
    return (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={translating}
        onClick={handleTranslate}
        className="gap-1.5"
      >
        {translating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Translating...
          </>
        ) : (
          <>
            <Languages className="h-4 w-4" />
            Translate to Japanese
          </>
        )}
      </Button>
    );
  }

  return (
    <Tabs defaultValue="translated" className="w-full mt-2">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="original">Original</TabsTrigger>
        <TabsTrigger value="translated">Japanese</TabsTrigger>
      </TabsList>
      <TabsContent value="original">
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-sm text-slate-700">{record.name}</p>
          <p className="text-xs text-slate-500 mt-0.5">{record.type}</p>
        </div>
      </TabsContent>
      <TabsContent value="translated">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 max-h-64 overflow-y-auto">
          <pre className="text-xs text-slate-700 whitespace-pre-wrap font-sans">{translated}</pre>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-1 text-xs text-slate-500"
          onClick={() => setTranslated(null)}
        >
          Re-translate
        </Button>
      </TabsContent>
    </Tabs>
  );
};
