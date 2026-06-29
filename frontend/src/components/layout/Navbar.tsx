import { Link, useNavigate } from 'react-router-dom';
import { Bot, ChevronDown } from 'lucide-react';
import { Button } from '../ui/Button';
import ThemeToggle from './ThemeToggle';

const Navbar = () => {
  const navigate = useNavigate();

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-white-light dark:border-[#1b2e4b] bg-white/60 dark:bg-black/60 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2 group">
            <img src="/ai-interview-logo.svg" alt="InterviewAI Logo" className="h-12 w-auto object-contain transition-transform duration-300 group-hover:scale-105" />
          </Link>
          
          <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-text-muted transition-colors">
            <a href="#features" className="hover:text-text-primary">Features</a>
            <a href="#pricing" className="hover:text-text-primary">Pricing</a>
            <div className="flex items-center gap-1 cursor-pointer hover:text-text-primary group/nav">
              <span>Solutions</span>
              <ChevronDown className="w-4 h-4 group-hover/nav:translate-y-0.5 transition-transform" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Link to="/login" className="hidden sm:block text-sm font-bold text-text-secondary hover:text-text-primary transition-colors">
            Log In
          </Link>
          <Button
            variant="primary"
            size="sm"
            className="px-5 font-semibold text-xs uppercase tracking-wider"
            onClick={() => navigate("/register")}
          >
            Get Started
          </Button>
        </div>
      </div>
    </nav>
  );
};

export { Navbar };
