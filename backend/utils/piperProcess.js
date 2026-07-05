const { spawn } = require('child_process');
const path = require('path');
const { getPiperSettings } = require('./piperSettings');

let piperChild = null;
let ownedProcess = false;

async function isPiperHealthy(baseUrl) {
  try {
    const response = await fetch(`${baseUrl}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'ready' }),
      signal: AbortSignal.timeout(8000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function spawnPiper(python, voice, port) {
  return spawn(
    python,
    ['-m', 'piper.http_server', '-m', voice, '--port', String(port)],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: path.resolve(__dirname, '../..'),
      shell: process.platform === 'win32',
      detached: false,
    }
  );
}

function attachPiperLogs(child, logger) {
  child.stdout.on('data', (chunk) => {
    const line = chunk.toString().trim();
    if (line) logger.info(`[piper] ${line}`);
  });
  child.stderr.on('data', (chunk) => {
    const line = chunk.toString().trim();
    if (line) logger.warn(`[piper] ${line}`);
  });
}

async function waitForPiper(baseUrl, attempts = 15, delayMs = 1000) {
  for (let i = 0; i < attempts; i++) {
    if (await isPiperHealthy(baseUrl)) return true;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}

/**
 * Start Piper when PIPER_AUTO_START is enabled (default in development).
 * Skips spawn if something is already responding on PIPER_BASE_URL.
 */
async function startPiper(logger = console) {
  const { baseUrl, port, voice, python, autoStart } = getPiperSettings();

  if (!autoStart) {
    logger.info('[piper] Auto-start disabled (PIPER_AUTO_START=false or production mode)');
    return { started: false, url: baseUrl, reason: 'disabled' };
  }

  if (await isPiperHealthy(baseUrl)) {
    logger.info(`[piper] Already running at ${baseUrl}`);
    return { started: false, url: baseUrl, reason: 'already_running' };
  }

  logger.info(`[piper] Starting "${voice}" on port ${port}...`);

  piperChild = spawnPiper(python, voice, port);
  ownedProcess = true;

  piperChild.on('error', (err) => {
    logger.warn(`[piper] Could not start: ${err.message}`);
    logger.warn('[piper] English TTS will fall back to browser speech until Piper is running.');
    logger.warn('[piper] Manual start: npm run piper');
    piperChild = null;
    ownedProcess = false;
  });

  attachPiperLogs(piperChild, logger);

  piperChild.on('exit', (code) => {
    if (ownedProcess && code !== 0 && code !== null) {
      logger.warn(`[piper] Process exited with code ${code}`);
    }
    piperChild = null;
    ownedProcess = false;
  });

  const ready = await waitForPiper(baseUrl);
  if (ready) {
    logger.info(`[piper] Ready at ${baseUrl}`);
    return { started: true, url: baseUrl, reason: 'spawned' };
  }

  logger.warn(`[piper] Started but not responding yet at ${baseUrl}`);
  logger.warn('[piper] Try manually: npm run piper');
  return { started: true, url: baseUrl, reason: 'spawned_not_ready' };
}

function stopPiper(logger = console) {
  if (!piperChild || !ownedProcess) return;

  logger.info('[piper] Stopping...');
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/PID', String(piperChild.pid), '/T', '/F'], { shell: true });
    } else {
      piperChild.kill('SIGTERM');
    }
  } catch (err) {
    logger.warn(`[piper] Stop failed: ${err.message}`);
  }

  piperChild = null;
  ownedProcess = false;
}

module.exports = { startPiper, stopPiper, isPiperHealthy };
