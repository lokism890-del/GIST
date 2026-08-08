import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class', // <--- YOU MUST ADD THIS LINE
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  // ... rest of config
}
export default config