export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center ${className}`}>
      <img
        src="/ai-interview-logo.svg"
        alt="InterviewAI Pro Logo"
        className="h-16 w-auto object-contain transition-transform duration-300 hover:scale-[1.03]"
      />
    </div>
  );
}
