"use client";

import React from "react";
import {
  CreditCard,
  CheckCircle2,
  Zap,
  Crown,
  Shield,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    icon: Zap,
    color: "text-text-muted",
    borderColor: "border-border/40",
    features: [
      "10 interviews per month",
      "Basic AI feedback",
      "Text-based answers",
      "Question bank access",
      "Basic analytics",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$19",
    period: "/month",
    icon: Star,
    color: "text-primary",
    borderColor: "border-primary/40",
    popular: true,
    features: [
      "50 interviews per month",
      "Advanced AI feedback with recommendations",
      "Voice & text answers",
      "Full question bank",
      "Detailed analytics & progress tracking",
      "Custom study plans",
      "Priority support",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "$49",
    period: "/month",
    icon: Crown,
    color: "text-warning",
    borderColor: "border-warning/40",
    features: [
      "Unlimited interviews",
      "Premium AI models",
      "Voice & text answers",
      "Full question bank + custom questions",
      "Advanced analytics & team insights",
      "Custom study plans",
      "Dedicated support",
      "API access",
    ],
  },
];

export default function BillingPage() {
  const { user } = useAuthStore();
  const currentPlan = user?.subscription?.plan ?? "free";
  const planStatus = user?.subscription?.status ?? "active";
  const expiresAt = user?.subscription?.expiresAt;

  return (
    <div className="max-w-5xl mx-auto py-6 space-y-6 animate-in fade-in duration-500">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Billing & Subscription</h1>
        <p className="text-sm text-text-muted font-medium">Manage your subscription plan</p>
      </div>

      {/* Current Plan */}
      <Card hoverEffect={false} className="p-6 border-primary/20 bg-primary/5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">Current Plan: <span className="capitalize">{currentPlan}</span></p>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={cn(
                  "text-[8px] font-bold uppercase tracking-widest",
                  planStatus === "active" ? "bg-success/10 text-success border-success/20" : "bg-danger/10 text-danger border-danger/20"
                )}>
                  {planStatus}
                </Badge>
                {expiresAt && (
                  <span className="text-[10px] text-text-muted font-medium">
                    Renews {new Date(expiresAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          </div>
          {currentPlan !== "free" && (
            <Button variant="outline" className="h-9 px-4 rounded-lg text-xs font-bold text-text-primary border-border/40" disabled>
              <Shield className="w-3.5 h-3.5 mr-2" /> Manage Subscription
            </Button>
          )}
        </div>
      </Card>

      {/* Plans */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLANS.map((plan) => {
          const Icon = plan.icon;
          const isCurrent = currentPlan === plan.id;
          return (
            <Card
              key={plan.id}
              hoverEffect
              className={cn(
                "p-6 bg-surface/30 relative overflow-hidden",
                isCurrent ? "border-primary/40 ring-2 ring-primary/20" : plan.borderColor
              )}
            >
              {plan.popular && (
                <div className="absolute top-4 right-4">
                  <Badge className="bg-primary text-white text-[8px] font-bold uppercase tracking-widest border-none">
                    Popular
                  </Badge>
                </div>
              )}

              <div className="flex items-center gap-3 mb-4">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center",
                  plan.id === "pro" ? "bg-primary/10" : plan.id === "enterprise" ? "bg-warning/10" : "bg-foreground/5"
                )}>
                  <Icon className={cn("w-5 h-5", plan.color)} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">{plan.name}</p>
                  <p className="text-xs text-text-muted font-medium">
                    <span className="text-lg font-bold text-text-primary">{plan.price}</span>
                    {plan.period}
                  </p>
                </div>
              </div>

              <ul className="space-y-2.5 mb-6">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-text-muted font-medium">
                    <CheckCircle2 className={cn("w-3.5 h-3.5 flex-shrink-0 mt-0.5",
                      plan.id === "pro" ? "text-primary" : plan.id === "enterprise" ? "text-warning" : "text-success"
                    )} />
                    {f}
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <Button variant="outline" className="w-full h-10 rounded-lg text-xs font-bold text-text-primary border-border/40" disabled>
                  Current Plan
                </Button>
              ) : (
                <Button
                  variant={plan.id === "pro" ? "primary" : "outline"}
                  className={cn(
                    "w-full h-10 rounded-lg text-xs font-bold",
                    plan.id === "pro" ? "shadow-lg shadow-primary/20" : "text-text-primary border-border/40"
                  )}
                  disabled
                >
                  {currentPlan === "free" ? "Upgrade" : plan.id === "free" ? "Downgrade" : "Switch Plan"}
                </Button>
              )}
            </Card>
          );
        })}
      </div>

      {/* Payment coming soon notice */}
      <Card hoverEffect={false} className="p-6 border-border/40 bg-surface/30 text-center">
        <CreditCard className="w-10 h-10 text-text-muted/20 mx-auto mb-3" />
        <h3 className="text-sm font-semibold text-text-primary mb-1">Payment Integration Coming Soon</h3>
        <p className="text-xs text-text-muted font-medium max-w-sm mx-auto">
          Stripe payment processing will be integrated shortly. For now, enjoy the Free plan with full features.
        </p>
      </Card>
    </div>
  );
}
