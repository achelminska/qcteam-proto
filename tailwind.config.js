/** Tailwind is compiled into the bundle at build time (npm run build) — the app no longer depends on cdn.tailwindcss.com,
 *  which warehouse / corporate networks can block, leaving every screen unstyled. */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: { extend: {} },
  plugins: [],
};
