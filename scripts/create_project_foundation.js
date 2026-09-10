const fs = require('fs');
const path = require('path');

const root = 'C:/Users/Furqan/Desktop/PeakPalsWebsite';

// 1. package.json
const packageJson = {
  "name": "peakpals-website",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@phosphor-icons/react": "^2.1.7",
    "clsx": "^2.1.1",
    "framer-motion": "^12.4.7",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "tailwind-merge": "^3.0.1"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.0.9",
    "@types/react": "^18.3.18",
    "@types/react-dom": "^18.3.5",
    "@vitejs/plugin-react": "^4.3.4",
    "tailwindcss": "^4.0.9",
    "vite": "^6.2.0"
  }
};
fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(packageJson, null, 2));

// 2. vite.config.js
const viteConfig = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: true
  }
});
`;
fs.writeFileSync(path.join(root, 'vite.config.js'), viteConfig);

// 3. index.html
const indexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/png" href="/assets/images/ChatGPT_Image_Jan_28__2026__09_33_04_PM-removebg-preview.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PeakPals | Get Diet, Workouts & Be Accountable To Lose Weight</title>
    <meta name="description" content="Lose 5-7kg in 28 days, cut belly fat and improve health with India's #1 One-On-One Fitness Program." />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300..800;1,300..800&display=swap" rel="stylesheet">
  </head>
  <body class="bg-black text-white antialiased selection:bg-[#539E28] selection:text-white font-sans">
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`;
fs.writeFileSync(path.join(root, 'index.html'), indexHtml);

// 4. src/index.css
const indexCss = `@import "tailwindcss";

@layer base {
  body {
    font-family: 'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    background-color: #000000;
    color: #ffffff;
    overflow-x: hidden;
  }
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
}
::-webkit-scrollbar-track {
  background: #0a0a0a;
}
::-webkit-scrollbar-thumb {
  background: #262626;
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: #404040;
}
`;
fs.writeFileSync(path.join(root, 'src/index.css'), indexCss);

// 5. src/main.jsx
const mainJsx = `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`;
fs.writeFileSync(path.join(root, 'src/main.jsx'), mainJsx);

// 6. src/lib/utils.js
const utilsDir = path.join(root, 'src/lib');
if (!fs.existsSync(utilsDir)) fs.mkdirSync(utilsDir, { recursive: true });
const utilsJs = `import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
`;
fs.writeFileSync(path.join(utilsDir, 'utils.js'), utilsJs);

console.log('Project foundation created.');
