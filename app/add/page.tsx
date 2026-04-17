"use client";

import { useRouter } from "next/navigation";
import { QuickAddForm } from "@/components/QuickAddForm";

export default function AddPage() {
  const router = useRouter();

  return (
    <div className="p-4">
      <h1 className="text-lg font-semibold mb-4 brand-title" style={{ color: "var(--ink)" }}>Add Sheet</h1>
      <QuickAddForm
        onCreated={id => router.push(`/library/${encodeURIComponent(id)}`)}
      />
    </div>
  );
}
