/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: "#ffffff",
          panel: "#ffffff",
          panelSoft: "#f8fafc",
          indigo: "#6366f1",
          electric: "#4f46e5",
          cyan: "#B70D23",
          text: "#111111",
          muted: "#4b5563",
          // New crimson color palette
          crimson: {
            50: "#fef2f2",
            100: "#fee2e2",
            200: "#fecaca",
            300: "#fca5a5",
            400: "#f87171",
            500: "#ef4444",
            600: "#dc2626",
            700: "#b70d23",
            800: "#7f1d1d",
            900: "#431407",
          },
          primary: "#b70d23",
          primaryHover: "#8b0a1a",
          primaryLight: "#f87171",
          primaryDark: "#7f1d1d",
        },
      },
      screens: {
        'xs': '320px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
      },
    },
  },
  plugins: [],
};
