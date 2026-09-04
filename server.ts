/**
 * CropFix - Production Server Entrypoint
 * SIH26131: Early detection and management of crop diseases and pest infestations
 */

import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app } from './src/server/app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const distPath = path.resolve(__dirname, 'dist');

// Serve static frontend files
app.use(express.static(distPath));

// For SPA routing: fallback to index.html for non-API requests
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`CropFix server running on port ${PORT}`);
});
