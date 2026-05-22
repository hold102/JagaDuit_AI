/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          900: "#0a1f3d",
          800: "#0b2c5e",
          700: "#14407a",
          600: "#1d5298",
          500: "#2563b3",
          50:  "#eaf0fa",
          25:  "#f4f7fc",
        },
        gold: {
          500: "#f5c518",
          400: "#ffd60a",
          50:  "#fff8db",
        },
        ink: {
          900: "#0f1623",
          700: "#2a3445",
          500: "#5a6577",
          400: "#8390a3",
          300: "#b5bdcb",
          200: "#d8dee8",
          100: "#ebeef4",
          50:  "#f5f7fb",
        },
        risk: {
          low:    "#058a4f",
          lowbg:  "#e3f5ec",
          med:    "#c87a00",
          medbg:  "#fff3dc",
          high:   "#c41c33",
          highbg: "#fde7ea",
        },
      },
      fontFamily: {
        sans: ["IBM Plex Sans", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "SF Mono", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
}
