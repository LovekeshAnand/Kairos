const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('\n================================================================');
console.log('🚀 LAUNCHING KAIROS ALL-IN-ONE SYSTEM (OPENWA + KAIROS HUB)');
console.log('================================================================\n');

const openwaDir = path.resolve(__dirname, '..', 'openwa');
const openwaDist = path.join(openwaDir, 'dist', 'main.js');

// 1. Determine OpenWA command
let openwaCmd = 'node';
let openwaArgs = ['dist/main.js'];

if (!fs.existsSync(openwaDist)) {
  openwaCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  openwaArgs = ['start'];
}

// 2. Spawn OpenWA Gateway (Port 2785)
console.log('📡 Starting OpenWA Gateway on port 2785...');
const openwa = spawn(openwaCmd, openwaArgs, {
  cwd: openwaDir,
  shell: true,
  env: { ...process.env }
});

openwa.stdout.on('data', data => {
  const lines = data.toString().trim().split('\n');
  lines.forEach(line => {
    if (line.trim()) console.log(`\x1b[36m[OpenWA 2785]\x1b[0m ${line}`);
  });
});

openwa.stderr.on('data', data => {
  const lines = data.toString().trim().split('\n');
  lines.forEach(line => {
    if (line.trim()) console.error(`\x1b[31m[OpenWA ERR]\x1b[0m ${line}`);
  });
});

// 3. Spawn Kairos Hub (Port 3000)
console.log('⚡ Starting Kairos Operations Hub on port 3000...');
const kairos = spawn('node', ['src/server.js'], {
  cwd: path.resolve(__dirname, '..'),
  shell: true,
  env: { ...process.env }
});

kairos.stdout.on('data', data => {
  const lines = data.toString().trim().split('\n');
  lines.forEach(line => {
    if (line.trim()) console.log(`\x1b[32m[Kairos 3000]\x1b[0m ${line}`);
  });
});

kairos.stderr.on('data', data => {
  const lines = data.toString().trim().split('\n');
  lines.forEach(line => {
    if (line.trim()) console.error(`\x1b[31m[Kairos ERR]\x1b[0m ${line}`);
  });
});

// Graceful exit handling
function cleanExit() {
  console.log('\n🛑 Shutting down Kairos and OpenWA processes...');
  try { openwa.kill(); } catch (e) {}
  try { kairos.kill(); } catch (e) {}
  process.exit(0);
}

process.on('SIGINT', cleanExit);
process.on('SIGTERM', cleanExit);
process.on('exit', cleanExit);
