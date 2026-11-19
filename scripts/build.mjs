// Copies the static app into dist/ (the folder Vercel publishes)
import { cpSync, rmSync, mkdirSync } from 'node:fs';

const files = [
    'index.html', 'privacidad.html', 'aviso-legal.html', 'cookies.html',
    'config.js', 'app.js', 'motion.js', 'backup.js', 'garage.js', 'cloud.js', 'auth.js',
    'styles.css', 'motion.css', 'theme.css', 'legal.css',
    'sw.js', 'manifest.webmanifest', 'icons', 'vendor'
];

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist');
for (const file of files) {
    cpSync(file, `dist/${file}`, { recursive: true });
}
console.log(`dist/ generado: ${files.join(', ')}`);
