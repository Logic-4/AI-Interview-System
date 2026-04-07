import React from "react";
import { Mic } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

export function MicrophoneCheck() {
  return (
          <Card className="bg-[#12151C] border-white/5 shadow-xl hover:-translate-y-0" hoverEffect={false}>
            <CardContent className="p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2">
                  <Mic className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-bold text-white">Microphone Check</h2>
                </div>
                <Badge variant="soft" color="success" className="text-[10px] uppercase font-semibold px-3 py-1">
                  READY
                </Badge>
              </div>

              <div className="flex items-center gap-6 mb-6">
                <div className="w-14 h-14 rounded-full bg-[#181F38] flex items-center justify-center border border-[#1F2947]">
                  {/* Stylized waveform icon */}
                  <div className="flex items-center gap-1">
                    <div className="w-1 h-3 bg-primary rounded-full opacity-60" />
                    <div className="w-1 h-5 bg-primary rounded-full" />
                    <div className="w-1 h-3 bg-primary rounded-full opacity-60" />
                  </div>
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-text-muted font-medium">Input Level</span>
                    <span className="text-xs text-primary font-bold">Active</span>
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    {[...Array(11)].map((_, i) => (
                      <div
                        key={i}
                        className={cn(
                          "h-2 flex-1 rounded-full",
                          i < 3 ? "bg-[#181F38]" : i < 8 ? "bg-primary" : "bg-[#181F38]"
                        )}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="flex items-center w-full h-12 rounded-xl bg-[#1A1F29] border border-transparent px-4">
                  <Mic className="w-4 h-4 text-text-muted mr-3" />
                  <span className="text-sm text-text-secondary flex-1">Default - MacBook Pro Microphone</span>
                  <button className="text-sm font-bold text-primary hover:text-primary/80 transition-colors">
                    Change
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
  );
}
