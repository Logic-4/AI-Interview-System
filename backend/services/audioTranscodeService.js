const os = require('os');
const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * Transcodes a WebM/Opus (or any ffmpeg-readable) audio buffer into a
 * 16-bit PCM WAV buffer — the format Gemini's audio understanding expects.
 */
async function transcodeToWav(buffer, suffix = '.webm') {
  const tmpDir = os.tmpdir();
  const id = crypto.randomBytes(8).toString('hex');
  const inputPath = path.join(tmpDir, `stt-in-${id}${suffix}`);
  const outputPath = path.join(tmpDir, `stt-out-${id}.wav`);

  await fs.writeFile(inputPath, buffer);
  try {
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .audioChannels(1)
        .audioFrequency(16000)
        .audioCodec('pcm_s16le')
        .format('wav')
        .on('error', reject)
        .on('end', resolve)
        .save(outputPath);
    });
    return await fs.readFile(outputPath);
  } finally {
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});
  }
}

module.exports = { transcodeToWav };
