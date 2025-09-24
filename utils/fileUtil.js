import fs from 'fs';
import path from 'path';

export const readJson = (filePath) =>
  JSON.parse(fs.readFileSync(filePath, 'utf8'));

export const writeJson = (filePath, data) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
};

export const listFiles = (dir) =>
  fs.existsSync(dir) ? fs.readdirSync(dir) : [];
