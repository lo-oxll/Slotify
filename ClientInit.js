"use client";
import { useEffect } from "react";
import { report } from "@/lib/monitor";

export default function ClientInit() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    const on = (e) => report(e.error || e.reason || e.message);
    window.addEventListener("error", on);
    window.addEventListener("unhandledrejection", on);
    return () => {
      window.removeEventListener("error", on);
      window.removeEventListener("unhandledrejection", on);
    };
  }, []);
  return null;
}
