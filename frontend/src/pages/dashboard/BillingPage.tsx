import React from "react";
import {
  CreditCard,
  CheckCircle2,
  Zap,
  Crown,
  Shield,
  Star,
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { cn } from "../../lib/utils";
import { useAuthStore } from "../../stores/authStore";

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    icon: Zap,
    color: "text-text-muted",
    borderColor: "border-white-light dark:border-[#1b2e4b]",
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
    <div className="max-w-5xl mx-auto py-6 space-y-6 animate-in fade-in duration-500 text-black dark:text-white-dark">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-text-primary dark:text-white">Billing & Subscription</h1>
        <p className="text-sm text-text-muted font-semibold">Manage your subscription plan</p>
      </div>

      {/* Current Plan */}
      <Card hoverEffect={false} className="p-6 border border-primary/20 bg-primary/5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-text-primary dark:text-white">Current Plan: <span className="capitalize">{currentPlan}</span></p>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={cn(
                  "text-[8px] font-bold uppercase tracking-widest",
                  planStatus === "active" ? "bg-success/10 text-success border-success/20" : "bg-danger/10 text-danger border-danger/20"
                )}>
                  {planStatus}
                </Badge>
                {expiresAt && (
                  <span className="text-[10px] text-text-muted font-semibold">
                    Renews {new Date(expiresAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          </div>
          {currentPlan !== "free" && (
            <Button variant="outline" className="h-9 px-4 rounded-md text-xs font-bold text-text-primary dark:text-white border-white-light dark:border-[#1b2e4b]" disabled>
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
              hoverEffect={false}
              className={cn(
                "p-6 bg-white dark:bg-black relative overflow-hidden border",
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
                <div className={cn("w-10 h-10 rounded-md flex items-center justify-center",
                  plan.id === "pro" ? "bg-primary/10" : plan.id === "enterprise" ? "bg-warning/10" : "bg-white-light dark:bg-[#1b2e4b]"
                )}>
                  <Icon className={cn("w-5 h-5", plan.color)} />
                </div>
                <div>
                  <p className="text-sm font-bold text-text-primary dark:text-white">{plan.name}</p>
                  <p className="text-xs text-text-muted font-semibold">
                    <span className="text-lg font-bold text-text-primary dark:text-white">{plan.price}</span>
                    {plan.period}
                  </p>
                </div>
              </div>

              <ul className="space-y-2.5 mb-6">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-text-muted font-semibold">
                    <CheckCircle2 className={cn("w-3.5 h-3.5 flex-shrink-0 mt-0.5",
                      plan.id === "pro" ? "text-primary" : plan.id === "enterprise" ? "text-warning" : "text-success"
                    )} />
                    {f}
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <Button variant="outline" className="w-full h-10 rounded-md text-xs font-bold text-text-primary dark:text-white border-white-light dark:border-[#1b2e4b]" disabled>
                  Current Plan
                </Button>
              ) : (
                <Button
                  variant={plan.id === "pro" ? "primary" : "outline"}
                  className={cn(
                    "w-full h-10 rounded-md text-xs font-bold",
                    plan.id === "pro" ? "shadow-lg shadow-primary/20 text-white" : "text-text-primary dark:text-white border-white-light dark:border-[#1b2e4b]"
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
      <Card hoverEffect={false} className="p-6 border border-white-light dark:border-[#1b2e4b] bg-white dark:bg-black text-center">
        <CreditCard className="w-10 h-10 text-text-muted/20 mx-auto mb-3" />
        <h3 className="text-sm font-bold text-text-primary dark:text-white mb-1">Payment Integration Coming Soon</h3>
        <p className="text-xs text-text-muted font-semibold max-w-sm mx-auto">
          Stripe payment processing will be integrated shortly. For now, enjoy the Free plan with full features.
        </p>
      </Card>
    </div>
  );
}
