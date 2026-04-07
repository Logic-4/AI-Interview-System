"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  Bot,
  Mic,
  Video,
  Zap,
  BarChart3,
  ShieldCheck,
  MessageSquare,
  ChevronRight,
  Play,
  ArrowRight,
  CheckCircle2,
  Users
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { cn } from "@/lib/utils";
import { Variants } from "framer-motion";

export default function LandingPage() {
  const [isPlaying, setIsPlaying] = React.useState(false);

  const handlePlay = () => {
    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(
      "Hello! I am your AI Interviewer. I'm here to help you practice and perfect your interview skills with real-time feedback. Let's start the session."
    );

    // Find a professional female voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.name.includes("Samantha") || v.name.includes("Female") || v.name.includes("Google US English"));
    if (preferredVoice) utterance.voice = preferredVoice;

    utterance.rate = 1;
    utterance.pitch = 1.05;

    utterance.onstart = () => setIsPlaying(true);
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);

    window.speechSynthesis.speak(utterance);
  };

  React.useEffect(() => {
    return () => window.speechSynthesis.cancel();
  }, []);

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15, delayChildren: 0.3 }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: "spring", stiffness: 100, damping: 20 } as any
    }
  };

  return (
    <div className="min-h-screen bg-background text-text-primary selection:bg-primary selection:text-white">
      <Navbar />

      <main>
        {/* --- HERO SECTION --- */}
        <section className="relative pt-24 pb-32 overflow-hidden px-6 lg:px-8">
          {/* Background Glows */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-96 bg-primary/20 hover:bg-primary/30 blur-[150px] rounded-full transition-colors duration-1000" />

          <motion.div
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            className="mx-auto max-w-7xl text-center space-y-10"
          >
            <motion.div variants={itemVariants} className="flex justify-center">
              <Badge variant="soft" color="primary" className="py-2 px-4 rounded-full border border-primary/20 gap-2 font-semibold uppercase text-[10px] tracking-widest bg-primary/5">
                <span className="bg-primary/20 px-1.5 py-0.5 rounded-full text-primary">NEW</span>
                ✨ Powered by GPT-4 Vision & Voice
              </Badge>
            </motion.div>

            <motion.h1
              variants={itemVariants}
              className="text-6xl md:text-8xl font-semibold tracking-tighter leading-[0.9] md:leading-[1]"
            >
              Master Your Next <br />
              <span className="bg-clip-text text-transparent bg-gradient-primary">
                Interview with AI
              </span>
            </motion.h1>

            <motion.p
              variants={itemVariants}
              className="mx-auto max-w-2xl text-xl text-text-secondary leading-relaxed font-medium"
            >
              Practice with an industry-specific AI interviewer and receive instant,
              actionable feedback to land your dream job at top-tier companies.
            </motion.p>

            <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-4">
              <Button size="xl" variant="premium" className="group shadow-[0_0_30px_rgba(108,92,231,0.3)]">
                Start Practice Interview
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button
                size="xl"
                variant="outline"
                className="group text-text-primary px-8 border-white/10 hover:bg-white/5 active:scale-95 transition-transform"
                onClick={handlePlay}
              >
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center mr-3 group-hover:scale-110 transition-transform">
                  <Play className={cn("w-3.5 h-3.5 text-white", isPlaying ? "fill-white" : "fill-white")} />
                </div>
                {isPlaying ? "Stop Introduction" : "View Demo Video"}
              </Button>
            </motion.div>

            {/* Hero Mockup */}
            <motion.div
              variants={itemVariants}
              className="mx-auto max-w-5xl mt-24 relative group"
            >
              <div className="absolute -inset-1 bg-gradient-primary rounded-[2.5rem] blur-2xl opacity-20 group-hover:opacity-30 transition-opacity" />
              <div className="relative glass-effect rounded-[2.2rem] p-2 md:p-4 overflow-hidden shadow-2xl">
                <div className="relative aspect-video rounded-3xl overflow-hidden border border-white/5 bg-surface-2 shadow-inner">
                  {/* Simplified UI Mockup */}
                  <div className="absolute inset-0 bg-[#0A0A0F] flex flex-col">
                    <div className="absolute top-6 left-1/2 -translate-x-1/2 flex gap-4 items-center">
                      <Badge variant="soft" color="success" className="animate-pulse">● LIVE SESSION</Badge>
                      <span className="text-sm font-bold text-white uppercase tracking-widest opacity-60">Architectural Designer Role</span>
                    </div>

                    <div
                      className="flex-1 flex items-center justify-center relative bg-surface-2 cursor-pointer group"
                      onClick={handlePlay}
                    >
                      <motion.div
                        animate={{
                          scale: isPlaying ? [1.02, 1.05, 1.02] : [1, 1.02, 1],
                          opacity: isPlaying ? [1, 0.9, 1] : [0.8, 1, 0.8]
                        }}
                        transition={{ duration: isPlaying ? 0.5 : 4, repeat: Infinity }}
                        className="absolute inset-0 bg-cover bg-center"
                        style={{ backgroundImage: "url('/assets/cartoon-interviewer.png')" }}
                      />
                      <div className={cn(
                        "absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px]",
                        isPlaying && "opacity-0 group-hover:opacity-0"
                      )}>
                        <div className="w-20 h-20 rounded-full bg-primary/20 backdrop-blur-md flex items-center justify-center border border-primary/30 text-white shadow-2xl">
                          <Play className="w-8 h-8 fill-current" />
                        </div>
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-3/4 h-24 bg-surface/40 backdrop-blur-md rounded-2xl border border-white/10 flex items-center justify-center overflow-hidden">
                        {/* Mock Waveform */}
                        <div className="flex items-end gap-1 px-8 w-full justify-between">
                          {[...Array(30)].map((_, i) => (
                            <motion.div
                              key={i}
                              animate={{
                                height: isPlaying
                                  ? [10, 20 + Math.random() * 40, 10]
                                  : [10, 10 + Math.sin(i * 0.5) * 15 + 10, 10]
                              }}
                              transition={{
                                duration: isPlaying ? 0.2 : 2,
                                repeat: Infinity,
                                delay: i * 0.05
                              }}
                              className={cn(
                                "w-2 rounded-full transition-colors",
                                isPlaying ? "bg-primary shadow-[0_0_15px_rgba(108,92,231,0.5)]" : "bg-primary/40"
                              )}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="h-20 bg-black/40 backdrop-blur-3xl border-t border-white/5 p-6 flex items-center justify-between">
                      <div className="flex gap-4">
                        <div className="bg-primary/20 p-2.5 rounded-xl border border-primary/30">
                          <Mic className="w-5 h-5 text-primary" />
                        </div>
                        <div className="text-left">
                          <p className="text-[10px] font-semibold uppercase tracking-tighter text-text-muted">Audio Input</p>
                          <p className="text-xs font-bold text-white">Shure MV7 Dynamic</p>
                        </div>
                      </div>
                      <div className="flex gap-6 items-center">
                        <span className="text-xs font-bold text-text-muted">02:45 / 15:00</span>
                        <div className="h-1.5 w-64 bg-white/10 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: "25%" }}
                            className="h-full bg-gradient-primary"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </section>

        {/* --- LOGO BAR --- */}
        <section className="py-20 border-y border-white/5 bg-surface/30 px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <h2 className="text-center text-xs font-semibold uppercase tracking-[0.3em] text-text-muted mb-12 opacity-80">
              Helping Candidates Land Roles At
            </h2>
            <div className="flex flex-wrap justify-center gap-x-12 gap-y-10 opacity-40 grayscale hover:grayscale-0 transition-all">
              {["Google", "Meta", "Stripe", "Netflix", "Airbnb"].map((logo) => (
                <span key={logo} className="text-2xl font-semibold tracking-tighter text-text-primary hover:text-primary cursor-default">{logo}</span>
              ))}
            </div>
          </div>
        </section>

        {/* --- FEATURES SECTION --- */}
        <section id="features" className="py-32 px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="text-left mb-20 space-y-4">
              <h2 className="text-4xl md:text-5xl font-semibold tracking-tighter">
                Engineered for <span className="text-primary">Career Growth</span>
              </h2>
              <p className="max-w-xl text-lg text-text-muted font-medium leading-relaxed">
                Our platform provides a realistic interview environment powered by
                advanced LLMs to help you succeed.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  title: "Live AI Interviewer",
                  desc: "Engage in real-time voice or text conversations with an AI that adapts to your seniority, role, and company target.",
                  icon: Mic,
                  color: "primary"
                },
                {
                  title: "Instant Feedback",
                  desc: "Receive a detailed breakdown of your answers, body language, and communication style immediately after each session.",
                  icon: Zap,
                  color: "success"
                },
                {
                  title: "Performance Analytics",
                  desc: "Track your progress over time with data-driven insights and benchmark your performance against industry standards.",
                  icon: BarChart3,
                  color: "secondary"
                }
              ].map((feature, i) => (
                <Card key={i} variant="elevated" className="border-white/5 bg-surface-2 group hover:bg-surface-3 transition-colors">
                  <CardHeader className="p-8">
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center mb-6 ring-1 ring-inset",
                      `bg-${feature.color}/10 text-${feature.color} ring-${feature.color}/20`
                    )}>
                      <feature.icon className="w-6 h-6" />
                    </div>
                    <CardTitle className="text-2xl font-bold mb-4">{feature.title}</CardTitle>
                    <CardDescription className="text-base leading-relaxed text-text-muted font-medium">
                      {feature.desc}
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* --- STATS SECTION --- */}
        <section className="py-32 border-t border-white/5 bg-surface/20 px-6 lg:px-8 overflow-hidden relative">
          {/* Subtle Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-secondary/5 blur-[120px] rounded-full pointer-events-none" />

          <div className="mx-auto max-w-7xl grid grid-cols-1 md:grid-cols-3 gap-16 text-center relative z-10">
            <div className="space-y-2">
              <h3 className="text-6xl font-semibold tracking-tighter text-primary">100k+</h3>
              <p className="text-sm font-bold uppercase tracking-widest text-text-muted">Interviews Conducted</p>
            </div>
            <div className="space-y-2">
              <h3 className="text-6xl font-semibold tracking-tighter text-primary">92%</h3>
              <p className="text-sm font-bold uppercase tracking-widest text-text-muted">Success Rate</p>
            </div>
            <div className="space-y-2">
              <h3 className="text-6xl font-semibold tracking-tighter text-primary">4.9/5</h3>
              <p className="text-sm font-bold uppercase tracking-widest text-text-muted">User Satisfaction</p>
            </div>
          </div>
        </section>

        {/* --- CTA SECTION --- */}
        <section className="py-24 px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="relative overflow-hidden rounded-[3rem] p-12 md:p-24 bg-gradient-primary-to-blue shadow-2xl shadow-primary/20">
              {/* Grid Pattern Overlay */}
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.2)_1px,transparent_0)] bg-[size:32px_32px]" />

              <div className="relative z-10 text-center max-w-3xl mx-auto space-y-10">
                <h2 className="text-4xl md:text-6xl font-semibold tracking-tight text-white leading-tight">
                  Ready to Ace Your Interview?
                </h2>
                <p className="text-xl text-white/80 font-medium">
                  Join thousands of successful candidates who used our AI to secure their dream roles.
                  Start your free trial today.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                  <Button size="xl" className="bg-white text-primary hover:bg-white/90 px-10 font-semibold shadow-xl">
                    Get Started for Free
                  </Button>
                  <Button size="xl" variant="outline" className="border-white/30 text-white hover:bg-white/10 px-10 font-semibold">
                    View Pricing Plans
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
