"use client";

import { useState } from "react";
import { Button, Modal, Tooltip, message } from "antd";
import { CheckCircle, Copy, QrCode } from "@phosphor-icons/react";
import { QRCodeSVG } from "qrcode.react";

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
        title={<div style={{ fontWeight: 900 }}>QR-код класу</div>}
        open={open}
        onCancel={() => setOpen(false)}
        width={380}
        // Учні бачать проєктор, не лише QR: журнал за модалкою мусить бути
        // нечитабельним, не лише затемненим (9.13, живий фідбек) — самого
        // напівпрозорого чорного фону замало, текст/бали й далі проглядались.
        styles={{ mask: { backdropFilter: "blur(12px)" } }}
        footer={[
          <Button key="copy" icon={<Copy />} onClick={copyLink} className="btn-secondary">
            Копіювати посилання
          </Button>,
          <Button key="done" type="primary" icon={<CheckCircle />} onClick={() => setOpen(false)} className="btn-primary">
            Готово
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
          <p
            style={{
              marginTop: 16,
              wordBreak: "break-all",
              color: "var(--color-text-muted)",
              fontSize: "0.85rem",
              fontWeight: 600,
            }}
          >
            {link}
          </p>
          <p style={{ color: "var(--color-text-muted)", fontSize: "0.8rem" }}>
            Учень сканує камерою телефону й переходить на дашборд класу, там
            попросить власний PIN, як завжди.
          </p>
        </div>
      </Modal>
    </>
  );
}
