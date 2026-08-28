/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        minecraft: {
          50: '#f0f9f0',
          100: '#dcf0dc',
          200: '#bce1bd',
          300: '#8fcb92',
          400: '#5dae63',
          500: '#3a9142',
          600: '#2b7434',
          700: '#245d2c',
          800: '#1f4b26',
          900: '#1a3e21',
          950: '#0c2111'
        }
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Cascadia Code"', 'Consolas', 'monospace']
      },
      boxShadow: {
        'glow': '0 0 20px rgba(59, 145, 66, 0.3)',
        'glow-blue': '0 0 20px rgba(59, 130, 246, 0.25)'
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-in-out'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        }
      }
    }
  },
  plugins: []
}
