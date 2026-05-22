/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        graphite: {
          900: "#0b0c0e",
          800: "#121418",
          700: "#1a1d24",
          600: "#252932",
          500: "#343a46",
          400: "#4b5364",
          300: "#7c889e",
          200: "#a9b5c9",
          100: "#d3dbe8",
        },
        neon: {
          purple: "#9d4edd",
          indigo: "#6366f1",
          blue: "#3a86c8",
          pink: "#f72585",
          green: "#06d6a0",
        }
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
        mono: ["SFMono-Regular", "Consolas", "Liberation Mono", "Menlo", "Courier", "monospace"],
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'neon-purple': '0 0 15px rgba(157, 78, 221, 0.4)',
        'neon-indigo': '0 0 15px rgba(99, 102, 241, 0.4)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      }
    },
  },
  plugins: [],
}
