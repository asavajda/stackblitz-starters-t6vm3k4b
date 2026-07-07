/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // pdfjs-dist referenzia 'canvas' come dipendenza opzionale per il
    // rendering server-side, che non usiamo (estraiamo solo il testo,
    // lato client). La escludiamo dal bundle per evitare errori di build.
    config.resolve.alias.canvas = false;
    return config;
  },
};

module.exports = nextConfig;
