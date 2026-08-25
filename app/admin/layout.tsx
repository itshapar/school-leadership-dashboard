/**
 * Білий фон для всього кабінету вчителя (живий фідбек) — кремовий
 * --bg-primary лишається для учнівських сторінок, тут навмисно білий,
 * щоб картки на ньому (border:#000) не зливались з фоном.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div style={{ background: "#fff", minHeight: "100%" }}>{children}</div>;
}
