"use client";

import { useState } from "react";
import { Button, Modal, Tooltip, message } from "antd";
import { Copy, QrCode } from "@phosphor-icons/react";
import { QRCodeSVG } from "qrcode.react";
import Link from "next/link";

/**
 * QR-код на дашборд класу (Етап 9.9, живий фідбек): вчитель виводить
 * екран на проєктор, учні сканують і одразу переходять по посиланню
 * (там же попросить власний PIN — сам QR ніякого доступу не дає).
 */
export default function ClassQrButton({
  classCode,
  iconButtonStyle,
}: {
  classCode: string;
  iconButtonStyle: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const link = typeof window !== "undefined" ? `${window.location.origin}/class/${classCode}` : "";

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      message.success("Посилання скопійовано");
    } catch {
      message.error("Не вдалося скопіювати");
    }
  }

  return (
    <>
      <Tooltip title="QR-КОД КЛАСУ">
        <Button
          size="middle"
          icon={<QrCode />}
          onClick={() => setOpen(true)}
          style={{
            ...iconButtonStyle,
            background: "#000",
            color: "#fff",
            border: "2px solid #000",
            boxShadow: "3px 3px 0px rgba(0,0,0,0.2)",
          }}
        />
      </Tooltip>

      <Modal
        title={<div style={{ fontWeight: 900, textTransform: "uppercase" }}>QR-код класу</div>}
        open={open}
        onCancel={() => setOpen(false)}
        width={380}
        // Учні бачать проєктор, не лише QR: журнал за модалкою мусить бути
        // нечитабельним, не лише затемненим (9.13, живий фідбек) — самого
        // напівпрозорого чорного фону замало, текст/бали й далі проглядались.
        styles={{ mask: { backdropFilter: "blur(12px)" } }}
        // Кнопки «Готово» немає (живий фідбек): модалку закриває хрестик,
        // окрема кнопка лише накладалась на «Копіювати посилання».
        footer={[
          <Button key="copy" icon={<Copy />} onClick={copyLink} className="btn-secondary">
            Копіювати посилання
          </Button>,
        ]}
      >
        <div style={{ textAlign: "center", padding: "12px 0" }}>
          <div
            style={{
              display: "inline-block",
              padding: 16,
              background: "#fff",
              border: "3px solid #000",
              borderRadius: 16,
            }}
          >
            {link && <QRCodeSVG value={link} size={220} />}
          </div>
          {/* Посилання клікабельне й підкреслене (живий фідбек): раніше це
              був звичайний текст, який доводилось виділяти мишею. */}
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "block",
              marginTop: 16,
              wordBreak: "break-all",
              color: "#000000",
              fontSize: "0.85rem",
              fontWeight: 600,
              textDecoration: "underline",
            }}
          >
            {link}
          </a>
          <p style={{ color: "var(--color-text-muted)", fontSize: "0.8rem", lineHeight: 1.6 }}>
            Учень сканує цей QR-код камерою телефону й потрапляє на дашборд
            класу. Далі сторінка попросить його власний PIN, взяти його можна
            у{" "}
            <Link
              href={`/admin/${classCode}/students`}
              style={{ color: "#000", fontWeight: 700, textDecoration: "underline" }}
            >
              списку учнів
            </Link>
            .
          </p>
        </div>
      </Modal>
    </>
  );
}
