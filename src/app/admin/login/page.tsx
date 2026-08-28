"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function AdminLoginPage() {
  const router = useRouter();
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret }),
    });

    if (!response.ok) {
      setError("Invalid secret");
      return;
    }

    router.push("/admin");
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4">
      <Card className="w-full">
        <h1 className="text-xl font-semibold">Admin login</h1>
        <Input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} className="mt-4" />
        {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
        <Button onClick={submit} className="mt-4 w-full">
          Войти
        </Button>
      </Card>
    </main>
  );
}
