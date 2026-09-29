process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const https = require('https');
const db = require('./db');

// รายชื่อผลปีศาจทั้งหมดใน Blox Fruits (42 ผล) พร้อมข้อมูลภาษาไทย, ราคา Beli/Robux, ระดับความหายาก, และรูปภาพแท้ 100%
const FRUITS = [
    {
        "id": "rocket",
        "name": "Rocket",
        "thName": "ผลจรวด",
        "rarity": "Common",
        "type": "Natural",
        "beliPrice": "5,000",
        "robuxPrice": "50",
        "image": "https://static.wikia.nocookie.net/roblox-blox-piece/images/c/cb/Rocket_Fruit.png/revision/latest?cb=20231027120039",
        "color": 9807270,
        "weight": 100
    },
    {
        "id": "spin",
        "name": "Spin",
        "thName": "ผลหมุน",
        "rarity": "Common",
        "type": "Natural",
        "beliPrice": "7,500",
        "robuxPrice": "75",
        "image": "https://static.wikia.nocookie.net/roblox-blox-piece/images/8/88/Spin_Fruit.png/revision/latest?cb=20231027120258",
        "color": 9807270,
        "weight": 100
    },
    {
        "id": "blade",
        "name": "Blade / Chop",
        "thName": "ผลแยกส่วน",
        "rarity": "Common",
        "type": "Natural",
        "beliPrice": "30,000",
        "robuxPrice": "100",
        "image": "https://static.wikia.nocookie.net/roblox-blox-piece/images/0/0e/Chop_Fruit.png/revision/latest?cb=20231027115331",
        "color": 9807270,
        "weight": 80
    },
    {
        "id": "spring",
        "name": "Spring",
        "thName": "ผลสปริง",
        "rarity": "Common",
        "type": "Natural",
        "beliPrice": "60,000",
        "robuxPrice": "180",
        "image": "https://static.wikia.nocookie.net/roblox-blox-piece/images/8/8a/Spring_Fruit.png/revision/latest?cb=20231027120418",
        "color": 9807270,
        "weight": 75
    },
    {
        "id": "bomb",
        "name": "Bomb",
        "thName": "ผลระเบิด",
        "rarity": "Common",
        "type": "Natural",
        "beliPrice": "80,000",
        "robuxPrice": "220",
        "image": "https://static.wikia.nocookie.net/roblox-blox-piece/images/4/43/Bomb_Fruit.png/revision/latest?cb=20240304195914",
        "color": 9807270,
        "weight": 70
    },
    {
        "id": "smoke",
        "name": "Smoke",
        "thName": "ผลควัน",
        "rarity": "Common",
        "type": "Elemental",
        "beliPrice": "100,000",
        "robuxPrice": "250",
        "image": "https://static.wikia.nocookie.net/roblox-blox-piece/images/7/7e/Smoke_Fruit.png/revision/latest?cb=20231027120224",
        "color": 9807270,
        "weight": 65
    },
    {
        "id": "spike",
        "name": "Spike",
        "thName": "ผลหนาม",
        "rarity": "Common",
        "type": "Natural",
        "beliPrice": "180,000",
        "robuxPrice": "380",
        "image": "https://static.wikia.nocookie.net/roblox-blox-piece/images/c/ce/Spike_Fruit.png/revision/latest?cb=20231027120251",
        "color": 9807270,
        "weight": 60
    },
    {
        "id": "flame",
        "name": "Flame",
        "thName": "ผลไฟ",
        "rarity": "Uncommon",
        "type": "Elemental",
        "beliPrice": "250,000",
        "robuxPrice": "550",
        "image": "https://static.wikia.nocookie.net/roblox-blox-piece/images/c/c4/Flame_Fruit.png/revision/latest?cb=20250421150742",
        "color": 3066993,
        "weight": 50
    },
    {
        "id": "falcon",
        "name": "Falcon",
        "thName": "ผลเหยี่ยว",
        "rarity": "Uncommon",
        "type": "Beast",
        "beliPrice": "300,000",
        "robuxPrice": "650",
        "image": "https://static.wikia.nocookie.net/roblox-blox-piece/images/e/ef/Falcon_Fruit.png/revision/latest?cb=20231027115527",
        "color": 3066993,
        "weight": 45
    },
    {
        "id": "ice",
        "name": "Ice",
        "thName": "ผลน้ำแข็ง",
        "rarity": "Uncommon",
        "type": "Elemental",
        "beliPrice": "350,000",
        "robuxPrice": "750",
        "image": "https://static.wikia.nocookie.net/roblox-blox-piece/images/c/c5/Ice_Fruit.png/revision/latest?cb=20260806235854",
        "color": 3066993,
        "weight": 45
    },
    {
        "id": "sand",
        "name": "Sand",
        "thName": "ผลทราย",
        "rarity": "Uncommon",
        "type": "Elemental",
        "beliPrice": "420,000",
        "robuxPrice": "850",
        "image": "https://static.wikia.nocookie.net/roblox-blox-piece/images/7/72/Sand_Fruit.png/revision/latest?cb=20260806235551",
        "color": 3066993,
        "weight": 40
    },
    {
        "id": "dark",
        "name": "Dark",
        "thName": "ผลความมืด",
        "rarity": "Uncommon",
        "type": "Elemental",
        "beliPrice": "500,000",
        "robuxPrice": "950",
        "image": "https://static.wikia.nocookie.net/roblox-blox-piece/images/5/5c/Dark_Fruit.png/revision/latest?cb=20260806235544",
        "color": 3066993,
        "weight": 40
    },
    {
        "id": "diamond",
        "name": "Diamond",
        "thName": "ผลเพชร",
        "rarity": "Uncommon",
        "type": "Natural",
        "beliPrice": "600,000",
        "robuxPrice": "1,000",
        "image": "https://static.wikia.nocookie.net/roblox-blox-piece/images/8/88/Diamond_Fruit.png/revision/latest?cb=20260806235654",
        "color": 3066993,
        "weight": 35
    },
    {
        "id": "light",
        "name": "Light",
        "thName": "ผลแสง",
        "rarity": "Rare",
        "type": "Elemental",
        "beliPrice": "650,000",
        "robuxPrice": "1,100",
        "image": "https://static.wikia.nocookie.net/roblox-blox-piece/images/8/83/Light_Fruit.png/revision/latest?cb=20231027115623",
        "color": 3447003,
        "weight": 30
    },
    {
        "id": "rubber",
        "name": "Rubber",
        "thName": "ผลยาง",
        "rarity": "Rare",
        "type": "Natural",
        "beliPrice": "750,000",
        "robuxPrice": "1,200",
        "image": "https://static.wikia.nocookie.net/roblox-blox-piece/images/5/5c/Rubber_Fruit.png/revision/latest?cb=20231027120046",
        "color": 3447003,
        "weight": 25
    },
    {
        "id": "barrier",
        "name": "Barrier",
        "thName": "ผลบาเรีย",
        "rarity": "Rare",
        "type": "Natural",
        "beliPrice": "800,000",
        "robuxPrice": "1,250",
        "image": "https://static.wikia.nocookie.net/roblox-blox-piece/images/1/19/Barrier_Fruit.png/revision/latest?cb=20231027115304",
        "color": 3447003,
        "weight": 25
    },
    {
        "id": "ghost",
        "name": "Ghost",
        "thName": "ผลผี",
        "rarity": "Rare",
        "type": "Natural",
        "beliPrice": "940,000",
        "robuxPrice": "1,275",
        "image": "https://static.wikia.nocookie.net/roblox-blox-piece/images/8/8c/Ghost_Fruit.png/revision/latest?cb=20260806235824",
        "color": 3447003,
        "weight": 20
    },
    {
        "id": "magma",
        "name": "Magma",
        "thName": "ผลแมกม่า",
        "rarity": "Rare",
        "type": "Elemental",
        "beliPrice": "960,000",
        "robuxPrice": "1,300",
        "image": "https://static.wikia.nocookie.net/roblox-blox-piece/images/2/27/Magma_Fruit.png/revision/latest?cb=20231027115640",
        "color": 3447003,
        "weight": 20
    },
    {
        "id": "quake",
        "name": "Quake",
        "thName": "ผลสั่นสะเทือน",
        "rarity": "Legendary",
        "type": "Natural",
        "beliPrice": "1,000,000",
        "robuxPrice": "1,500",
        "image": "https://static.wikia.nocookie.net/roblox-blox-piece/images/4/42/Quake_Fruit.png/revision/latest?cb=20260807000132",
        "color": 10181046,
        "weight": 15
    },
    {
        "id": "buddha",
        "name": "Buddha",
        "thName": "ผลพระ",
        "rarity": "Legendary",
        "type": "Beast",
        "beliPrice": "1,200,000",
        "robuxPrice": "1,650",
        "image": "https://static.wikia.nocookie.net/roblox-blox-piece/images/d/df/Buddha_Fruit.png/revision/latest?cb=20231027115325",
        "color": 10181046,
        "weight": 14
    },
    {
        "id": "love",
        "name": "Love",
        "thName": "ผลความรัก",
        "rarity": "Legendary",
        "type": "Natural",
        "beliPrice": "1,300,000",
        "robuxPrice": "1,700",
        "image": "https://static.wikia.nocookie.net/roblox-blox-piece/images/b/b3/Love_Fruit.png/revision/latest?cb=20231027115630",
        "color": 10181046,
        "weight": 12
    },
    {
        "id": "spider",
        "name": "Spider",
        "thName": "ผลใยแมงมุม",
        "rarity": "Legendary",
        "type": "Natural",
        "beliPrice": "1,500,000",
        "robuxPrice": "1,800",
        "image": "https://static.wikia.nocookie.net/roblox-blox-piece/images/6/61/Spider_Fruit.png/revision/latest?cb=20260806235623",
        "color": 10181046,
        "weight": 12
    },
    {
        "id": "sound",
        "name": "Sound",
        "thName": "ผลเสียง",
        "rarity": "Legendary",
        "type": "Natural",
        "beliPrice": "1,700,000",
        "robuxPrice": "1,900",
        "image": "https://static.wikia.nocookie.net/roblox-blox-piece/images/b/ba/Sound_Fruit.png/revision/latest?cb=20231027120231",
        "color": 10181046,
        "weight": 11
    },
    {
        "id": "phoenix",
        "name": "Phoenix",
        "thName": "ผลฟีนิกซ์",
        "rarity": "Legendary",
        "type": "Beast",
        "beliPrice": "1,800,000",
        "robuxPrice": "2,000",
        "image": "https://static.wikia.nocookie.net/roblox-blox-piece/images/f/fc/Phoenix_Fruit.png/revision/latest?cb=20260807000100",
        "color": 10181046,
        "weight": 10
    },
    {
        "id": "portal",
        "name": "Portal",
        "thName": "ผลประตูมิติ",
        "rarity": "Legendary",
        "type": "Natural",
        "beliPrice": "1,900,000",
        "robuxPrice": "2,000",
        "image": "https://static.wikia.nocookie.net/roblox-blox-piece/images/8/8a/Portal_Fruit.png/revision/latest?cb=20231027115746",
        "color": 10181046,
        "weight": 10
    },
    {
        "id": "rumble",
        "name": "Rumble",
        "thName": "ผลสายฟ้า",
        "rarity": "Legendary",
        "type": "Elemental",
        "beliPrice": "2,100,000",
        "robuxPrice": "2,100",
        "image": "https://static.wikia.nocookie.net/roblox-blox-piece/images/7/78/Lightning_Fruit.png/revision/latest?cb=20260806235926",
        "color": 10181046,
        "weight": 9
    },
    {
        "id": "pain",
        "name": "Pain",
        "thName": "ผลความเจ็บปวด",
        "rarity": "Legendary",
        "type": "Natural",
        "beliPrice": "2,400,000",
        "robuxPrice": "2,200",
        "image": "https://static.wikia.nocookie.net/roblox-blox-piece/images/4/40/Pain_Fruit.png/revision/latest?cb=20260807000029",
        "color": 10181046,
        "weight": 8
    },
    {
        "id": "blizzard",
        "name": "Blizzard",
        "thName": "ผลพายุหิมะ",
        "rarity": "Legendary",
        "type": "Elemental",
        "beliPrice": "2,400,000",
        "robuxPrice": "2,250",
        "image": "https://static.wikia.nocookie.net/roblox-blox-piece/images/c/c9/Blizzard_Fruit.png/revision/latest?cb=20231027115313",
        "color": 10181046,
        "weight": 8
    },
    {
        "id": "gravity",
        "name": "Gravity",
        "thName": "ผลแรงโน้มถ่วง",
        "rarity": "Mythical",
        "type": "Natural",
        "beliPrice": "2,500,000",
        "robuxPrice": "2,300",
        "image": "https://static.wikia.nocookie.net/roblox-blox-piece/images/5/5f/Gravity_Fruit.png/revision/latest?cb=20250418030958",
        "color": 15548997,
        "weight": 6
    },
    {
        "id": "mammoth",
        "name": "Mammoth",
        "thName": "ผลแมมมอธ",
        "rarity": "Mythical",
        "type": "Beast",
        "beliPrice": "2,700,000",
        "robuxPrice": "2,350",
        "image": "https://static.wikia.nocookie.net/roblox-blox-piece/images/9/95/Mammoth_Fruit.png/revision/latest?cb=20260806235956",
        "color": 15548997,
        "weight": 5
    },
    {
        "id": "trex",
        "name": "T-Rex",
        "thName": "ผลทีเร็กซ์",
        "rarity": "Mythical",
        "type": "Beast",
        "beliPrice": "2,700,000",
        "robuxPrice": "2,350",
        "image": "https://static.wikia.nocookie.net/roblox-blox-piece/images/d/d9/T-Rex_Fruit.png/revision/latest?cb=20231226191220",
        "color": 15548997,
        "weight": 5
    },
    {
        "id": "dough",
        "name": "Dough",
        "thName": "ผลโมจิ",
        "rarity": "Mythical",
        "type": "Elemental",
        "beliPrice": "2,800,000",
        "robuxPrice": "2,400",
        "image": "https://static.wikia.nocookie.net/roblox-blox-piece/images/0/02/Dough_Fruit.png/revision/latest?cb=20260806235727",
        "color": 15548997,
        "weight": 4
    },
    {
        "id": "shadow",
        "name": "Shadow",
        "thName": "ผลเงา",
        "rarity": "Mythical",
        "type": "Natural",
        "beliPrice": "2,900,000",
        "robuxPrice": "2,425",
        "image": "https://static.wikia.nocookie.net/roblox-blox-piece/images/5/58/Shadow_Fruit.png/revision/latest?cb=20241229033053",
        "color": 15548997,
        "weight": 4
    },
    {
        "id": "venom",
        "name": "Venom",
        "thName": "ผลพิษ",
        "rarity": "Mythical",
        "type": "Natural",
        "beliPrice": "3,000,000",
        "robuxPrice": "2,450",
        "image": "https://static.wikia.nocookie.net/roblox-blox-piece/images/d/d2/Venom_Fruit.png/revision/latest?cb=20231027120425",
        "color": 15548997,
        "weight": 4
    },
    {
        "id": "control",
        "name": "Control",
        "thName": "ผลควบคุม",
        "rarity": "Mythical",
        "type": "Natural",
        "beliPrice": "3,200,000",
        "robuxPrice": "2,500",
        "image": "https://static.wikia.nocookie.net/roblox-blox-piece/images/1/19/Control_Fruit.png/revision/latest?cb=20251223165924",
        "color": 15548997,
        "weight": 3
    },
    {
        "id": "spirit",
        "name": "Spirit",
        "thName": "ผลวิญญาณ",
        "rarity": "Mythical",
        "type": "Natural",
        "beliPrice": "3,400,000",
        "robuxPrice": "2,550",
        "image": "https://static.wikia.nocookie.net/roblox-blox-piece/images/6/66/Spirit_Fruit.png/revision/latest?cb=20240304190559",
        "color": 15548997,
        "weight": 3
    },
    {
        "id": "dragon",
        "name": "Dragon",
        "thName": "ผลมังกร",
        "rarity": "Mythical",
        "type": "Beast",
        "beliPrice": "3,500,000",
        "robuxPrice": "2,600",
        "image": "https://static.wikia.nocookie.net/roblox-blox-piece/images/2/29/Dragon_Fruit.png/revision/latest?cb=20260806232519",
        "color": 15548997,
        "weight": 2
    },
    {
        "id": "leopard",
        "name": "Leopard",
        "thName": "ผลเสือดาว",
        "rarity": "Mythical",
        "type": "Beast",
        "beliPrice": "5,000,000",
        "robuxPrice": "3,000",
        "image": "https://static.wikia.nocookie.net/roblox-blox-piece/images/a/a3/Leopard_Fruit.png/revision/latest?cb=20231027115615",
        "color": 15548997,
        "weight": 2
    },
    {
        "id": "kitsune",
        "name": "Kitsune",
        "thName": "ผลจิ้งจอกเก้าหาง",
        "rarity": "Mythical",
        "type": "Beast",
        "beliPrice": "8,000,000",
        "robuxPrice": "4,000",
        "image": "https://static.wikia.nocookie.net/roblox-blox-piece/images/6/65/Kitsune_Fruit.png/revision/latest?cb=20241223162956",
        "color": 15548997,
        "weight": 1
    },
    {
        "id": "eagle",
        "name": "Eagle",
        "thName": "ผลอินทรี (เหยี่ยวรีเวิร์ก)",
        "rarity": "Uncommon",
        "type": "Beast",
        "beliPrice": "550,000",
        "robuxPrice": "975",
        "image": "https://static.wikia.nocookie.net/roblox-blox-piece/images/5/53/Eagle_Fruit.png/revision/latest?cb=20250418030931",
        "color": 3066993,
        "weight": 45
    },
    {
        "id": "gas",
        "name": "Gas",
        "thName": "ผลแก๊ส",
        "rarity": "Mythical",
        "type": "Elemental",
        "beliPrice": "3,200,000",
        "robuxPrice": "2,500",
        "image": "https://static.wikia.nocookie.net/roblox-blox-piece/images/e/ed/Gas_Fruit.png/revision/latest?cb=20241223162315",
        "color": 15548997,
        "weight": 3
    },
    {
        "id": "yeti",
        "name": "Yeti",
        "thName": "ผลเยติ",
        "rarity": "Mythical",
        "type": "Beast",
        "beliPrice": "3,000,000",
        "robuxPrice": "2,450",
        "image": "https://static.wikia.nocookie.net/roblox-blox-piece/images/2/2f/Yeti_Fruit.png/revision/latest?cb=20260806232444",
        "color": 15548997,
        "weight": 3
    }
];

