import Link from "next/link";
import StarIcon from "@/components/StarIcon";

/**
 * Спільна обгортка екранів входу, реєстрації й скидання пароля.
 *
 * До цього кожен із них малював шапку по-своєму: різні розміри логотипа,
 * градієнтний текст «StarBoard» із золотим переливом, різні відступи, а
 * кнопки були помаранчевими градієнтами, яких більше немає ніде в
 * продукті (живий фідбек). Тепер шапка одна, логотип клікабельний і веде
 * на головну, а кнопки всередині форм беруть звичайні .btn-primary /
 * .btn-secondary.
 */
export default function AuthShell({
  title,
  subtitle,
  children,
  width = 420,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  width?: number;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div style={{ width: "100%", maxWidth: width }}>
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <Link
            href="/"
            aria-label="StarBoard, на головну"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              color: "var(--color-text)",
              textDecoration: "none",
            }}
          >
            <StarIcon size="1.6rem" />
            <span style={{ fontSize: "1.1rem", fontWeight: 900, textTransform: "uppercase" }}>
              StarBoard
            </span>
          </Link>

          <h1
            style={{
              fontSize: "1.9rem",
              fontWeight: 900,
              margin: "12px 0 0",
              textTransform: "uppercase",
              letterSpacing: "-0.5px",
              lineHeight: 1.1,
            }}
          >
            {title}
          </h1>

          {subtitle && (
            <p style={{ margin: "6px 0 0", color: "var(--color-text-muted)", fontWeight: 600 }}>
              {subtitle}
            </p>
          )}
        </div>

        <div className="star-card">{children}</div>
      </div>
    </div>
  );
}
