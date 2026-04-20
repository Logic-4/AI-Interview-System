"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import {
  User,
  Lock,
  Bell,
  Palette,
  Camera,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Shield,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import userService from "@/services/userService";
import api from "@/services/api";

type Tab = "profile" | "security" | "preferences";

export default function SettingsPage() {
  const { user, setUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>("profile");

  // Profile state
  const [name, setName] = useState(user?.name ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [targetRole, setTargetRole] = useState(user?.targetRole ?? "");
  const [experienceLevel, setExperienceLevel] = useState<string>(user?.experienceLevel ?? "");
  const [skills, setSkills] = useState(user?.skills?.join(", ") ?? "");
  const [saving, setSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Avatar
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.name ?? "");
      setBio(user.bio ?? "");
      setTargetRole(user.targetRole ?? "");
      setExperienceLevel(user.experienceLevel ?? "");
      setSkills(user.skills?.join(", ") ?? "");
    }
  }, [user]);

  const handleSaveProfile = async () => {
    setSaving(true);
    setProfileMsg(null);
    try {
      const updated = await userService.updateProfile({
        name: name.trim(),
        bio: bio.trim(),
        targetRole: targetRole.trim(),
        experienceLevel: experienceLevel || undefined,
        skills: skills.split(",").map((s) => s.trim()).filter(Boolean),
      });
      setUser(updated);
      setProfileMsg({ type: "success", text: "Profile updated successfully." });
    } catch {
      setProfileMsg({ type: "error", text: "Failed to update profile." });
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const updated = await userService.updateAvatar(file);
      setUser(updated);
    } catch {
      setProfileMsg({ type: "error", text: "Failed to upload avatar." });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleChangePassword = async () => {
    setPwMsg(null);
    if (newPassword.length < 8) {
      setPwMsg({ type: "error", text: "Password must be at least 8 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMsg({ type: "error", text: "Passwords do not match." });
      return;
    }
    setChangingPw(true);
    try {
      await api.put("/users/profile", { currentPassword, newPassword });
      setPwMsg({ type: "success", text: "Password changed successfully." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setPwMsg({ type: "error", text: "Failed to change password. Check your current password." });
    } finally {
      setChangingPw(false);
    }
  };

  const fallbackAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user?.name ?? "user")}`;
  const avatarSrc = user?.avatar || fallbackAvatar;

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "profile", label: "Profile", icon: User },
    { id: "security", label: "Security", icon: Lock },
    { id: "preferences", label: "Preferences", icon: Palette },
  ];

  return (
    <div className="max-w-4xl mx-auto py-6 space-y-6 animate-in fade-in duration-500">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Settings</h1>
        <p className="text-sm text-text-muted font-medium">Manage your account and preferences</p>
      </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-1 p-1 bg-foreground/[0.03] border border-border/40 rounded-xl w-fit">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all",
                activeTab === tab.id
                  ? "bg-primary text-white shadow-lg shadow-primary/20"
                  : "text-text-muted hover:text-text-primary hover:bg-foreground/[0.04]"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Profile Tab */}
      {activeTab === "profile" && (
        <div className="space-y-5">
          {/* Avatar */}
          <Card hoverEffect={false} className="p-6 border-border/40 bg-surface/30">
            <div className="flex items-center gap-5">
              <div className="relative group">
                <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-border/40 bg-foreground/5">
                  <Image src={avatarSrc} alt="Avatar" width={80} height={80} className="w-full h-full object-cover" />
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {uploadingAvatar ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Camera className="w-5 h-5 text-white" />}
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">{user?.name ?? "User"}</p>
                <p className="text-xs text-text-muted font-medium">{user?.email}</p>
                <Badge className="mt-2 bg-primary/10 text-primary border-primary/20 text-[9px] font-bold uppercase tracking-widest">
                  {user?.subscription?.plan ?? "free"} plan
                </Badge>
              </div>
            </div>
          </Card>

          {/* Profile Fields */}
          <Card hoverEffect={false} className="p-6 border-border/40 bg-surface/30 space-y-5">
            <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
              <User className="w-4 h-4 text-primary" /> Profile Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-border/40 bg-foreground/[0.03] text-sm text-text-primary font-medium focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Target Role</label>
                <input
                  type="text"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  placeholder="e.g. Senior Frontend Engineer"
                  className="w-full h-10 px-3 rounded-lg border border-border/40 bg-foreground/[0.03] text-sm text-text-primary font-medium placeholder:text-text-muted/40 focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Experience Level</label>
                <select
                  value={experienceLevel}
                  onChange={(e) => setExperienceLevel(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-border/40 bg-foreground/[0.03] text-sm text-text-primary font-medium focus:outline-none focus:border-primary/50 transition-colors"
                >
                  <option value="">Select level</option>
                  <option value="junior">Junior</option>
                  <option value="mid">Mid-Level</option>
                  <option value="senior">Senior</option>
                  <option value="lead">Lead</option>
                  <option value="principal">Principal</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Skills (comma-separated)</label>
                <input
                  type="text"
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  placeholder="React, TypeScript, Node.js"
                  className="w-full h-10 px-3 rounded-lg border border-border/40 bg-foreground/[0.03] text-sm text-text-primary font-medium placeholder:text-text-muted/40 focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                placeholder="Tell us about yourself..."
                className="w-full px-3 py-2 rounded-lg border border-border/40 bg-foreground/[0.03] text-sm text-text-primary font-medium placeholder:text-text-muted/40 focus:outline-none focus:border-primary/50 transition-colors resize-none"
              />
            </div>

            {profileMsg && (
              <div className={cn(
                "flex items-center gap-2 p-3 rounded-lg text-xs font-medium",
                profileMsg.type === "success" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
              )}>
                {profileMsg.type === "success" ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                {profileMsg.text}
              </div>
            )}

            <Button onClick={handleSaveProfile} isLoading={saving} className="h-10 px-6 rounded-lg text-xs font-bold">
              <Save className="w-3.5 h-3.5 mr-2" /> Save Changes
            </Button>
          </Card>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === "security" && (
        <div className="space-y-5">
          <Card hoverEffect={false} className="p-6 border-border/40 bg-surface/30 space-y-5">
            <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" /> Change Password
            </h3>
            <div className="space-y-4 max-w-md">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrent ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full h-10 px-3 pr-10 rounded-lg border border-border/40 bg-foreground/[0.03] text-sm text-text-primary font-medium focus:outline-none focus:border-primary/50 transition-colors"
                  />
                  <button onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
                    {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">New Password</label>
                <div className="relative">
                  <input
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full h-10 px-3 pr-10 rounded-lg border border-border/40 bg-foreground/[0.03] text-sm text-text-primary font-medium focus:outline-none focus:border-primary/50 transition-colors"
                  />
                  <button onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-border/40 bg-foreground/[0.03] text-sm text-text-primary font-medium focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>

              {pwMsg && (
                <div className={cn(
                  "flex items-center gap-2 p-3 rounded-lg text-xs font-medium",
                  pwMsg.type === "success" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
                )}>
                  {pwMsg.type === "success" ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                  {pwMsg.text}
                </div>
              )}

              <Button
                onClick={handleChangePassword}
                isLoading={changingPw}
                disabled={!currentPassword || !newPassword || !confirmPassword}
                className="h-10 px-6 rounded-lg text-xs font-bold"
              >
                <Lock className="w-3.5 h-3.5 mr-2" /> Update Password
              </Button>
            </div>
          </Card>

          {/* Danger Zone */}
          <Card hoverEffect={false} className="p-6 border-danger/20 bg-danger/5 space-y-4">
            <h3 className="text-sm font-bold text-danger flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> Danger Zone
            </h3>
            <p className="text-xs text-text-muted font-medium">Once you delete your account, there is no going back. Please be certain.</p>
            <Button variant="danger" className="h-10 px-6 rounded-lg text-xs font-bold" disabled>
              <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Account
            </Button>
          </Card>
        </div>
      )}

      {/* Preferences Tab */}
      {activeTab === "preferences" && (
        <div className="space-y-5">
          <Card hoverEffect={false} className="p-6 border-border/40 bg-surface/30 space-y-5">
            <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" /> Notifications
            </h3>
            <div className="space-y-3">
              {[
                { label: "Email notifications for completed interviews", key: "email_completed" },
                { label: "Weekly progress summary", key: "email_weekly" },
                { label: "Study plan reminders", key: "email_study" },
              ].map((item) => (
                <label key={item.key} className="flex items-center justify-between p-3 rounded-xl bg-foreground/[0.03] border border-border/40 cursor-pointer group">
                  <span className="text-xs font-medium text-text-primary group-hover:text-primary transition-colors">{item.label}</span>
                  <div className="w-10 h-5 bg-foreground/10 rounded-full relative transition-colors peer-checked:bg-primary">
                    <input type="checkbox" defaultChecked className="peer sr-only" />
                    <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5 peer-checked:bg-primary" />
                  </div>
                </label>
              ))}
            </div>
          </Card>

          <Card hoverEffect={false} className="p-6 border-border/40 bg-surface/30 space-y-5">
            <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
              <Palette className="w-4 h-4 text-primary" /> Appearance
            </h3>
            <div className="flex items-center gap-3">
              {["System", "Light", "Dark"].map((theme) => (
                <button
                  key={theme}
                  className={cn(
                    "px-4 py-2.5 rounded-xl text-xs font-bold border transition-all",
                    theme === "System"
                      ? "bg-primary/10 text-primary border-primary/20"
                      : "bg-foreground/[0.03] text-text-muted border-border/40 hover:border-primary/30"
                  )}
                >
                  {theme}
                </button>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
