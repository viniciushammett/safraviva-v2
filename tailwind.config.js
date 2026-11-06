/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {
    fontFamily: { sans: ['Inter', 'sans-serif'] },
    colors: { background: '#F8FAF9', foreground: '#17231D', primary: { DEFAULT: '#164B35', foreground: '#FFFFFF' }, accent: '#16845B', muted: { DEFAULT: '#F0F4F1', foreground: '#64736B' }, border: '#E2E8E4', ring: '#16845B', card: '#FFFFFF' },
    boxShadow: { soft: '0 2px 8px rgb(23 35 29 / 3%)' },
  } },
  plugins: [],
}
