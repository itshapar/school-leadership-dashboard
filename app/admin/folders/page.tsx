import FoldersClient from "@/components/Admin/FoldersClient";

export const dynamic = "force-dynamic";

export default function FoldersPage() {
  return (
    <div style={{ background: "#f8f9fa", minHeight: "100vh" }}>
      <FoldersClient />
    </div>
  );
}