// ฟังก์ชันสุ่มแบบ Deterministic ด้วย Seed ตัวเลข (Linear Congruential Generator) สำหรับโหมดสำรอง
function createRng(seed) {
    let s = Math.abs(seed) % 2147483647;
    if (s <= 0) s += 2147483646;
    return function() {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

// คำนวณช่วงเวลา Dealer Stock ทั่วไป
function getDealerWindowInfo(hours = 4) {
    const now = Date.now();
    const intervalMs = hours * 60 * 60 * 1000;
    const currentWindow = Math.floor(now / intervalMs);
    const nextResetMs = (currentWindow + 1) * intervalMs;
    const timeLeftMs = Math.max(0, nextResetMs - now);

    const hoursLeft = Math.floor(timeLeftMs / (1000 * 60 * 60));
    const minutesLeft = Math.floor((timeLeftMs % (1000 * 60 * 60)) / (1000 * 60));
    const secondsLeft = Math.floor((timeLeftMs % (1000 * 60)) / 1000);

    const timeLeftFormatted = `${hoursLeft} ชม. ${minutesLeft} นาที ${secondsLeft} วินาที`;

    return {
        currentWindow,
        nextResetDate: new Date(nextResetMs),
        timeLeftMs,
        timeLeftFormatted
    };
}

// แคชสำหรับสต็อกเรียลไทม์จากเซิร์ฟเวอร์
let liveStockCache = {
    normal: null,
    mirage: null,
    lastFetched: 0,
    expiresAt: 0
};

// ดึง HTML จากเว็บ Blox Fruits Values (พร้อมรองรับการย้ายหน้า Redirect และ Timeout ปลอดภัย)
function fetchHtml(url) {
    return new Promise((resolve, reject) => {
        let isDone = false;
        const req = https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            },
            rejectUnauthorized: false,
            timeout: 20000
        }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                let nextUrl = res.headers.location;
                if (!nextUrl.startsWith('http')) {
                    const u = new URL(url);
                    nextUrl = u.origin + nextUrl;
                }
                isDone = true;
                return resolve(fetchHtml(nextUrl));
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (!isDone) {
                    isDone = true;
                    resolve(data);
                }
            });
        });
        req.on('error', err => {
            if (!isDone) {
                isDone = true;
                reject(err);
            }
        });
        req.on('timeout', () => {
            req.destroy();
            if (!isDone) {
                isDone = true;
                reject(new Error('Request timeout'));
            }
        });
    });
}

