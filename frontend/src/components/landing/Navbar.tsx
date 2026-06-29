import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Moon, Sun, ArrowRight } from "lucide-react";
import { Logo } from "./Logo";
import { useDispatch, useSelector } from "react-redux";
import { IRootState } from "@/store";
import { toggleTheme } from "@/store/themeConfigSlice";
import { Link } from "react-router-dom";

const links = [
  { href: "#features", label: "Features" },
  { href: "#capabilities", label: "Capabilities" },
  { href: "#how", label: "How it works" },
  { href: "#stats", label: "Results" },
];



export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string>("#top");

  const themeConfig = useSelector((state: IRootState) => state.themeConfig);
  const dispatch = useDispatch();
  const theme = themeConfig.theme;
  const toggle = () => dispatch(toggleTheme(theme === "dark" ? "light" : "dark"));

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Active section observer
  useEffect(() => {
    const ids = ["top", ...links.map((l) => l.href.slice(1)), "cta"];
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el);
    if (!elements.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(`#${visible.target.id}`);
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const handleNav = useCallback((e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    const id = href.replace("#", "");
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: "smooth" });
    history.replaceState(null, "", href);
    setOpen(false);
  }, []);

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled
          ? "backdrop-blur-xl bg-background/70 border-b border-border/60"
          : "bg-transparent"
      }`}
    >
      <nav className="mx-auto max-w-7xl px-5 sm:px-8 h-16 flex items-center justify-between">
        <a href="#top" onClick={(e) => handleNav(e, "#top")} className="flex items-center">
          <Logo />
        </a>

        <ul className="hidden md:flex items-center gap-1 p-1 rounded-full border border-border/60 bg-surface/60 backdrop-blur">
          {links.map((l) => {
            const isActive = active === l.href;
            return (
              <li key={l.href} className="relative">
                <a
                  href={l.href}
                  onClick={(e) => handleNav(e, l.href)}
                  className={`relative z-10 px-4 py-1.5 text-sm font-medium rounded-full transition-colors ${
                    isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute inset-0 rounded-full bg-accent/70 -z-10"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}
                  {l.label}
                </a>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-2">
          <Link
            to="/login"
            className="hidden sm:inline-flex items-center text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors mr-3"
          >
            Login
          </Link>

          <button
            onClick={toggle}
            aria-label="Toggle theme"
            className="h-10 w-10 grid place-items-center rounded-full border border-border/60 bg-surface/60 hover:bg-accent/70 transition-all hover:scale-105"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={theme}
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {theme === "dark" ? <Sun className="h-4 w-4 text-warning" /> : <Moon className="h-4 w-4 text-primary" />}
              </motion.span>
            </AnimatePresence>
          </button>

          <Link
            to="/login"
            className="hidden sm:inline-flex items-center gap-1.5 h-10 px-5 rounded-full bg-gradient-primary text-primary-foreground text-sm font-semibold shadow-glow hover:shadow-elegant hover:-translate-y-0.5 transition-all"
          >
            Get started <ArrowRight className="h-3.5 w-3.5" />
          </Link>

          <button
            onClick={() => setOpen((v) => !v)}
            className="md:hidden h-10 w-10 grid place-items-center rounded-full border border-border/60"
            aria-label="Menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden overflow-hidden bg-background/95 backdrop-blur-xl border-b border-border"
          >
            <ul className="px-6 py-4 flex flex-col gap-1">
              {links.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    onClick={(e) => handleNav(e, l.href)}
                    className="block py-2.5 text-base font-medium text-foreground/90 hover:text-primary"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
              <Link
                to="/login"
                className="mt-2 inline-flex items-center justify-center h-11 rounded-full bg-gradient-primary text-primary-foreground font-semibold"
              >
                Get started
              </Link>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
