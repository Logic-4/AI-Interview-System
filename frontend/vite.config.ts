import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import dotenv from 'dotenv';

// Load workspace root environment variables
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

export default defineConfig({
    plugins: [
        react(),
        {
            name: 'tts-middleware',
            configureServer(server) {
                server.middlewares.use(async (req, res, next) => {
                    if (req.url?.startsWith('/api/tts') && req.method === 'POST') {
                        let bodyStr = '';
                        req.on('data', chunk => { bodyStr += chunk; });
                        req.on('end', async () => {
                            try {
                                const { text, languageCode = 'en-US' } = JSON.parse(bodyStr);
                                const isSomali = languageCode.toLowerCase().startsWith("so");
                                
                                const voice = (isSomali ? process.env.PIPER_SO_VOICE : process.env.PIPER_EN_VOICE) || "";
                                const piperUrl = (process.env.PIPER_BASE_URL || 'http://localhost:5001').replace(/\/+$/, "");
                                
                                const body: Record<string, any> = { text, length_scale: 1 };
                                if (voice.trim()) {
                                    body.voice = voice.trim();
                                }
                                
                                const fetchResponse = await fetch(`${piperUrl}/`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(body),
                                });
                                
                                if (!fetchResponse.ok) {
                                    res.statusCode = fetchResponse.status;
                                    res.end(await fetchResponse.text());
                                    return;
                                }
                                
                                const audioBuffer = await fetchResponse.arrayBuffer();
                                res.setHeader('Content-Type', fetchResponse.headers.get('content-type') || 'audio/wav');
                                res.setHeader('Cache-Control', 'no-store, max-age=0');
                                res.end(Buffer.from(audioBuffer));
                            } catch (err: any) {
                                res.statusCode = 503;
                                res.end(JSON.stringify({ error: err.message }));
                            }
                        });
                    } else {
                        next();
                    }
                });
            }
        }
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@revamp-assets': path.resolve(__dirname, '../pixel-alchemy-revamp/src/assets'),
        },
    },
    define: {
        'process.env': {
            NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || `${process.env.API_BASE_URL || 'http://localhost:5000'}/api/v1`,
            NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL || process.env.API_BASE_URL || 'http://localhost:5000',
        }
    },
    server: {
        port: 3000
    }
});
