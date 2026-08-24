"use client";

import { useState } from "react";
import { Button } from "antd";
import { useRouter } from "next/navigation";

/** Вихід учня зі свого дашборда (стирає сесію в БД + cookie). */
export default function StudentLogoutButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onLogout() {
    setLoading(true);
    try {
      await fetch("/api/student/logout", { method: "POST" });
    } finally {
      router.refresh();
    }
  }

  return (
    <Button loading={loading} onClick={onLogout} className="btn-secondary">
      Вийти
    </Button>
  );
}
