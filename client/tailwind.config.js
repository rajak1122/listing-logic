/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      colors: {
        darkBg: "#0b0f19",
        glassBg: "rgba(18, 24, 38, 0.65)",
        glassBorder: "rgba(255, 255, 255, 0.08)",
        glowEmerald: "rgba(16, 185, 129, 0.15)",
        glowCyan: "rgba(6, 182, 212, 0.15)",
      },
      backdropBlur: {
        glass: "16px",
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
        glowGreen: "0 0 20px -3px rgba(16, 185, 129, 0.3)",
        glowBlue: "0 0 20px -3px rgba(59, 130, 246, 0.3)",
      },
    },
  },
  plugins: [],
};
