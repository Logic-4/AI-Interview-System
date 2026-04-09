import React from "react";

export function QuestionDisplay() {
  return (
        <div className="text-center w-full max-w-3xl">
           <div className="inline-flex items-center justify-center bg-[#131A2D] text-primary text-[10px] uppercase font-semibold tracking-widest px-4 py-1.5 rounded-full mb-6 mt-2">
              Current Question
           </div>
           
           <h2 className="text-[32px] sm:text-4xl leading-tight font-semibold text-white tracking-tight mb-6 px-4">
             &quot;Can you describe a time when you had to handle a difficult conflict within a team?&quot;
           </h2>
           
           <p className="text-[#8B949E] text-sm md:text-[15px] font-medium leading-relaxed max-w-xl mx-auto">
             Take a moment to collect your thoughts. We use the STAR method to evaluate your responses.
           </p>
        </div>
  );
}
