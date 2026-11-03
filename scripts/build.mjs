// Copies the static app into dist/ (the folder Vercel publishes)
import { cpSync, rmSync, mkdirSync } from 'node:fs';

const files = ['index.html', 'app.js', 'styles.css', 'vendor'];

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist');
for (const file of files) {
    cpSync(file, `dist/${file}`, { recursive: true });
}
console.log(`dist/ generado: ${files.join(', ')}`);
