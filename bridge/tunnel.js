/**
 * TUNNEL RUNNER — exposes the local bridge to the internet via Cloudflare
 * Quick Tunnel, then auto-registers the public URL in the GAS backend
 * (action: updateBridgeUrl) so WhatsApp messages route to this machine.
 *
 * Usage: node tunnel.js   (requires cloudflared.exe next to this file, and .env)
 */
require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 3001;
const GAS_URL = process.env.GAS_SCRIPT_URL;
const API_KEY = process.env.BRIDGE_API_KEY;

if (!GAS_URL || !API_KEY) {
    console.error('❌ GAS_SCRIPT_URL and BRIDGE_API_KEY must be set in bridge/.env');
    process.exit(1);
}

if (!GAS_URL.startsWith('https://script.google.com/macros/s/')) {
    console.error('❌ Set a valid GAS_SCRIPT_URL in bridge/.env before running tunnel.');
    process.exit(1);
}

const exe = path.join(__dirname, 'cloudflared.exe');
console.log(`🚇 Starting Cloudflare quick tunnel → http://localhost:${PORT} ...`);

const proc = spawn(exe, ['tunnel', '--url', `http://localhost:${PORT}`], { stdio: ['ignore', 'pipe', 'pipe'] });

let registered = false;

async function register(url) {
    if (registered) return;
    registered = true;
    console.log(`\n🌍 Public tunnel URL: ${url}`);
    console.log('📡 Registering URL in GAS backend...');
    try {
        const res = await fetch(GAS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'updateBridgeUrl',
                authToken: API_KEY,
                payload: { url, hostname: os.hostname(), tunnelType: 'cloudflared' },
                url, hostname: os.hostname(), tunnelType: 'cloudflared'
            }),
            redirect: 'follow'
        });
        const text = await res.text();
        console.log(`✅ GAS response: ${text.slice(0, 300)}`);
        console.log('\n🟢 Tunnel is live. Keep this window open while testing.');
    } catch (e) {
        console.error('❌ Failed to register bridge URL in GAS:', e.message);
        console.error(`   You can set it manually in Settings: WHATSAPP_BRIDGE_URL = ${url}`);
    }
}

function scan(chunk) {
    const m = String(chunk).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (m) register(m[0]);
}

proc.stdout.on('data', scan);
proc.stderr.on('data', (d) => { scan(d); });

proc.on('exit', (code) => {
    console.log(`🔴 cloudflared exited with code ${code}`);
    process.exit(code || 0);
});
