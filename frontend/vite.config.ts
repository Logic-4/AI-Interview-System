import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import dotenv from 'dotenv';

// Load workspace root environment variables
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

export default defineConfig({
    plugins: [react()],
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