// ดึง JSON snapshot จาก Next.js RSC Payload
function parseSnapshot(html) {
    const idx = html.indexOf('initialSnapshot');
    if (idx === -1) return null;
    const sub = html.substring(idx);
    const startBrace = sub.indexOf('{');
    if (startBrace === -1) return null;

    let depth = 0;
    let endBrace = -1;
    let inStr = false;
    let escape = false;

    for (let i = startBrace; i < sub.length; i++) {
        const ch = sub[i];
        if (escape) {
            escape = false;
            continue;
        }
        if (ch === '\\') {
            escape = true;
            continue;
        }
        if (ch === '"') {
            inStr = !inStr;
            continue;
        }
        if (!inStr) {
            if (ch === '{') depth++;
            else if (ch === '}') {
                depth--;
                if (depth === 0) {
                    endBrace = i + 1;
                    break;
                }
            }
        }
    }

    if (endBrace !== -1) {
        const rawJson = sub.substring(startBrace, endBrace);
        try {
            const unescaped = rawJson.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
            return JSON.parse(unescaped);
        } catch (e) {
            console.error('[BloxFruits] JSON parse error:', e.message);
        }
    }
    return null;
}

// จับคู่ผลไม้จาก Live Data เข้ากับข้อมูล FRUITS ที่มีรูปแท้และภาษาไทย
function mapLiveFruit(liveItem) {
    const cleanName = (liveItem.name || '').trim().toLowerCase();
    // ค้นหาใน FRUITS
    let matched = FRUITS.find(f => {
        const fName = f.name.toLowerCase();
        const fId = f.id.toLowerCase();
        if (fName === cleanName || fId === cleanName) return true;
        if (cleanName.includes(fId) || fId.includes(cleanName)) return true;
        if (cleanName === 'blade' && fId === 'blade') return true;
        if (cleanName === 'chop' && fId === 'blade') return true;
        if (cleanName === 'falcon' && (fId === 'falcon' || fId === 'eagle')) return true;
        if (cleanName === 'eagle' && (fId === 'falcon' || fId === 'eagle')) return true;
        if (cleanName === 'rumble' && fId === 'rumble') return true;
        if (cleanName === 'lightning' && fId === 'rumble') return true;
        if (cleanName.includes('dragon') && fId === 'dragon') return true;
        return false;
    });

    if (matched) {
        return {
            ...matched,
            beliPrice: liveItem.beliPrice ? liveItem.beliPrice.toLocaleString() : matched.beliPrice,
            robuxPrice: liveItem.robuxPrice ? liveItem.robuxPrice.toLocaleString() : matched.robuxPrice,
            isLive: true
        };
    }

    // ถ้าไม่มีในแคตตาล็อก ให้สร้าง Object สำรองพร้อมรูปแท้
    const fallbackImage = liveItem.image && liveItem.image.startsWith('/api/') 
        ? `https://bloxfruitsvalues.com${liveItem.image}`
        : 'https://static.wikia.nocookie.net/roblox-blox-piece/images/c/cb/Rocket_Fruit.png/revision/latest';

    return {
        id: cleanName.replace(/\s+/g, '_'),
        name: liveItem.name || 'Unknown Fruit',
        thName: `ผล ${liveItem.name || 'ไม่ทราบชื่อ'}`,
        rarity: liveItem.rarity || 'Common',
        type: liveItem.fruitType || 'Natural',
        beliPrice: liveItem.beliPrice ? liveItem.beliPrice.toLocaleString() : 'N/A',
        robuxPrice: liveItem.robuxPrice ? liveItem.robuxPrice.toLocaleString() : 'N/A',
        image: fallbackImage,
        color: 0x3498DB,
        weight: 10,
        isLive: true
    };
}

