import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        nvidia: {
          DEFAULT: "#76B900",
          hover: "#88D400",
          dark: "#1A4D00",
        },
        nebius: {
          DEFAULT: "#7C3AED",
          hover: "#8B5CF6",
          dark: "#4C1D95",
        },
      },
    },
  },
  plugins: [],
};
export default config;
