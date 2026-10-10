import type { Config } from 'tailwindcss';
const config: Config = { content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'], theme: { extend: { colors: { ink: '#121212', lime: '#d8ff45', fog: '#f3f1ea' } } }, plugins: [] };
export default config;
