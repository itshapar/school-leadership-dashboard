"use client";

import { ConfigProvider } from "antd";
import useIllustrationTheme from "@/lib/hooks/useIllustrationTheme";

export default function AntdProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const configProps = useIllustrationTheme();

  return <ConfigProvider {...configProps}>{children}</ConfigProvider>;
}
