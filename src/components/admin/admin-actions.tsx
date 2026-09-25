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
    if (!banned && !window.confirm("Заблокировать пользователя? Его активные чаты будут завершены.")) return;
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

export function DeleteUserAction({ userId, redirectTo }: { userId: string; redirectTo?: string }) {
  const [pending, startTransition] = useTransition();

  const remove = () => {
    if (!window.confirm("Удалить пользователя навсегда? Все его чаты, сообщения и жалобы будут удалены.")) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
        headers: { "x-csrf-token": getCsrfTokenFromCookie() },
      });
      if (!res.ok) {
        window.alert("Не удалось удалить пользователя");
        return;
      }
      if (redirectTo) window.location.href = redirectTo;
      else window.location.reload();
    });
  };

  return (
    <Button size="sm" variant="ghost" className="text-red-400" disabled={pending} onClick={remove}>
      Удалить
    </Button>
  );
}

export function UserActions({ userId, banned, redirectTo }: { userId: string; banned: boolean; redirectTo?: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <BanActions userId={userId} banned={banned} />
      <DeleteUserAction userId={userId} redirectTo={redirectTo} />
    </div>
  );
}
