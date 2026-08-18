"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface PickerStudent {
  id: string;
  display_name: string;
  avatar_emoji: string;
}

interface Props {
  classCode: string;
  className: string;
  students: PickerStudent[];
}

/**
 * Клієнтська частина сторінки «Це ти?».
 *
 * Раніше вся сторінка була client component і сама ходила в Supabase з
 * браузера під anon-ключем — тобто список учнів (разом із ПІБ) віддавався
 * прямо в мережу. Тепер дані приходять пропсами з сервера, і тут лишається
 * лише пошук, вибір та localStorage.
 */
export default function StudentPicker({ classCode, className, students }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [redirecting, setRedirecting] = useState(false);

  const storageKey = `starboard_student_${classCode}`;

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved && students.some((s) => s.id === saved)) {
      setRedirecting(true);
      router.replace(`/class/${classCode}/student/${saved}`);
    } else if (saved) {
      // Учня вже немає в класі — прибираємо застарілий вибір
      localStorage.removeItem(storageKey);
    }
  }, [storageKey, students, classCode, router]);

  function pick(studentId: string) {
    localStorage.setItem(storageKey, studentId);
    router.push(`/class/${classCode}/student/${studentId}`);
  }

  const q = search.trim().toLowerCase();
  const filtered = q
    ? students.filter((s) => s.display_name.toLowerCase().includes(q))
    : students;

  if (redirecting) {
    return (
      <div className="page-container" style={{ textAlign: "center", paddingTop: "80px" }}>
        <div style={{ fontSize: "3rem" }}>⏳</div>
        <p style={{ color: "var(--color-text-muted)", fontWeight: 700, marginTop: "16px" }}>
          Завантаження...
        </p>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div style={{ marginBottom: "12px" }}>
        <Link
          href={`/class/${classCode}`}
          style={{ color: "var(--color-text-muted)", fontSize: "0.9rem", fontWeight: 700 }}
        >
          ← {className}
        </Link>
      </div>

      <div className="page-header">
        <div style={{ fontSize: "3.5rem", marginBottom: "8px" }}>🎯</div>
        <h1>Це ти?</h1>
        <p className="subtitle">Обери себе зі списку</p>
      </div>

      <input
        type="text"
        placeholder="🔍 Пошук..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: "100%",
          padding: "14px 18px",
          background: "#FFFFFF",
          border: "var(--border-width) solid var(--color-border)",
          borderRadius: "14px",
          color: "var(--color-text)",
          fontSize: "1.1rem",
          fontWeight: 600,
          marginBottom: "20px",
          outline: "none",
          boxShadow: "3px 3px 0px var(--color-border)",
        }}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {filtered.map((student) => (
          <button
            key={student.id}
            onClick={() => pick(student.id)}
            className="leaderboard-row"
            style={{
              cursor: "pointer",
              textAlign: "left",
              width: "100%",
              padding: "14px 20px",
              margin: 0,
            }}
          >
            <span style={{ fontSize: "2rem", marginRight: "12px" }}>{student.avatar_emoji}</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: "1.05rem" }}>{student.display_name}</div>
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <div
            className="star-card"
            style={{
              textAlign: "center",
              color: "var(--color-text-muted)",
              padding: "40px",
              fontWeight: 700,
            }}
          >
            Нікого не знайдено 😕
          </div>
        )}
      </div>
    </div>
  );
}