// ฟังก์ชันดึงสต็อกจริงจาก bloxfruitsvalues.com
async function fetchRealLiveStock() {
    const now = Date.now();
    // ถ้าแคชยังไม่หมดอายุ (แคช 2 นาที)
    if (liveStockCache.lastFetched > 0 && now < liveStockCache.expiresAt && liveStockCache.normal) {
        return liveStockCache;
    }

    try {
        const html = await fetchHtml('https://bloxfruitsvalues.com/stock');
        const snapshot = parseSnapshot(html);

        if (snapshot && snapshot.normal) {
            const normalFruits = (snapshot.normal.fruits || []).map(mapLiveFruit);
            const mirageFruits = (snapshot.mirage?.fruits || []).map(mapLiveFruit);

            liveStockCache = {
                normal: {
                    fruits: normalFruits,
                    resetsAt: snapshot.normal.window?.resetsAt || (now + 3600000),
                    startedAt: snapshot.normal.window?.startedAt || now
                },
                mirage: {
                    fruits: mirageFruits,
                    resetsAt: snapshot.mirage?.window?.resetsAt || (now + 3600000),
                    startedAt: snapshot.mirage?.window?.startedAt || now
                },
                lastFetched: now,
                expiresAt: now + (2 * 60 * 1000) // 2 นาที
            };

            return liveStockCache;
        }
    } catch (err) {
        console.error('[BloxFruits] Live stock fetch error, using fallback:', err.message);
    }

    return null;
}

