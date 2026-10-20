import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ocean: {
          50: "#effcfb",
          100: "#d5f5f2",
          200: "#afe9e4",
          300: "#7bd7d0",
          400: "#43bdb7",
          500: "#1aa29e",
          600: "#11847f",
          700: "#0F766E",
          800: "#115E59",
          900: "#124644",
        },
        ink: {
          50: "#f8faf9",
          100: "#edf2f0",
          200: "#dce6e3",
          300: "#c0d0cc",
          400: "#91aaa4",
          500: "#64817b",
          600: "#4b6862",
          700: "#3d544f",
          800: "#334541",
          900: "#263530",
        },
      },
      boxShadow: {
        soft: "0 18px 50px rgba(18, 68, 66, 0.08)",
        card: "0 8px 26px rgba(18, 68, 66, 0.07)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Manrope", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
