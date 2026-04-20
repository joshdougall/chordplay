import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: "#1a1614", surface: "#252220", alt: "#2e2a27" },
        ink: { DEFAULT: "#f5f0e6", muted: "#a89e8e", faint: "#6b635a" },
        accent: { DEFAULT: "#e8b86b", hover: "#f2c278" },
        brand: { line: "#3a352f" },
        success: "#8fa869",
        danger: "#c47066"
      },
      fontFamily: {
        lora: ["var(--font-lora)", "Georgia", "serif"],
        "mono-brand": ["var(--font-mono-brand)", "JetBrains Mono", "monospace"]
      }
    }
  },
  plugins: []
};

export default config;
