"use client";

import { useLanguage } from "@/context/LanguageContext";

const HELPUS_SITE_URL = "https://helpusbr.com";

export default function Footer() {
  const { t } = useLanguage();

  return (
    <footer
      style={{
        marginTop: 40,
        padding: 20,
        textAlign: "center",
        fontSize: 12,
        color: "#6b7280",
      }}
    >
      <a
        href={HELPUS_SITE_URL}
        target="_blank"
        rel="noreferrer"
        style={{
          color: "inherit",
          textDecoration: "none",
          fontWeight: 700,
        }}
      >
        © {new Date().getFullYear()} HelpUS
      </a>{" "}
      · {t("footer_learning")}
    </footer>
  );
}
