import type { Config } from "tailwindcss";

// The same palette tokens as every other Peebee app; the TV is always dark and large.
const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        cream: { DEFAULT: "rgb(var(--color-cream) / <alpha-value>)" },
        gold: { DEFAULT: "rgb(var(--color-gold) / <alpha-value>)", 400: "rgb(var(--color-gold-400) / <alpha-value>)" },
        ink: { DEFAULT: "rgb(var(--color-ink) / <alpha-value>)", 500: "rgb(var(--color-ink-500) / <alpha-value>)", gold: "rgb(var(--color-ink-gold) / <alpha-value>)" },
        green: { DEFAULT: "rgb(var(--color-green) / <alpha-value>)" },
      },
    },
  },
  plugins: [],
};

export default config;
