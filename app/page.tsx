import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TableOutlined } from "@ant-design/icons";
import Link from "next/link";
import { buildClassCodeMap } from "@/lib/classCodes";

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const { data: classes } = await supabase
    .from("classes")
    .select("id, name")
    .order("name");
  const classList = classes ?? [];
  const codeMap = buildClassCodeMap(classList);

  return (
    <div className="page-container" style={{ maxWidth: "800px" }}>
      <div className="page-header" style={{ marginBottom: "40px" }}>
        <h1 style={{ fontSize: "3rem", fontWeight: 900, letterSpacing: "-1px" }}>КЛАСИ</h1>
        <p className="subtitle" style={{ fontWeight: 700 }}>Оберіть свій навчальний простір</p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
          gap: "24px",
        }}
      >
        {classList.map((cls) => (
          <Link
            key={cls.id}
            href={`/class/${codeMap[cls.id]}`}
            style={{ textDecoration: "none" }}
          >
            <div className="star-card" style={{ 
              cursor: "pointer", 
              textAlign: "center", 
              padding: "40px 20px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "160px"
            }}>
              <div
                style={{
                  fontSize: "2.5rem",
                  fontWeight: 900,
                  color: "var(--color-text)",
                  textTransform: "uppercase",
                }}
              >
                {cls.name}
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div
        style={{
          textAlign: "center",
          marginTop: "80px",
          color: "var(--color-text-muted)",
          fontSize: "0.9rem",
          fontWeight: 700,
        }}
      >
        <Link href="/admin" style={{ color: "var(--color-text-muted)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "8px" }}>
          <TableOutlined /> ПАНЕЛЬ УПРАВЛІННЯ
        </Link>
      </div>
    </div>
  );
}
