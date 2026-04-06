/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Nucleus brand green (product2024 primary)
        primary: {
          50: "#D0F7E3",
          100: "#A0F0C7",
          200: "#66E9A7",
          300: "#33E189",
          400: "#00DA6C",
          500: "#00BC5D",
          600: "#00A451",
          700: "#008341",
          800: "#006630",
          900: "#003323",
        },
        // Nucleus warm neutrals (product2024)
        neutral: {
          0: "#FFFFFF",
          10: "#F4F4F4",
          20: "#F1EFE7",
          30: "#E7E5DE",
          40: "#D5D3CC",
          50: "#B6B3AA",
          60: "#95938F",
          70: "#7F7E7A",
          80: "#666562",
          90: "#3E3E3C",
          100: "#121212",
        },
      },
    },
  },
  plugins: [],
};