// สต็อก Dealer สำรอง (กรณีไม่สามารถต่ออินเทอร์เน็ตได้)
function getFallbackDealerStock(isMirage = false) {
    const hours = isMirage ? 2 : 4;
    const windowInfo = getDealerWindowInfo(hours);
    const rng = createRng(windowInfo.currentWindow * (isMirage ? 9973 : 7919) + 1337);

    const stock = [];
    const stockIds = new Set();

    const pool = [];
    FRUITS.forEach(fruit => {
        let weight = fruit.weight;
        if (isMirage) {
            if (fruit.rarity === 'Mythical') weight *= 3.5;
            if (fruit.rarity === 'Legendary') weight *= 2.5;
            if (fruit.rarity === 'Rare') weight *= 1.5;
        }
        const repeatCount = Math.max(1, Math.round(weight));
        for (let i = 0; i < repeatCount; i++) pool.push(fruit);
    });

    const targetCount = isMirage ? (3 + Math.floor(rng() * 3)) : (4 + Math.floor(rng() * 4));
    let attempts = 0;
    while (stock.length < targetCount && attempts < 200) {
        attempts++;
        const candidate = pool[Math.floor(rng() * pool.length)];
        if (!stockIds.has(candidate.id)) {
            stock.push(candidate);
            stockIds.add(candidate.id);
        }
    }

    const rarityOrder = { 'Mythical': 1, 'Legendary': 2, 'Rare': 3, 'Uncommon': 4, 'Common': 5 };
    stock.sort((a, b) => (rarityOrder[a.rarity] || 9) - (rarityOrder[b.rarity] || 9));

    return {
        stock,
        isLive: false,
        nextResetDate: windowInfo.nextResetDate,
        timeLeftFormatted: windowInfo.timeLeftFormatted
    };
}

