import type { ThemeConfig } from "antd";

const theme: ThemeConfig = {
  token: {
    colorPrimary: "#f5a623",
    colorSuccess: "#52c41a",
    colorWarning: "#faad14",
    colorError: "#ff4d4f",
    colorInfo: "#1890ff",
    borderRadius: 12,
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    colorBgBase: "#0f0e1a",
    colorTextBase: "#f0f0f0",
    colorBgContainer: "#1a1830",
    colorBgElevated: "#231f3a",
    colorBorder: "#2e2a4a",
    colorBorderSecondary: "#1e1b35",
  },
  components: {
    Card: {
      colorBgContainer: "#1a1830",
      borderRadiusLG: 16,
    },
    Button: {
      borderRadius: 10,
      fontWeight: 600,
    },
    Progress: {
      colorText: "#f0f0f0",
    },
    Statistic: {
      colorTextDescription: "#8b87aa",
    },
    Table: {
      colorBgContainer: "#1a1830",
      headerBg: "#231f3a",
    },
  },
};

export default theme;
