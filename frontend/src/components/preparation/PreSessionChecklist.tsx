import React from "react";
import { CheckSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { CustomCheckbox } from "@/components/preparation/CustomCheckbox";

interface PreSessionChecklistProps {
  checks: { audio: boolean; environment: boolean; connectivity: boolean; };
  toggleCheck: (key: "audio" | "environment" | "connectivity") => void;
}

export function PreSessionChecklist({ checks, toggleCheck }: PreSessionChecklistProps) {
  return (
          <Card className="bg-[#12151C] border-white/5 shadow-xl hover:-translate-y-0" hoverEffect={false}>
            <CardContent className="p-8">
              <div className="flex items-center gap-2 mb-6">
                <CheckSquare className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold text-white">Pre-session Checklist</h2>
              </div>
              
              <div className="space-y-6 pl-1">
                <CustomCheckbox
                  id="audio"
                  title="Audio Output"
                  description="Wear headphones to prevent echo and hear questions clearly."
                  checked={checks.audio}
                  onChange={() => toggleCheck("audio")}
                />
                <CustomCheckbox
                  id="environment"
                  title="Environment"
                  description="Find a quiet, well-lit room with a neutral background."
                  checked={checks.environment}
                  onChange={() => toggleCheck("environment")}
                />
                <CustomCheckbox
                  id="connectivity"
                  title="Connectivity"
                  description="Check your internet connection for a stable video stream."
                  checked={checks.connectivity}
                  onChange={() => toggleCheck("connectivity")}
                />
              </div>
            </CardContent>
          </Card>
  );
}