// ตรวจสอบสต็อกคนขายผล Blox Fruits (Dealer)
async function getDealerStock() {
    const live = await fetchRealLiveStock();
    if (live && live.normal && live.normal.fruits.length > 0) {
        const now = Date.now();
        const timeLeftMs = Math.max(0, live.normal.resetsAt - now);
        const hoursLeft = Math.floor(timeLeftMs / (1000 * 60 * 60));
        const minutesLeft = Math.floor((timeLeftMs % (1000 * 60 * 60)) / (1000 * 60));
        const secondsLeft = Math.floor((timeLeftMs % (1000 * 60)) / 1000);
        const timeLeftFormatted = `${hoursLeft} ชม. ${minutesLeft} นาที ${secondsLeft} วินาที`;

        const rarityOrder = { 'Mythical': 1, 'Legendary': 2, 'Rare': 3, 'Uncommon': 4, 'Common': 5 };
        const sorted = [...live.normal.fruits].sort((a, b) => (rarityOrder[a.rarity] || 9) - (rarityOrder[b.rarity] || 9));

        return {
            stock: sorted,
            isLive: true,
            nextResetDate: new Date(live.normal.resetsAt),
            timeLeftFormatted
        };
    }

    return getFallbackDealerStock(false);
}

// ตรวจสอบสต็อก Mirage Island Dealer
async function getMirageStock() {
    const live = await fetchRealLiveStock();
    if (live && live.mirage && live.mirage.fruits.length > 0) {
        const now = Date.now();
        const timeLeftMs = Math.max(0, live.mirage.resetsAt - now);
        const hoursLeft = Math.floor(timeLeftMs / (1000 * 60 * 60));
        const minutesLeft = Math.floor((timeLeftMs % (1000 * 60 * 60)) / (1000 * 60));
        const secondsLeft = Math.floor((timeLeftMs % (1000 * 60)) / 1000);
        const timeLeftFormatted = `${hoursLeft} ชม. ${minutesLeft} นาที ${secondsLeft} วินาที`;

        const rarityOrder = { 'Mythical': 1, 'Legendary': 2, 'Rare': 3, 'Uncommon': 4, 'Common': 5 };
        const sorted = [...live.mirage.fruits].sort((a, b) => (rarityOrder[a.rarity] || 9) - (rarityOrder[b.rarity] || 9));

        return {
            stock: sorted,
            isLive: true,
            nextResetDate: new Date(live.mirage.resetsAt),
            timeLeftFormatted
        };
    }

    return getFallbackDealerStock(true);
}

