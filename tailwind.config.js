/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        void: "#030308",
        "void-2": "#08080f",
        "arc-purple": "#6B3FA0",
        "arc-violet": "#9B6FD0",
        "arc-glow": "#C084FC",
        "arc-cyan": "#22D3EE",
        "arc-green": "#34D399",
        "arc-red": "#F87171",
        "surface": "rgba(255,255,255,0.04)",
        "surface-2": "rgba(255,255,255,0.07)",
        "border-dim": "rgba(255,255,255,0.08)",
      },
      fontFamily: {
        display: ["'Bebas Neue'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
        body: ["'DM Sans'", "sans-serif"],
      },
      animation: {
        "pulse-slow": "pulse 4s cubic-bezier(0.4,0,0.6,1) infinite",
        "flicker": "flicker 3s linear infinite",
        "scan": "scan 8s linear infinite",
        "float": "float 6s ease-in-out infinite",
      },
      keyframes: {
        flicker: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.85" },
          "52%": { opacity: "1" },
          "54%": { opacity: "0.9" },
        },
        scan: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
      backgroundImage: {
        "grid-pattern":
          "linear-gradient(rgba(107,63,160,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(107,63,160,0.15) 1px, transparent 1px)",
      },
      backgroundSize: {
        "grid": "40px 40px",
      },
    },
  },
  plugins: [],
};
