const { spawn } = require('child_process');
const { getSomaliSpeechSettings, splitPythonCommand } = require('./somaliSpeechSettings');

let asrChild = null;
let ttsChild = null;
let ownedAsr = false;
let ownedTts = false;

function spawnPythonService(python, uvicornArgs, cwd) {
  const { cmd, baseArgs } = splitPythonCommand(python);
  const useShell = process.platform === 'win32' && !python.includes('\\') && !python.includes('/');
  return spawn(cmd, [...baseArgs, '-m', 'uvicorn', ...uvicornArgs], {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: useShell,
    detached: false,
    env: { ...process.env },
  });
}

async function isServiceHealthy(url, timeoutMs = 8000) {
  try {
    const response = await fetch(`${url}/health`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function attachLogs(child, tag, logger) {
  child.stdout.on('data', (chunk) => {
    const line = chunk.toString().trim();
    if (line) logger.info(`[${tag}] ${line}`);
  });
  child.stderr.on('data', (chunk) => {
    const line = chunk.toString().trim();
    if (line) logger.warn(`[${tag}] ${line}`);
  });
}

function spawnAsr(python, port, cwd) {
  return spawnPythonService(python, ['stt_service:app', '--host', '127.0.0.1', '--port', String(port)], cwd);
}

function spawnTts(python, port, cwd) {
  return spawnPythonService(python, ['main:app', '--host', '127.0.0.1', '--port', String(port)], cwd);
}

async function waitForService(url, attempts, delayMs, logger, label) {
  for (let i = 0; i < attempts; i++) {
    if (await isServiceHealthy(url)) return true;
    if (i > 0 && i % 5 === 0) {
      logger.info(`[${label}] Still starting… (${i}/${attempts})`);
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}

async function startSomaliAsr(settings, logger, waitForReady = false) {
  const { asrUrl, asrPort, asrPython, modelsDir } = settings;
  const attempts = waitForReady ? 90 : 10;

  if (await isServiceHealthy(asrUrl)) {
    logger.info(`[somali-asr] Already running at ${asrUrl}`);
    return { started: false, url: asrUrl, reason: 'already_running' };
  }

  logger.info(`[somali-asr] Starting on port ${asrPort} (${asrPython})…`);
  logger.info('[somali-asr] First launch may take 1–3 min while the ASR model loads.');

  asrChild = spawnAsr(asrPython, asrPort, modelsDir);
  ownedAsr = true;

  asrChild.on('error', (err) => {
    logger.warn(`[somali-asr] Could not start: ${err.message}`);
    logger.warn('[somali-asr] Run once: node scripts/setup-somali-speech.js');
    asrChild = null;
    ownedAsr = false;
  });

  attachLogs(asrChild, 'somali-asr', logger);

  asrChild.on('exit', (code) => {
    if (ownedAsr && code !== 0 && code !== null) {
      logger.warn(`[somali-asr] Process exited with code ${code}`);
    }
    asrChild = null;
    ownedAsr = false;
  });

  const ready = await waitForService(asrUrl, attempts, 2000, logger, 'somali-asr');
  if (ready) {
    logger.info(`[somali-asr] Ready at ${asrUrl}`);
    return { started: true, url: asrUrl, reason: 'spawned' };
  }

  if (!waitForReady) {
    logger.info(`[somali-asr] Starting in background — ASR may take 1–3 min on first run`);
    return { started: true, url: asrUrl, reason: 'warming_up' };
  }

  logger.warn(`[somali-asr] Spawned but not healthy yet at ${asrUrl}`);
  return { started: true, url: asrUrl, reason: 'spawned_not_ready' };
}

async function startSomaliTts(settings, logger, waitForReady = false) {
  const { ttsUrl, ttsPort, ttsPython, ttsDir } = settings;
  const attempts = waitForReady ? 60 : 10;

  if (await isServiceHealthy(ttsUrl)) {
    logger.info(`[somali-tts] Already running at ${ttsUrl}`);
    return { started: false, url: ttsUrl, reason: 'already_running' };
  }

  logger.info(`[somali-tts] Starting on port ${ttsPort} (${ttsPython})…`);
  logger.info('[somali-tts] First launch may take 30–90s while the TTS model loads.');

  ttsChild = spawnTts(ttsPython, ttsPort, ttsDir);
  ownedTts = true;

  ttsChild.on('error', (err) => {
    logger.warn(`[somali-tts] Could not start: ${err.message}`);
    logger.warn('[somali-tts] Run once: node scripts/setup-somali-speech.js');
    ttsChild = null;
    ownedTts = false;
  });

  attachLogs(ttsChild, 'somali-tts', logger);

  ttsChild.on('exit', (code) => {
    if (ownedTts && code !== 0 && code !== null) {
      logger.warn(`[somali-tts] Process exited with code ${code}`);
    }
    ttsChild = null;
    ownedTts = false;
  });

  const ready = await waitForService(ttsUrl, attempts, 2000, logger, 'somali-tts');
  if (ready) {
    logger.info(`[somali-tts] Ready at ${ttsUrl}`);
    return { started: true, url: ttsUrl, reason: 'spawned' };
  }

  if (!waitForReady) {
    logger.info(`[somali-tts] Starting in background — TTS may take 30–90s on first run`);
    return { started: true, url: ttsUrl, reason: 'warming_up' };
  }

  logger.warn(`[somali-tts] Spawned but not healthy yet at ${ttsUrl}`);
  return { started: true, url: ttsUrl, reason: 'spawned_not_ready' };
}

/**
 * Start Somali ASR (8001) and TTS (8002) when SOMALI_AUTO_START is enabled.
 */
async function startSomaliSpeech(logger = console, options = {}) {
  const { waitForReady = false } = options;
  const settings = getSomaliSpeechSettings();

  if (!settings.autoStart) {
    logger.info('[somali-speech] Auto-start disabled (SOMALI_AUTO_START=false or production mode)');
    return { asr: { started: false, reason: 'disabled' }, tts: { started: false, reason: 'disabled' } };
  }

  const asr = await startSomaliAsr(settings, logger, waitForReady);
  const tts = await startSomaliTts(settings, logger, waitForReady);

  return { asr, tts };
}

function killChild(child, logger, label) {
  if (!child) return;
  logger.info(`[${label}] Stopping…`);
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { shell: true });
    } else {
      child.kill('SIGTERM');
    }
  } catch (err) {
    logger.warn(`[${label}] Stop failed: ${err.message}`);
  }
}

function stopSomaliSpeech(logger = console) {
  if (ownedAsr) killChild(asrChild, logger, 'somali-asr');
  if (ownedTts) killChild(ttsChild, logger, 'somali-tts');
  asrChild = null;
  ttsChild = null;
  ownedAsr = false;
  ownedTts = false;
}

module.exports = { startSomaliSpeech, stopSomaliSpeech, isServiceHealthy };
