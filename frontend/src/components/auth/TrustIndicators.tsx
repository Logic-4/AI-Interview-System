import React from "react";
import { Shield, Cpu } from "lucide-react";

export function TrustIndicators() {
  return (
        <div className="mt-8 flex items-center justify-center gap-6 z-10">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted opacity-60">
            <Shield className="w-3.5 h-3.5" />
            Secure SSL
          </div>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted opacity-60">
            <Cpu className="w-3.5 h-3.5" />
            AI Powered
          </div>
        </div>
  );
}
