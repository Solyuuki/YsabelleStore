import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)"],
        display: ["var(--font-display)"],
        serif: ["var(--font-serif)"],
        mono: ["var(--font-mono)"]
      },
      fontSize: {
        xs: ["var(--type-caption-size)", { lineHeight: "var(--leading-label)" }],
        sm: ["var(--type-body-sm-size)", { lineHeight: "var(--leading-body-tight)" }],
        base: ["var(--type-body-size)", { lineHeight: "var(--leading-body)" }],
        lg: ["var(--type-h4-size)", { lineHeight: "var(--leading-subheading)" }],
        display: [
          "var(--type-display-size)",
          { lineHeight: "var(--leading-display)", letterSpacing: "var(--tracking-display)" }
        ],
        h1: [
          "var(--type-h1-size)",
          { lineHeight: "var(--leading-heading)", letterSpacing: "var(--tracking-heading)" }
        ],
        h2: [
          "var(--type-h2-size)",
          { lineHeight: "var(--leading-heading)", letterSpacing: "var(--tracking-heading)" }
        ],
        h3: ["var(--type-h3-size)", { lineHeight: "var(--leading-subheading)" }],
        h4: ["var(--type-h4-size)", { lineHeight: "var(--leading-subheading)" }],
        "body-lg": ["var(--type-body-lg-size)", { lineHeight: "var(--leading-body)" }],
        body: ["var(--type-body-size)", { lineHeight: "var(--leading-body)" }],
        "body-sm": ["var(--type-body-sm-size)", { lineHeight: "var(--leading-body-tight)" }],
        label: ["var(--type-label-size)", { lineHeight: "var(--leading-label)" }],
        caption: ["var(--type-caption-size)", { lineHeight: "var(--leading-label)" }]
      },
      colors: {
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))"
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))"
        }
      },
      borderRadius: {
        md: "var(--radius)",
        sm: "calc(var(--radius) - 2px)"
      }
    }
  },
  plugins: []
};

export default config;
