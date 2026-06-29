import React from "react";
import { Navigate } from "react-router-dom";

export default function GuestRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("accessToken");

  if (token) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
