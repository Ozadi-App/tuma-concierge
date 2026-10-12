import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "../../packages/shared/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "rgb(var(--color-cream, var(--cream)) / <alpha-value>)",
        ink: {
          DEFAULT: "rgb(var(--color-ink, var(--ink)) / <alpha-value>)",
          500: "rgb(var(--color-ink-muted, var(--ink-muted)) / <alpha-value>)",
          gold: "rgb(var(--color-ink-gold, var(--ink-gold, 10 10 10)) / <alpha-value>)",
        },
        gold: "rgb(var(--color-gold, var(--gold)) / <alpha-value>)",
        navy: "rgb(var(--color-navy, var(--navy)) / <alpha-value>)",
        green: "rgb(var(--color-green, var(--green)) / <alpha-value>)",
        black: {
          DEFAULT: "#000000",
          950: "#050505",
          900: "#0a0a0a",
          850: "#101010",
          800: "#141414",
          700: "#1c1c1c",
          600: "#242424",
        },
      },
    },
  },
  plugins: [],
};
export default config;
