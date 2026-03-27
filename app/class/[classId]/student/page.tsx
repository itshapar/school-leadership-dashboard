"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase/client";
import { resolveClassIdByCode } from "@/lib/classCodes";

interface Student {
  id: string;
  full_name: string;
  nickname: string | null;
  avatar_emoji: string;
}

export default function StudentPickerPage() {
  const params = useParams();
  const classParam = params.classId as string;
  const router = useRouter();

  const [students, setStudents] = useState<Student[]>([]);
  const [className, setClassName] = useState("");
  const [resolvedClassId, setResolvedClassId] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = getSupabaseClient();
      const isUuidLike = /^[0-9a-f-]{36}$/i.test(classParam);
      let resolvedClassId = classParam;
      if (!isUuidLike) {
        const { data: allClasses } = await supabase.from("classes").select("id");
        const byCode = resolveClassIdByCode(allClasses ?? [], classParam);
        if (byCode) resolvedClassId = byCode;
      }
      let cls = null;
      const { data: classRow } = await supabase
        .from("classes")
        .select("id, name")
        .eq("id", resolvedClassId)
        .maybeSingle();
      cls = classRow;
      if (cls) {
        setClassName(cls.name);
        setResolvedClassId(cls.id);
      }

      const { data: studentRows } = await supabase
        .from("students")
        .select("id, full_name, nickname, avatar_emoji")
        .eq("class_id", cls?.id ?? classParam)
        .order("full_name");
      setStudents(studentRows ?? []);
      setLoading(false);

      // Check localStorage for saved student
      const key = `starboard_student_${cls?.id ?? classParam}`;
      const saved = localStorage.getItem(key);
      if (saved) router.replace(`/class/${classParam}/student/${saved}`);
    }
    load();
  }, [classParam, router]);

  function pick(studentId: string) {
    localStorage.setItem(`starboard_student_${resolvedClassId || classParam}`, studentId);
    router.push(`/class/${classParam}/student/${studentId}`);
  }

  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.full_name.toLowerCase().includes(q) ||
      (s.nickname ?? "").toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="page-container" style={{ textAlign: "center", paddingTop: "80px" }}>
        <div style={{ fontSize: "3rem" }}>⏳</div>
        <p style={{ color: "var(--color-text-muted)", fontWeight: 700, marginTop: "16px" }}>Завантаження...</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div style={{ marginBottom: "12px" }}>
        <Link href={`/class/${classParam}`} style={{ color: "var(--color-text-muted)", fontSize: "0.9rem", fontWeight: 700 }}>
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
        {filtered.map((student) => {
          const displayName = student.nickname || student.full_name.split(" ")[0];
          return (
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
                <div style={{ fontWeight: 800, fontSize: "1.05rem" }}>{displayName}</div>
                {student.nickname && (
                  <div style={{ color: "var(--color-text-muted)", fontSize: "0.85rem", fontWeight: 600 }}>
                    {student.full_name}
                  </div>
                )}
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="star-card" style={{ textAlign: "center", color: "var(--color-text-muted)", padding: "40px", fontWeight: 700 }}>
            Нікого не знайдено 😕
          </div>
        )}
      </div>
    </div>
  );
}
