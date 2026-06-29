import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="relative border-t border-border bg-surface/60">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-12 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-col items-center md:items-start gap-2">
          <Logo />
          <p className="text-xs text-muted-foreground">Master your next interview, with AI on your side.</p>
        </div>
        <nav className="flex items-center gap-6 text-sm text-muted-foreground">
          <a href="#features" className="hover:text-foreground transition">Features</a>
          <a href="#how" className="hover:text-foreground transition">How it works</a>
          <a href="#stats" className="hover:text-foreground transition">Results</a>
        </nav>
        <p className="text-xs text-muted-foreground">© 2026 InterviewAI Pro · All rights reserved.</p>
      </div>
    </footer>
  );
}
