import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#131512",
        elev: "#1a1d18",
        elev2: "#22261f",
        ink: "#eae6da",
        inkdim: "#948f80",
        inkfaint: "#5c584c",
        accent: "#c1663f",
        accentink: "#131512",
        border: "#2a2d24",
        danger: "#c1503f",
      },
      fontFamily: {
        display: ["var(--font-outfit)", "system-ui", "sans-serif"],
        mono: ["var(--font-plex-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
