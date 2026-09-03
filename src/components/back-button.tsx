"use client";

import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BackButton() {
  const router = useRouter();

  return (
    <Button type="button" variant="ghost" size="sm" onClick={() => router.back()} className="mb-3">
      <ArrowLeftIcon /> Back
    </Button>
  );
}
