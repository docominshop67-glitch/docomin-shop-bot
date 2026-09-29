const http = require('http');

/**
 * เริ่มต้น HTTP Web Server สำหรับแสดงสถานะ Dashboard และรองรับ Cloud Free Hosting (Render, Koyeb, Railway, Replit)
 * ป้องกันไม่ให้ Cloud Service หลับ (Keep-Alive 24/7)
 */
function startWebServer(client) {
    const PORT = process.env.PORT || 3000;

    const server = http.createServer((req, res) => {
        // Health check endpoint สำหรับ Uptime Monitor / Render Health Check
        if (req.url === '/ping' || req.url === '/healthz' || req.url === '/uptime') {
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            });
            return res.end(JSON.stringify({
                status: 'ok',
                botOnline: client ? client.isReady() : false,
                uptime: process.uptime(),
                ping: client && client.ws ? client.ws.ping : 0,
                timestamp: Date.now()
            }));
        }

        // หน้า Web Status Dashboard สวยงาม
        const isReady = client && client.isReady();
        const botName = isReady ? client.user.tag : 'กำลังเชื่อมต่อ Discord...';
        const botAvatar = isReady ? client.user.displayAvatarURL({ dynamic: true }) : 'https://cdn-icons-png.flaticon.com/512/5968/5968756.png';
        const guildCount = isReady ? client.guilds.cache.size : 0;
        const userCount = isReady ? client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0) : 0;
        const pingMs = isReady && client.ws ? client.ws.ping : 0;

        const uptimeSeconds = Math.floor(process.uptime());
        const days = Math.floor(uptimeSeconds / (3600 * 24));
        const hours = Math.floor((uptimeSeconds % (3600 * 24)) / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const seconds = uptimeSeconds % 60;
        const uptimeString = `${days} วัน ${hours} ชม. ${minutes} นาที ${seconds} วิ`;

        const html = `<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Docomin Shop & Community Bot — สถานะออนไลน์ 24/7</title>
    <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;600;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Kanit', sans-serif; }
        body { background: #0c0e17; color: #f8fafc; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; }
        .card { background: #151828; border: 1px solid rgba(255,255,255,0.08); border-radius: 24px; padding: 40px; max-width: 640px; width: 100%; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.6); text-align: center; }
        .header { display: flex; flex-direction: column; align-items: center; gap: 12px; margin-bottom: 25px; }
        .avatar { width: 85px; height: 85px; border-radius: 50%; border: 3px solid #57F287; box-shadow: 0 0 20px rgba(87, 242, 135, 0.4); object-fit: cover; }
        .badge { display: inline-flex; align-items: center; gap: 8px; background: rgba(87, 242, 135, 0.15); color: #57F287; padding: 6px 18px; border-radius: 50px; font-weight: 600; font-size: 14px; border: 1px solid rgba(87, 242, 135, 0.3); }
        .dot { width: 10px; height: 10px; background: #57F287; border-radius: 50%; box-shadow: 0 0 10px #57F287; animation: pulse 2s infinite; }
        @keyframes pulse { 0% { opacity: 0.5; } 50% { opacity: 1; } 100% { opacity: 0.5; } }
        h1 { font-size: 26px; font-weight: 700; margin-top: 5px; background: linear-gradient(135deg, #ffffff, #93c5fd); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        p.subtitle { color: #94a3b8; font-size: 15px; margin-top: 4px; }
        .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin: 25px 0; text-align: left; }
        .stat-item { background: #1c2035; padding: 14px 18px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.04); }
        .stat-label { font-size: 13px; color: #94a3b8; margin-bottom: 4px; }
        .stat-value { font-size: 17px; font-weight: 600; color: #f8fafc; }
        .features { text-align: left; background: #111320; padding: 20px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.04); }
        .features h3 { font-size: 13px; color: #93c5fd; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
        .feature-tags { display: flex; flex-wrap: wrap; gap: 8px; }
        .tag { background: #1a1e33; color: #cbd5e1; font-size: 12px; padding: 6px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.06); }
        .footer { margin-top: 25px; color: #64748b; font-size: 13px; }
        .ping-link { display: inline-block; margin-top: 15px; color: #60a5fa; text-decoration: none; font-size: 13px; }
        .ping-link:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="card">
        <div class="header">
            <img class="avatar" src="${botAvatar}" alt="Bot Avatar">
            <div class="badge"><div class="dot"></div> ออนไลน์พร้อมทำงาน 24 ชั่วโมง</div>
            <h1>Docomin Shop & Community Bot</h1>
            <p class="subtitle">ระบบร้านค้าครบวงจร • สต็อกผลปีศาจเรียลไทม์ • ปัญญาประดิษฐ์ AI</p>
        </div>

        <div class="stats-grid">
            <div class="stat-item">
                <div class="stat-label">🤖 ชื่อบอท (Identity)</div>
                <div class="stat-value">${botName}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">⚡ ความเร็วตอบสนอง (Ping)</div>
                <div class="stat-value">${pingMs} ms</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">⏱️ รันต่อเนื่อง (Uptime)</div>
                <div class="stat-value">${uptimeString}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">🏠 เซิร์ฟเวอร์ที่ดูแล (Guilds)</div>
                <div class="stat-value">${guildCount} เซิร์ฟเวอร์ (${userCount.toLocaleString()} สมาชิก)</div>
            </div>
        </div>

        <div class="features">
            <h3>ระบบที่เปิดทำงานเบื้องหลัง 24 ชั่วโมง (83 คำสั่ง)</h3>
            <div class="feature-tags">
                <span class="tag">🛒 Docomin Shop</span>
                <span class="tag">💳 PromptPay EMVCo QR</span>
                <span class="tag">⭐ Vouch & Reputation</span>
                <span class="tag">🍎 Blox Fruits Stock (เรียลไทม์)</span>
                <span class="tag">⚖️ Trade Calculator</span>
                <span class="tag">🎙️ Voice Master</span>
                <span class="tag">💰 Economy & Role Shop</span>
                <span class="tag">🛡️ Verification Gate</span>
                <span class="tag">🌐 Web Uptime Keep-Alive</span>
                <span class="tag">✨ Gemini 3.8 Flash AI</span>
            </div>
        </div>

        <a class="ping-link" href="/healthz" target="_blank">🔍 ตรวจสอบ JSON Healthz Endpoint</a>
        <div class="footer">
            Powered by Node.js & Discord.js v14 • Host on Render / Koyeb / Cloud 24/7
        </div>
    </div>
</body>
</html>`;

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
    });

    server.listen(PORT, '0.0.0.0', () => {
        console.log(`🌐 Web Status Server เปิดทำงานแล้วที่พอร์ต ${PORT} (พร้อมสำหรับ Render / Koyeb / Cloud 24/7)`);
    });

    return server;
}

module.exports = { startWebServer };
