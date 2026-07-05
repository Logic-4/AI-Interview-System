import { useEffect } from "react";
import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";
import { Capabilities } from "@/components/landing/Capabilities";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { CTA } from "@/components/landing/CTA";
import { Footer } from "@/components/landing/Footer";

export default function LandingPage() {
    useEffect(() => {
        const html = document.documentElement;
        html.style.scrollBehavior = "smooth";
        html.style.scrollPaddingTop = "5rem";

        return () => {
            html.style.scrollBehavior = "";
            html.style.scrollPaddingTop = "";
        };
    }, []);

    return (
        <div className="landing-page-container min-h-screen bg-background text-foreground antialiased overflow-x-clip">
            <Navbar />
            <main>
                <Hero />
                <Features />
                <Capabilities />
                <HowItWorks />
                <CTA />
            </main>
            <Footer />
        </div>
    );
}
