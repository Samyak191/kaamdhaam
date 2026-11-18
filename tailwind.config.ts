import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#1D9E75',
        ink: '#172033',
        muted: '#667085',
        line: '#E8EAED',
        canvas: '#FAFAFA',
      },
      fontFamily: { sans: ['Inter', 'Arial', 'sans-serif'] },
    },
  },
  plugins: [],
} satisfies Config
