/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          base: 'var(--bg-base)',
          surface: 'var(--bg-surface)',
          elevated: 'var(--bg-elevated)',
          hover: 'var(--bg-hover)',
          input: 'var(--bg-input)'
        },
        border: {
          DEFAULT: 'var(--border-DEFAULT)',
          subtle: 'var(--border-subtle)',
          hover: 'var(--border-hover)'
        },
        accent: {
          DEFAULT: 'var(--accent-DEFAULT)',
          hover: 'var(--accent-hover)',
          muted: 'var(--accent-muted)',
          light: 'var(--accent-light)'
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)'
        }
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'SF Pro Text',
          'Segoe UI Variable Text',
          'system-ui',
          'Segoe UI',
          'sans-serif'
        ],
        mono: ['JetBrains Mono', 'SF Mono', 'Cascadia Code', 'Consolas', 'monospace']
      },
      borderRadius: {
        ios: '18px',
        'ios-lg': '22px'
      },
      transitionTimingFunction: {
        ios: 'cubic-bezier(0.32, 0.72, 0, 1)',
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'out-quart': 'cubic-bezier(0.25, 1, 0.5, 1)'
      },
      boxShadow: {
        glass: 'var(--glass-shadow)',
        glow: '0 0 20px -2px var(--glow-color)',
        'glow-lg': '0 8px 32px -4px var(--glow-color)',
        lifted: '0 12px 32px -8px rgba(0, 0, 0, 0.25)'
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scaleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both',
        'spin-slow': 'spin 8s linear infinite'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.92)' },
          '100%': { opacity: '1', transform: 'scale(1)' }
        }
      }
    }
  },
  plugins: []
}
