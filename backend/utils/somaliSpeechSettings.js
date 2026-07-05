const fs = require('fs');
const { execFileSync } = require('child_process');
const path = require('path');

function isWorkingPython(pythonPath) {
  if (!pythonPath) return false;
  const parts = String(pythonPath).trim().split(/\s+/);
  const cmd = parts[0];
  const baseArgs = parts.slice(1);
  const isPath = cmd.includes('/') || cmd.includes('\\');
  if (isPath && !fs.existsSync(cmd)) return false;
  try {
    execFileSync(cmd, [...baseArgs, '--version'], {
      stdio: 'ignore',
      timeout: 8000,
      windowsHide: true,
      shell: process.platform === 'win32' && !isPath,
    });
    return true;
  } catch {
    return false;
  }
}

function tryCommand(command, args = []) {
  try {
    execFileSync(command, args, { stdio: 'ignore', timeout: 8000, shell: process.platform === 'win32' });
    return true;
  } catch {
    return false;
  }
}

function parsePortFromUrl(url, fallback) {
  if (!url || !String(url).trim()) return fallback;
  try {
    const parsed = new URL(String(url).trim());
    if (parsed.port) return parseInt(parsed.port, 10);
    return parsed.protocol === 'https:' ? 443 : 80;
  } catch {
    return fallback;
  }
}

function trimBaseUrl(url) {
  return (url || '').trim().replace(/\/+$/, '');
}

function resolvePython(explicit, candidates) {
  if (explicit && String(explicit).trim()) {
    const p = String(explicit).trim();
    if (isWorkingPython(p)) return p;
  }

  for (const candidate of candidates) {
    if (isWorkingPython(candidate)) return candidate;
  }

  if (process.platform === 'win32') {
    if (tryCommand('py', ['-3.12', '--version'])) return 'py -3.12';
    if (tryCommand('py', ['-3', '--version'])) return 'py -3';
  }
  if (tryCommand('python3', ['--version'])) return 'python3';
  if (tryCommand('python', ['--version'])) return 'python';

  return explicit && String(explicit).trim() ? String(explicit).trim() : 'python';
}

function splitPythonCommand(python) {
  const parts = String(python).trim().split(/\s+/);
  return { cmd: parts[0], baseArgs: parts.slice(1) };
}

function getSomaliSpeechSettings() {
  const repoRoot = path.resolve(__dirname, '../..');
  const asrUrl = trimBaseUrl(process.env.SOMALI_ASR_URL || 'http://127.0.0.1:8001');
  const ttsUrl = trimBaseUrl(process.env.SOMALI_TTS_URL || 'http://127.0.0.1:8002');
  const asrPort = parsePortFromUrl(asrUrl, 8001);
  const ttsPort = parsePortFromUrl(ttsUrl, 8002);

  const venvCandidates = process.platform === 'win32'
    ? [
      path.join(repoRoot, 'Models', '.venv', 'Scripts', 'python.exe'),
      path.join(repoRoot, 'Models', 'Skydheere', '.venv', 'Scripts', 'python.exe'),
      path.join(repoRoot, 'Models', 'tts-service', '.venv', 'Scripts', 'python.exe'),
    ]
    : [
      path.join(repoRoot, 'Models', '.venv', 'bin', 'python'),
      path.join(repoRoot, 'Models', 'Skydheere', '.venv', 'bin', 'python'),
      path.join(repoRoot, 'Models', 'tts-service', '.venv', 'bin', 'python'),
    ];

  const defaultPython = resolvePython(process.env.SOMALI_PYTHON, venvCandidates);
  const asrPython = resolvePython(process.env.SOMALI_ASR_PYTHON || process.env.SOMALI_PYTHON, venvCandidates) || defaultPython;
  const ttsPython = resolvePython(process.env.SOMALI_TTS_PYTHON || process.env.SOMALI_PYTHON, venvCandidates) || defaultPython;

  const autoStart = process.env.SOMALI_AUTO_START === 'true';

  return {
    repoRoot,
    asrUrl,
    ttsUrl,
    asrPort,
    ttsPort,
    asrPython,
    ttsPython,
    autoStart,
    modelsDir: path.join(repoRoot, 'Models'),
    ttsDir: path.join(repoRoot, 'Models', 'tts-service'),
  };
}

module.exports = { getSomaliSpeechSettings, parsePortFromUrl, trimBaseUrl, splitPythonCommand, isWorkingPython };
