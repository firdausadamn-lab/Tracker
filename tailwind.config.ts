import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Deep tinted near-black, warmed toward the oxblood hue. Never pure #000.
        bg: "#15120F",
        elev: "#1C1814",
        elev2: "#241F1A",
        border: "#342E27",
        borderlit: "#463D33",
        // Aged parchment for text.
        ink: "#EFE6D6",
        inkdim: "#A79E8C",
        inkfaint: "#6A6254",
        // Oxblood crimson + aged brass accents.
        oxblood: "#8A2A38",
        oxbloodlit: "#A2333F",
        brass: "#BE9862",
        brassdim: "#8B7448",
        // Earthy, slightly desaturated green for done/live states.
        done: "#6F9557",
        donedim: "#3E4D36",
        doneink: "#10140C",
        danger: "#B84B3C",
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        sans: ["var(--font-hanken)", "system-ui", "sans-serif"],
        mono: ["var(--font-plex-mono)", "ui-monospace", "monospace"],
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.23, 1, 0.32, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
