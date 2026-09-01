/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#00674F',
          dark: '#004d3a',
          light: '#5aab8a',
        }
      }
    },
  },
  plugins: [],
}