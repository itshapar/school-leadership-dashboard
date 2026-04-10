"use client";

import { useState, useEffect } from "react";
import { Modal, InputNumber, Button, message, Space, Divider, Spin } from "antd";
import { getSupabaseClient } from "@/lib/supabase/client";
import { adminApiFetch } from "@/lib/admin/adminApiFetch";
import { SettingOutlined, TrophyOutlined, TeamOutlined } from "@ant-design/icons";

interface Prize {
  id: string;
  name: string;
  emoji: string;
  stars_required: number;
}

export default function RewardSettings({
  classId,
  visible,
  onClose,
  onSuccess,
}: {
  classId: string;
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [gameDay, setGameDay] = useState<number>(250);
  const [pizzaDay, setPizzaDay] = useState<number>(350);
  const [prizes, setPrizes] = useState<Prize[]>([]);

  const supabase = getSupabaseClient();

  useEffect(() => {
    if (visible) {
      loadData();
    }
  }, [visible]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [classRes, prizeRes] = await Promise.all([
        supabase.from("classes").select("game_day_threshold, pizza_day_threshold").eq("id", classId).single(),
        supabase.from("prizes_individual").select("id, name, emoji, stars_required").eq("class_id", classId).order("sort_order")
      ]);

      if (classRes.data) {
        setGameDay(classRes.data.game_day_threshold);
        setPizzaDay(classRes.data.pizza_day_threshold);
      }
      if (prizeRes.data) {
        setPrizes(prizeRes.data);
      }
    } catch (err) {
      console.error(err);
      message.error("Помилка завантаження налаштувань");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await adminApiFetch(supabase, "/api/admin/thresholds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          class_id: classId,
          game_day_threshold: gameDay,
          pizza_day_threshold: pizzaDay,
          individual_prizes: prizes.map(p => ({
            id: p.id,
            stars_required: p.stars_required
          }))
        })
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to save");
      }

      message.success("Налаштування збережено");
      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error(err);
      message.error(err.message || "Помилка збереження");
    } finally {
      setSaving(false);
    }
  };

  const updatePrizeThreshold = (id: string, val: number | null) => {
    if (val === null) return;
    setPrizes(prizes.map(p => p.id === id ? { ...p, stars_required: val } : p));
  };

  return (
    <Modal
      title={
        <div style={{ fontSize: "1.2rem", fontWeight: 900, textTransform: "uppercase", display: "flex", alignItems: "center", gap: "10px" }}>
          <SettingOutlined /> НАЛАШТУВАННЯ НАГОРОД
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose} style={{ borderRadius: "8px", fontWeight: 700 }}>
          СКАСУВАТИ
        </Button>,
        <Button 
          key="save" 
          type="primary" 
          loading={saving} 
          onClick={handleSave}
          style={{ 
            borderRadius: "8px", 
            fontWeight: 800, 
            background: "#000", 
            borderColor: "#000",
            boxShadow: "2px 2px 0px rgba(0,0,0,0.2)"
          }}
        >
          ЗБЕРЕГТИ
        </Button>
      ]}
      width={450}
    >
      {loading ? (
        <div style={{ padding: "40px", textAlign: "center" }}><Spin /></div>
      ) : (
        <div style={{ padding: "10px 0" }}>
          <div style={{ marginBottom: "20px" }}>
            <h3 style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "1rem", fontWeight: 900, textTransform: "uppercase", opacity: 0.7 }}>
              <TeamOutlined /> ЗАГАЛЬНІ ЦІЛІ (КЛАС)
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 700 }}>Ігровий день (Game Day):</span>
                <InputNumber 
                  min={1} 
                  value={gameDay} 
                  onChange={(v) => v !== null && setGameDay(v)} 
                  style={{ width: "100px", borderRadius: "6px" }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 700 }}>Піца день (Pizza Day):</span>
                <InputNumber 
                  min={1} 
                  value={pizzaDay} 
                  onChange={(v) => v !== null && setPizzaDay(v)} 
                  style={{ width: "100px", borderRadius: "6px" }}
                />
              </div>
            </div>
          </div>

          <Divider style={{ margin: "24px 0" }} />

          <div>
            <h3 style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "1rem", fontWeight: 900, textTransform: "uppercase", opacity: 0.7 }}>
              <TrophyOutlined /> ІНДИВІДУАЛЬНІ НАГОРОДИ
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "12px" }}>
              {prizes.map((prize) => (
                <div key={prize.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "1.2rem" }}>{prize.emoji}</span> {prize.name}:
                  </span>
                  <InputNumber 
                    min={1} 
                    value={prize.stars_required} 
                    onChange={(v) => updatePrizeThreshold(prize.id, v)} 
                    style={{ width: "100px", borderRadius: "6px" }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