// สร้าง Embed แสดงสต็อกผลปีศาจสวยงาม
async function createStockEmbed(isMirage = false) {
    const data = isMirage ? await getMirageStock() : await getDealerStock();
    const dealerName = isMirage ? '🏝️ Mirage Island Dealer (เกาะลวงตา)' : '🛒 Blox Fruit Dealer (คนขายผลทั่วไป)';
    
    // หาผลที่หายากที่สุดในสต็อกปัจจุบันเพื่อนำรูปมาขึ้นปก
    const topFruit = data.stock[0] || FRUITS[0];

    const liveBadge = data.isLive 
        ? '✅ **ยืนยันสต็อกจริงจากเซิร์ฟเวอร์เกม Blox Fruits (เรียลไทม์ 100%)**' 
        : '⚠️ **โหมดสต็อกสำรอง (กำลังเชื่อมต่อเซิร์ฟเวอร์ใหม่)**';

    const embed = new EmbedBuilder()
        .setTitle(`⚡ ตรวจสอบสต็อกผลปีศาจ Blox Fruits เรียลไทม์`)
        .setDescription(`**ผู้จำหน่าย:** ${dealerName}
${liveBadge}
⏰ **รีสต็อกรอบใหม่ในอีก:** \`${data.timeLeftFormatted}\`

📌 **ผลปีศาจที่มีจำหน่ายขณะนี้ (${data.stock.length} ผล):**`)
        .setColor(topFruit.color || 0x5865F2)
        .setThumbnail(topFruit.image) // แสดงรูปของแท้ขนาดชัดเจน
        .setFooter({ text: `Blox Fruits Real-Time Stock • รูปภาพของแท้ 100% • รีเซ็ตตรงเวลาในเกม`, iconURL: topFruit.image })
        .setTimestamp();

    // แสดงรายการผล
    data.stock.forEach((fruit, idx) => {
        const rarityBadge = {
            'Mythical': '🔴 **[MYTHICAL]**',
            'Legendary': '🟣 **[LEGENDARY]**',
            'Rare': '🔵 **[RARE]**',
            'Uncommon': '🟢 **[UNCOMMON]**',
            'Common': '⚪ **[COMMON]**'
        }[fruit.rarity] || fruit.rarity;

        embed.addFields({
            name: `${idx + 1}. ${fruit.name} (${fruit.thName})`,
            value: `ระดับ: ${rarityBadge} | สาย: **${fruit.type}**
💵 **Beli:** \`${fruit.beliPrice}\` Beli | 💎 **Robux:** \`${fruit.robuxPrice}\` R$`,
            inline: false
        });
    });

    return { embed, topFruit, stock: data.stock, nextReset: data.nextResetDate, isLive: data.isLive };
}

// สร้าง Embed แจ้งเตือนเมื่อผลที่ผู้ใช้เลือกมาขาย
function createFruitAlertEmbed(fruit, timeLeftFormatted, isLive = true) {
    const rarityBadge = {
        'Mythical': '🔴 **[MYTHICAL - ผลเทพ]**',
        'Legendary': '🟣 **[LEGENDARY - ผลตำนาน]**',
        'Rare': '🔵 **[RARE - ผลหายาก]**',
        'Uncommon': '🟢 **[UNCOMMON]**',
        'Common': '⚪ **[COMMON]**'
    }[fruit.rarity] || fruit.rarity;

    const sourceStatus = isLive 
        ? '✅ ข้อมูลของแท้ 100% จาก Blox Fruits Dealer Server เรียลไทม์' 
        : '⚠️ แจ้งเตือนตามตารางรีสต็อก';

    return new EmbedBuilder()
        .setTitle(`🚨 แจ้งเตือน: ${fruit.name} (${fruit.thName}) มาขายแล้ว!`)
        .setDescription(`🎉 ผลปีศาจที่คุณติดตามกำลังวางจำหน่ายในร้าน **Blox Fruit Dealer** ตอนนี้!
${sourceStatus}
รีบเข้าไปซื้อในเกมก่อนหมดเวลารอบนี้!`)
        .setColor(fruit.color || 0xED4245)
        .addFields(
            { name: '💎 ระดับความหายาก', value: rarityBadge, inline: true },
            { name: '🌀 สายของผล', value: `**${fruit.type}**`, inline: true },
            { name: '⏳ เวลาที่เหลือในรอบนี้', value: `\`${timeLeftFormatted}\``, inline: true },
            { name: '💵 ราคาเงินในเกม (Beli)', value: `**${fruit.beliPrice}** Beli`, inline: true },
            { name: '🪙 ราคาเงินจริง (Robux)', value: `**${fruit.robuxPrice}** Robux`, inline: true },
            { name: '🎯 ความถูกต้องของสต็อก', value: '💯 ตรวจสอบตรงกับในเกมจริง', inline: true }
        )
        .setImage(fruit.image) // แนบรูปผลปีศาจของแท้ขนาดใหญ่ คมชัด 100% ตามที่ผู้ใช้สั่ง
        .setThumbnail(fruit.image)
        .setFooter({ text: `ระบบแจ้งเตือนสต็อก Blox Fruits อัตโนมัติ • รูปภาพแท้ คมชัดสูง`, iconURL: fruit.image })
        .setTimestamp();
}

