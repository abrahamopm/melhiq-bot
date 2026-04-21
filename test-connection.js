const fetch = require('node-fetch');
const HttpsProxyAgent = require('https-proxy-agent');
require('dotenv').config();

async function test() {
    console.log('🔍 Starting Connection Diagnostic...');
    
    const url = 'https://api.telegram.org';
    const proxy = process.env.HTTPS_PROXY;
    
    const options = {};
    if (proxy) {
        console.log(`📡 Testing with proxy: ${proxy}`);
        options.agent = new HttpsProxyAgent(proxy);
    } else {
        console.log('🌐 Testing direct connection (No proxy)...');
    }

    try {
        const start = Date.now();
        const res = await fetch(url, { ...options, timeout: 5000 });
        const duration = Date.now() - start;
        console.log(`✅ Success! Reached Telegram in ${duration}ms`);
        console.log(`📡 Status: ${res.status} ${res.statusText}`);
    } catch (err) {
        console.error(`❌ Connection Failed: ${err.message}`);
        if (err.code === 'ETIMEDOUT') {
            console.log('\n💡 SUGGESTION: Your network is blocking Telegram.');
            console.log('1. Open your VPN/Proxy app.');
            console.log('2. Find the "HTTP Proxy" port.');
            console.log('3. Add HTTPS_PROXY=http://127.0.0.1:PORT to your .env file.');
        }
    }
}

test();
