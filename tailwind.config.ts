import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          red: "#b42318",
          ink: "#151515",
          line: "#d7d7d7",
          mist: "#f5f7f8"
        }
      }
    }
  },
  plugins: []
};

export default config;
