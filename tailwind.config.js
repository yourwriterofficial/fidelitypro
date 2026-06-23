/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#22c55e',
          dark: '#16a34a',
          light: '#86efac',
        }
      }
    },
  },
  plugins: [],
}