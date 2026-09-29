const http = require('http');
const https = require('https');
const db = require('./db');

function pingUrl(targetUrl) {
    return new Promise((resolve) => {
        let parsed;
        try {
            parsed = new URL(targetUrl);
        } catch {
            return resolve({ success: false, statusCode: 0, responseTime: 0, error: 'URL ไม่ถูกต้อง' });
        }

        const client = parsed.protocol === 'https:' ? https : http;
        const startTime = Date.now();

        const req = client.request(parsed, {
            method: 'GET',
            timeout: 10000,
            headers: {
                'User-Agent': 'DiscordBot-UptimePinger/1.0'
            },
            rejectUnauthorized: false
        }, res => {
            const responseTime = Date.now() - startTime;
            resolve({
                success: res.statusCode >= 200 && res.statusCode < 400,
                statusCode: res.statusCode,
                responseTime,
                error: null
            });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({
                success: false,
                statusCode: 408,
                responseTime: Date.now() - startTime,
                error: 'Request Timeout'
            });
        });

        req.on('error', err => {
            resolve({
                success: false,
                statusCode: 0,
                responseTime: Date.now() - startTime,
                error: err.message
            });
        });

        req.end();
    });
}

async function pingAll() {
    const urls = db.getUptimeUrls();
    if (!urls || urls.length === 0) return;

    for (const item of urls) {
        try {
            const res = await pingUrl(item.url);
            db.updateUptimeStats(item.url, {
                status: res.success ? 'online' : 'offline',
                statusCode: res.statusCode,
                responseTime: res.responseTime,
                lastPing: Date.now(),
                totalPings: (item.totalPings || 0) + 1,
                lastError: res.error
            });
        } catch (e) {
            console.error('Error pinging url:', item.url, e);
        }
    }
}

let timer = null;

const uptime = {
    start() {
        if (timer) return;
        // ปิงครั้งแรกทันที
        pingAll();
        // ปิงซ้ำทุก 2 นาที (120,000 ms) เพื่อให้ออนตลอด 24 ชม.
        timer = setInterval(pingAll, 120000);
        console.log('🌐 ระบบ Web Uptime Monitor เริ่มทำงานแล้ว (ปิงทุก 2 นาที)');
    },

    async add(url, userId) {
        let validUrl = url.trim();
        if (!validUrl.startsWith('http://') && !validUrl.startsWith('https://')) {
            validUrl = 'https://' + validUrl;
        }

        const testPing = await pingUrl(validUrl);
        const data = {
            url: validUrl,
            addedBy: userId,
            addedAt: Date.now(),
            status: testPing.success ? 'online' : 'offline',
            statusCode: testPing.statusCode,
            responseTime: testPing.responseTime,
            lastPing: Date.now(),
            totalPings: 1
        };

        const added = db.addUptimeUrl(data);
        return { success: added, data, testPing };
    },

    remove(url) {
        let target = url.trim();
        if (!target.startsWith('http://') && !target.startsWith('https://')) {
            target = 'https://' + target;
        }
        return db.removeUptimeUrl(target);
    },

    list() {
        return db.getUptimeUrls();
    }
};

module.exports = uptime;