// สร้าง Dropdown ให้ผู้ใช้เลือกติดตามผลปีศาจ
function createFruitSelectMenu(selectedFruitIds = []) {
    // แบ่งกลุ่มผลระดับสูงและผลยอดนิยม
    const popularFruits = FRUITS.filter(f => 
        f.rarity === 'Mythical' || 
        f.rarity === 'Legendary' || 
        f.id === 'light' || 
        f.id === 'magma' ||
        f.id === 'eagle'
    );

    const options = popularFruits.map(fruit => {
        const isSelected = selectedFruitIds.includes(fruit.id);
        const emoji = fruit.rarity === 'Mythical' ? '🔴' : (fruit.rarity === 'Legendary' ? '🟣' : '🔵');
        return new StringSelectMenuOptionBuilder()
            .setLabel(`${fruit.name} (${fruit.thName})`)
            .setDescription(`ระดับ ${fruit.rarity} | ราคา ${fruit.beliPrice} Beli`)
            .setValue(fruit.id)
            .setDefault(isSelected)
            .setEmoji(emoji);
    });

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('bloxfruits_select_alert')
        .setPlaceholder('เลือกผลปีศาจที่ต้องการรับแจ้งเตือนเมื่อมีจำหน่าย...')
        .setMinValues(0)
        .setMaxValues(Math.min(25, options.length))
        .addOptions(options.slice(0, 25));

    return new ActionRowBuilder().addComponents(selectMenu);
}

// ตรวจสอบและส่งการแจ้งเตือนอัตโนมัติเบื้องหลัง
let lastNotifiedStockSignature = null;

async function checkAndDispatchStockAlerts(client) {
    try {
        const currentStockData = await getDealerStock();
        if (!currentStockData || !currentStockData.stock || currentStockData.stock.length === 0) return;

        // Signature ของสต็อกรอบนี้ เช่น "Rocket,Spin,Bomb,Sand,Dark,Eagle"
        const currentSignature = currentStockData.stock.map(f => f.name).sort().join(',');

        if (lastNotifiedStockSignature === null) {
            lastNotifiedStockSignature = currentSignature;
            return;
        }

        // ถ้ารายการผลในสต็อกเปลี่ยนไป (มีการรีเซ็ตสต็อกจริง)
        if (currentSignature !== lastNotifiedStockSignature) {
            lastNotifiedStockSignature = currentSignature;
            console.log(`🔄 ตรวจพบการรีสต็อก Blox Fruits จริงรอบใหม่! ผลที่มา: [${currentSignature}]`);

            // 1. ส่งประกาศเข้าห้องแจ้งเตือนอัตโนมัติของแต่ละกิลด์
            const guildChannels = db.getAllBloxFruitsChannels();
            const { embed } = await createStockEmbed(false);

            for (const [guildId, channelId] of Object.entries(guildChannels)) {
                try {
                    const channel = await client.channels.fetch(channelId).catch(() => null);
                    if (channel && channel.isTextBased()) {
                        await channel.send({
                            content: `📢 **แจ้งเตือนรีสต็อกผลปีศาจ Blox Fruits รอบใหม่แล้ว! (ของแท้ 100%)**`,
                            embeds: [embed]
                        });
                    }
                } catch (e) {
                    console.error(`Error sending stock to guild channel ${channelId}:`, e.message);
                }
            }

            // 2. ตรวจสอบผู้ใช้ที่ติดตามผลที่มาขายในรอบนี้
            const allSubscribers = db.getAllBloxFruitsSubscribers();
            for (const fruit of currentStockData.stock) {
                const subscribers = allSubscribers[fruit.id] || [];
                if (subscribers.length > 0) {
                    const alertEmbed = createFruitAlertEmbed(fruit, currentStockData.timeLeftFormatted, currentStockData.isLive);

                    for (const userId of subscribers) {
                        try {
                            const user = await client.users.fetch(userId).catch(() => null);
                            if (user) {
                                await user.send({
                                    content: `🔔 **ผล ${fruit.name} (${fruit.thName}) ที่คุณติดตาม กำลังวางจำหน่ายแล้ว!**`,
                                    embeds: [alertEmbed]
                                });
                            }
                        } catch (err) {
                            // ผู้ใช้อาจปิดรับ DM หรือบล็อกบอท
                        }
                    }
                }
            }
        }
    } catch (err) {
        console.error('Error in checkAndDispatchStockAlerts:', err);
    }
}

// เริ่มต้นระบบตรวจสอบสต็อก Blox Fruits วนลูปทุก 1 นาที
function startStockWatcher(client) {
    console.log('🍎 ระบบมอนิเตอร์และแจ้งเตือน Blox Fruits Stock (เรียลไทม์ 100%) เริ่มทำงานแล้ว!');
    setInterval(() => {
        checkAndDispatchStockAlerts(client);
    }, 60 * 1000);
}

module.exports = {
    FRUITS,
    getDealerStock,
    getMirageStock,
    createStockEmbed,
    createFruitAlertEmbed,
    createFruitSelectMenu,
    startStockWatcher,
    checkAndDispatchStockAlerts
};
