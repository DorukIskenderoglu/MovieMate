/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'dark-bg': '#050505',      // Siyah
                'dark-navy': '#0a192f',    // Lacivert
                'accent-red': '#ff0000',   // Kırmızı
            }
        },
    },
    plugins: [],
}