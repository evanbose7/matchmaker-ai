/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#241221",
        bg2: "#34182f",
        panel: "#2c1628",
        accent: "#ff6b5e",
        accent2: "#ffc24b",
        ink: "#f6ebe4",
        muted: "#c6a3b4",
      },
      fontFamily: {
        display: ["Georgia", "Iowan Old Style", "Palatino Linotype", "serif"],
      },
    },
  },
  plugins: [],
};
