import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-outfit)"],
        serif: ["var(--font-playfair)"],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Design system tokens
        primary: "var(--color-primary)",
        "primary-dark": "var(--color-primary-dark)",
        "primary-light": "var(--color-primary-light)",
        accent: "var(--color-accent)",
        success: "var(--color-success)",
        warning: "var(--color-warning)",
        danger: "var(--color-danger)",
        surface: "var(--color-surface)",
        "surface-2": "var(--color-surface-2)",
        "surface-3": "var(--color-surface-3)",
        border: "var(--color-border)",
        "border-heavy": "var(--color-border-heavy)",
        text: {
          primary: "var(--color-text-primary)",
          secondary: "var(--color-text-secondary)",
          muted: "var(--color-text-muted)",
        },
      },
      spacing: {
        xs: "4px",
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "20px",
        "2xl": "24px",
        "3xl": "32px",
      },
      borderRadius: {
        xs: "var(--radius-sm)",
        sm: "var(--radius-md)",
        md: "var(--radius-lg)",
        lg: "var(--radius-xl)",
        xl: "var(--radius-2xl)",
        full: "var(--radius-full)",
      },
      boxShadow: {
        xs: "var(--shadow-1)",
        sm: "var(--shadow-2)",
        md: "var(--shadow-3)",
        lg: "var(--shadow-4)",
      },
      backgroundImage: {
        'gradient-user-bubble': 'linear-gradient(135deg, rgb(37, 99, 235) 0%, rgb(37, 99, 235) 50%, rgb(79, 70, 229) 100%)',
        'gradient-header': 'linear-gradient(90deg, rgba(241, 245, 249, 0.95) 0%, rgba(219, 234, 254, 0.4) 50%, rgba(238, 242, 255, 0.6) 100%)',
        'gradient-header-dark': 'linear-gradient(90deg, rgba(24, 24, 27, 0.95) 0%, rgba(24, 24, 27, 0.9) 50%, rgba(30, 27, 75, 0.4) 100%)',
        'gradient-button': 'linear-gradient(90deg, rgb(37, 99, 235) 0%, rgb(79, 70, 229) 100%)',
        'gradient-button-hover': 'linear-gradient(90deg, rgb(29, 78, 216) 0%, rgb(67, 56, 202) 100%)',
        'gradient-overlay': 'linear-gradient(180deg, rgba(0, 0, 0, 0.6) 0%, transparent 100%)',
      },
      transitionDuration: {
        fast: "var(--duration-fast)",
        base: "var(--duration-normal)",
        slow: "var(--duration-slow)",
      },
      animation: {
        blob: "blob 7s infinite",
        "border-beam": "border-beam calc(var(--duration)*1s) infinite linear",
        aurora: "aurora 60s linear infinite",
      },
      keyframes: {
        blob: {
          "0%": {
            transform: "translate(0px, 0px) scale(1)",
          },
          "33%": {
            transform: "translate(30px, -50px) scale(1.1)",
          },
          "66%": {
            transform: "translate(-20px, 20px) scale(0.9)",
          },
          "100%": {
            transform: "translate(0px, 0px) scale(1)",
          },
        },
        "border-beam": {
          "100%": {
            "offset-distance": "100%",
          },
        },
        aurora: {
          from: { backgroundPosition: "50% 50%, 50% 50%" },
          to: { backgroundPosition: "350% 50%, 350% 50%" },
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
export default config;
