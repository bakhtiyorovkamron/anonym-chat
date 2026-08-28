"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { getCsrfTokenFromCookie } from "@/lib/utils";

export function ReportStatusActions({ reportId }: { reportId: string }) {
  const [pending, startTransition] = useTransition();

  const setStatus = (status: string) => {
    startTransition(async () => {
      await fetch(`/api/admin/reports/${reportId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": getCsrfTokenFromCookie(),
        },
        body: JSON.stringify({ status }),
      });
      window.location.reload();
    });
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => setStatus("REVIEWING")}>
        Reviewing
      </Button>
      <Button size="sm" disabled={pending} onClick={() => setStatus("RESOLVED")}>
        Resolved
      </Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => setStatus("DISMISSED")}>
        Dismiss
      </Button>
    </div>
  );
}

export function BanActions({ userId, banned }: { userId: string; banned: boolean }) {
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    startTransition(async () => {
      await fetch(`/api/admin/users/${userId}/${banned ? "unban" : "ban"}`, {
        method: "POST",
        headers: {
          "x-csrf-token": getCsrfTokenFromCookie(),
        },
      });
      window.location.reload();
    });
  };

  return (
    <Button size="sm" variant={banned ? "secondary" : "danger"} disabled={pending} onClick={toggle}>
      {banned ? "Снять блок" : "Блокировать"}
    </Button>
  );
}
