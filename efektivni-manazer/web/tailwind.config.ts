import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0b0d10",
        panel: "#13161b",
        line: "#1f242c",
        ink: "#e7ecf2",
        muted: "#7e8896",
        brand: "#5cd0a8",
        warn: "#f0b35e",
        danger: "#ef6262",
      },
    },
  },
  plugins: [],
} satisfies Config;
