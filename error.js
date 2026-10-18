"use client";
import { useEffect } from "react";
import { report } from "@/lib/monitor";

export default function Error({ error, reset }) {
  useEffect(() => { report(error); }, [error]);
  return (
    <div className="p-10 text-center">
      <p>حدث خطأ غير متوقع.</p>
      <button className="btn mt-4" onClick={reset}>إعادة المحاولة</button>
    </div>
  );
}
