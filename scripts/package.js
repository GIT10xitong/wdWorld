const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectDir = path.dirname(__dirname);
const distDir = path.join(projectDir, 'dist');
const releaseDir = path.join(projectDir, 'release');
const appDir = path.join(releaseDir, 'WDWorld');

console.log('=== WD World Packaging Script ===');
console.log('Project Dir:', projectDir);
console.log('Dist Dir:', distDir);
console.log('Release Dir:', releaseDir);

if (!fs.existsSync(distDir)) {
  console.error('Error: dist directory not found. Please run "npm run build" first.');
  process.exit(1);
}

try {
  console.log('\nStep 1: Cleaning release directory...');
  if (fs.existsSync(releaseDir)) {
    execSync(`rmdir /s /q "${releaseDir}"`, { stdio: 'ignore' });
  }
  fs.mkdirSync(appDir, { recursive: true });
  console.log('Done.');

  console.log('\nStep 2: Copying application files...');
  execSync(`xcopy /e /i "${distDir}\\assets" "${appDir}\\assets"`, { stdio: 'ignore' });
  execSync(`copy "${distDir}\\index.html" "${appDir}\\index.html"`, { stdio: 'ignore' });
  console.log('Done.');

  console.log('\nStep 3: Creating startup script...');
  
  const startupScript = `@echo off
title WD World - Local Worldbuilding Tool
cd /d "%~dp0"

echo Starting WD World...
echo.

python -m http.server 4173

pause`;
  
  fs.writeFileSync(path.join(appDir, 'start.bat'), startupScript);
  console.log('Done.');

  console.log('\nStep 4: Creating README...');
  
  const readmeContent = `WD World - Local Worldbuilding Tool
================================

This is a local-first worldbuilding application built with React + Vite.

Requirements:
- Python 3.x (for built-in HTTP server)
- Modern web browser (Chrome, Firefox, Edge, etc.)

How to Run:
1. Double-click start.bat
2. Open your browser and navigate to http://localhost:4173
3. Start building your world!

Features:
- Project management (create, open, recent projects)
- Entry CRUD with auto-save
- Markdown editor with TipTap
- Tag management
- Alias management
- Image upload and local reference
- Cover image setting
- Enhanced search (title, tags, full-text)
- Explicit relationship management
- Backlink panel
- Map view with base map upload
- Region annotation and anchor system
- Entry placement on map
- Timeline view (entry-level and world)
- Encyclopedia reading mode
- Directory navigation (grouped by type)
- Context linkage (same region/type recommendations)
- Relationship graph visualization
- Template system
- Static Wiki export
- Project data import/export

Data Storage:
- All data is stored locally in your browser's localStorage
- No cloud dependency
- Data is automatically saved`;
  
  fs.writeFileSync(path.join(appDir, 'README.txt'), readmeContent);
  console.log('Done.');

  console.log('\nStep 5: Checking if Python is available...');
  try {
    const pythonVersion = execSync('python --version', { encoding: 'utf-8' });
    console.log('Python found:', pythonVersion.trim());
  } catch (err) {
    console.log('Python not found, trying python3...');
    try {
      const pythonVersion = execSync('python3 --version', { encoding: 'utf-8' });
      console.log('Python3 found:', pythonVersion.trim());
      const startupScriptPython3 = `@echo off
title WD World - Local Worldbuilding Tool
cd /d "%~dp0"

echo Starting WD World...
echo.

python3 -m http.server 4173

pause`;
      fs.writeFileSync(path.join(appDir, 'start.bat'), startupScriptPython3);
    } catch (err2) {
      console.warn('Warning: Python not found. You may need to install Python or use Node.js.');
      console.log('Creating Node.js startup script...');
      
      const nodeServer = `const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 4173;
const distDir = __dirname;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
};

const server = http.createServer((req, res) => {
  let filePath = path.join(distDir, req.url === '/' ? 'index.html' : req.url);
  const extname = path.extname(filePath);
  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Not Found</h1>', 'utf-8');
      } else {
        res.writeHead(500);
        res.end('Server Error: ' + error.code);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log('WD World server running at http://localhost:' + PORT + '/');
  console.log('Press Ctrl+C to stop the server');
});`;
      
      fs.writeFileSync(path.join(appDir, 'server.js'), nodeServer);
      
      const startupScriptNode = `@echo off
title WD World - Local Worldbuilding Tool
cd /d "%~dp0"

echo Starting WD World...
echo.

node server.js

pause`;
      fs.writeFileSync(path.join(appDir, 'start.bat'), startupScriptNode);
    }
  }

  console.log('\n=== Packaging Complete! ===');
  console.log('');
  console.log('Your application is ready at:');
  console.log(appDir);
  console.log('');
  console.log('To run:');
  console.log('1. Navigate to the release folder');
  console.log('2. Double-click start.bat');
  console.log('3. Open http://localhost:4173 in your browser');
  console.log('');

} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}