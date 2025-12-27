/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      gridTemplateColumns: {
        '15': 'repeat(15, minmax(0, 1fr))', // เพิ่มบรรทัดนี้เพื่อรองรับกระดาน 15 ช่อง
      }
    },
  },
  plugins: [],
}