const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'database.json');

function loadDB() {
    try {
        if (!fs.existsSync(DB_FILE)) {
            const initialData = {
                users: {},
                settings: {},
                tickets: {},
                giveaways: {},
                uptimeUrls: [],
                warnings: {},
                levels: {},
                afk: {},
                bloxfruitsAlerts: {},
                bloxfruitsChannels: {},
                automod: {},
                voiceMaster: {},
                tempVoices: {},
                verification: {},
                shop: {},
                vouches: [],
                products: {},
                paymentConfig: {},
                coupons: {},
                orderTickets: {},
                shopSettings: {},
                sales: [],
                blacklist: {},
                restockSubscribers: {}
            };
            fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf8');
            return initialData;
        }
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        const data = JSON.parse(raw);
        data.users = data.users || {};
        data.settings = data.settings || {};
        data.tickets = data.tickets || {};
        data.giveaways = data.giveaways || {};
        data.uptimeUrls = data.uptimeUrls || [];
        data.warnings = data.warnings || {};
        data.levels = data.levels || {};
        data.afk = data.afk || {};
        data.bloxfruitsAlerts = data.bloxfruitsAlerts || {};
        data.bloxfruitsChannels = data.bloxfruitsChannels || {};
        data.automod = data.automod || {};
        data.voiceMaster = data.voiceMaster || {};
        data.tempVoices = data.tempVoices || {};
        data.verification = data.verification || {};
        data.shop = data.shop || {};
        data.vouches = data.vouches || [];
        data.products = data.products || {};
        data.paymentConfig = data.paymentConfig || {};
        data.coupons = data.coupons || {};
        data.orderTickets = data.orderTickets || {};
        data.shopSettings = data.shopSettings || {};
        data.sales = data.sales || [];
        data.blacklist = data.blacklist || {};
        data.restockSubscribers = data.restockSubscribers || {};
        data.productKeys = data.productKeys || {};
        data.customerRoles = data.customerRoles || {};
        return data;
    } catch (e) {
        console.error('Error loading DB:', e);
        return {
            users: {},
            settings: {},
            tickets: {},
            giveaways: {},
            uptimeUrls: [],
            warnings: {},
            levels: {},
            afk: {},
            bloxfruitsAlerts: {},
            bloxfruitsChannels: {},
            automod: {},
            voiceMaster: {},
            tempVoices: {},
            verification: {},
            shop: {},
            vouches: [],
            products: {},
            paymentConfig: {},
            coupons: {},
            orderTickets: {},
            shopSettings: {},
            sales: [],
            blacklist: {},
            restockSubscribers: {}
        };
    }
}

function saveDB(data) {
    try {
        const tmpFile = `${DB_FILE}.tmp`;
        fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf8');
        fs.renameSync(tmpFile, DB_FILE);
    } catch (e) {
        try {
            fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
        } catch (err) {
            console.error('Error saving DB:', err);
        }
    }
}

const db = {
    // ผู้ใช้ & กระเป๋าเงิน
    getUser(userId) {
        const data = loadDB();
        if (!data.users[userId]) {
            data.users[userId] = {
                coins: 0,
                bank: 0,
                lastDaily: null,
                lastWork: null,
                lastRob: null,
                robloxUsername: null,
                robloxId: null
            };
            saveDB(data);
        } else {
            // เติมฟิลด์เริ่มต้นถ้ายังไม่มี
            if (data.users[userId].bank === undefined) data.users[userId].bank = 0;
            if (data.users[userId].lastWork === undefined) data.users[userId].lastWork = null;
            if (data.users[userId].lastRob === undefined) data.users[userId].lastRob = null;
        }
        return data.users[userId];
    },

    updateUser(userId, fields) {
        const data = loadDB();
        if (!data.users[userId]) {
            data.users[userId] = { coins: 0, bank: 0, lastDaily: null, lastWork: null, lastRob: null, robloxUsername: null, robloxId: null };
        }
        data.users[userId] = { ...data.users[userId], ...fields };
        saveDB(data);
        return data.users[userId];
    },

    addCoins(userId, amount) {
        const user = this.getUser(userId);
        user.coins = (user.coins || 0) + amount;
        return this.updateUser(userId, { coins: user.coins });
    },

    // ธนาคาร (ฝาก/ถอน)
    deposit(userId, amount) {
        const user = this.getUser(userId);
        const wallet = user.coins || 0;
        const toDeposit = amount === 'all' ? wallet : parseInt(amount, 10);

        if (isNaN(toDeposit) || toDeposit <= 0) return { success: false, error: 'จำนวนเงินไม่ถูกต้อง' };
        if (wallet < toDeposit) return { success: false, error: 'คุณมีเงินสดในกระเป๋าไม่เพียงพอ' };

        const newWallet = wallet - toDeposit;
        const newBank = (user.bank || 0) + toDeposit;

        this.updateUser(userId, { coins: newWallet, bank: newBank });
        return { success: true, deposited: toDeposit, wallet: newWallet, bank: newBank };
    },

    withdraw(userId, amount) {
        const user = this.getUser(userId);
        const bank = user.bank || 0;
        const toWithdraw = amount === 'all' ? bank : parseInt(amount, 10);

        if (isNaN(toWithdraw) || toWithdraw <= 0) return { success: false, error: 'จำนวนเงินไม่ถูกต้อง' };
        if (bank < toWithdraw) return { success: false, error: 'คุณมีเงินในบัญชีธนาคารไม่เพียงพอ' };

        const newWallet = (user.coins || 0) + toWithdraw;
        const newBank = bank - toWithdraw;

        this.updateUser(userId, { coins: newWallet, bank: newBank });
        return { success: true, withdrawn: toWithdraw, wallet: newWallet, bank: newBank };
    },

    // ทำงาน (Work) ทุก 30 นาที
    canWork(userId) {
        const user = this.getUser(userId);
        const cooldown = 30 * 60 * 1000;
        const now = Date.now();
        if (user.lastWork && (now - user.lastWork) < cooldown) {
            return { allowed: false, timeLeft: cooldown - (now - user.lastWork) };
        }
        return { allowed: true, timeLeft: 0 };
    },

    doWork(userId) {
        const check = this.canWork(userId);
        if (!check.allowed) return { success: false, timeLeft: check.timeLeft };

        const jobs = [
            { name: 'พ่อค้าขายผลปีศาจ (Blox Fruits Merchant)', min: 350, max: 800 },
            { name: 'นักล่าค่าหัวทะเลสอง (Bounty Hunter)', min: 300, max: 750 },
            { name: 'กัปตันเรือโจรสลัด', min: 250, max: 650 },
            { name: 'โปรแกรมเมอร์บอท Discord', min: 300, max: 700 },
            { name: 'หมอประจำเรือแพทย์', min: 200, max: 600 },
            { name: 'นักลงดันเจี้ยนเรดเรซ V4', min: 400, max: 850 }
        ];

        const job = jobs[Math.floor(Math.random() * jobs.length)];
        const earned = Math.floor(Math.random() * (job.max - job.min + 1)) + job.min;

        const user = this.getUser(userId);
        const newCoins = (user.coins || 0) + earned;
        this.updateUser(userId, { coins: newCoins, lastWork: Date.now() });

        return { success: true, earned, jobName: job.name, totalCoins: newCoins };
    },

    // ปล้นเงิน (Rob) ทุก 1 ชั่วโมง
    canRob(userId) {
        const user = this.getUser(userId);
        const cooldown = 60 * 60 * 1000;
        const now = Date.now();
        if (user.lastRob && (now - user.lastRob) < cooldown) {
            return { allowed: false, timeLeft: cooldown - (now - user.lastRob) };
        }
        return { allowed: true, timeLeft: 0 };
    },

    doRob(robberId, victimId) {
        if (robberId === victimId) return { success: false, error: 'คุณไม่สามารถปล้นตัวเองได้!' };

        const check = this.canRob(robberId);
        if (!check.allowed) return { success: false, onCooldown: true, timeLeft: check.timeLeft };

        const robber = this.getUser(robberId);
        const victim = this.getUser(victimId);

        const robberWallet = robber.coins || 0;
        const victimWallet = victim.coins || 0;

        if (robberWallet < 300) {
            return { success: false, error: 'คุณต้องมีเงินสดในกระเป๋าอย่างน้อย **300 เหรียญ** เพื่อเป็นค่าประกันตัวหากถูกจับได้' };
        }

        if (victimWallet < 100) {
            return { success: false, error: 'เหยื่อคนนี้ไม่มีเงินสดติดตัวพอที่จะปล้น (เงินอยู่ในธนาคารปลอดภัย)' };
        }

        // อัตราสำเร็จ 45%
        const isSuccess = Math.random() < 0.45;
        this.updateUser(robberId, { lastRob: Date.now() });

        if (isSuccess) {
            // ปล้นได้ 20% ถึง 40% ของเงินสดเหยื่อ
            const percent = (Math.floor(Math.random() * 21) + 20) / 100;
            const stolen = Math.max(50, Math.floor(victimWallet * percent));

            this.updateUser(robberId, { coins: robberWallet + stolen });
            this.updateUser(victimId, { coins: Math.max(0, victimWallet - stolen) });

            return { success: true, stolen, victimId, robberId };
        } else {
            // โดนจับ เสียค่าปรับ 300 เหรียญให้เหยื่อ
            const fine = 300;
            this.updateUser(robberId, { coins: Math.max(0, robberWallet - fine) });
            this.updateUser(victimId, { coins: victimWallet + fine });

            return { success: false, caught: true, fine, victimId, robberId };
        }
    },

    // ร้านค้าเซิร์ฟเวอร์ (Role / Item Shop)
    getShopItems(guildId) {
        const data = loadDB();
        return data.shop?.[guildId] || [];
    },

    addShopItem(guildId, item) {
        const data = loadDB();
        data.shop = data.shop || {};
        data.shop[guildId] = data.shop[guildId] || [];
        const newItem = {
            id: 'item_' + Date.now(),
            name: item.name,
            price: parseInt(item.price, 10),
            roleId: item.roleId || null,
            description: item.description || '',
            createdAt: Date.now()
        };
        data.shop[guildId].push(newItem);
        saveDB(data);
        return newItem;
    },

    removeShopItem(guildId, itemId) {
        const data = loadDB();
        if (!data.shop?.[guildId]) return false;
        const initialLength = data.shop[guildId].length;
        data.shop[guildId] = data.shop[guildId].filter(i => i.id !== itemId);
        saveDB(data);
        return data.shop[guildId].length < initialLength;
    },

    buyShopItem(guildId, userId, itemId) {
        const items = this.getShopItems(guildId);
        const item = items.find(i => i.id === itemId);
        if (!item) return { success: false, error: 'ไม่พบสินค้านี้ในร้านค้า' };

        const user = this.getUser(userId);
        const wallet = user.coins || 0;
        if (wallet < item.price) {
            return { success: false, error: `คุณมีเหรียญไม่เพียงพอ (ต้องการ **${item.price.toLocaleString()}** เหรียญ แต่คุณมี **${wallet.toLocaleString()}** เหรียญ)` };
        }

        this.updateUser(userId, { coins: wallet - item.price });
        return { success: true, item, remainingCoins: wallet - item.price };
    },

    // ลีดเดอร์บอร์ดเศรษฐกิจ
    getLeaderboard(limit = 10) {
        const data = loadDB();
        const entries = Object.entries(data.users || {})
            .map(([id, u]) => ({
                id,
                coins: (u.coins || 0) + (u.bank || 0),
                wallet: u.coins || 0,
                bank: u.bank || 0,
                robloxUsername: u.robloxUsername
            }))
            .sort((a, b) => b.coins - a.coins)
            .slice(0, limit);
        return entries;
    },

    // Voice Master (สร้างห้องเสียงส่วนตัวอัตโนมัติ)
    getVoiceMaster(guildId) {
        const data = loadDB();
        return data.voiceMaster?.[guildId] || null;
    },

    setVoiceMaster(guildId, config) {
        const data = loadDB();
        data.voiceMaster = data.voiceMaster || {};
        data.voiceMaster[guildId] = { ...(data.voiceMaster[guildId] || {}), ...config };
        saveDB(data);
        return data.voiceMaster[guildId];
    },

    getTempVoice(channelId) {
        const data = loadDB();
        return data.tempVoices?.[channelId] || null;
    },

    setTempVoice(channelId, voiceData) {
        const data = loadDB();
        data.tempVoices = data.tempVoices || {};
        data.tempVoices[channelId] = voiceData;
        saveDB(data);
        return data.tempVoices[channelId];
    },

    removeTempVoice(channelId) {
        const data = loadDB();
        if (data.tempVoices?.[channelId]) {
            delete data.tempVoices[channelId];
            saveDB(data);
            return true;
        }
        return false;
    },

    getAllTempVoices() {
        const data = loadDB();
        return data.tempVoices || {};
    },

    // ประตูยืนยันตัวตน (Verification Gate)
    getVerification(guildId) {
        const data = loadDB();
        return data.verification?.[guildId] || null;
    },

    setVerification(guildId, config) {
        const data = loadDB();
        data.verification = data.verification || {};
        data.verification[guildId] = { ...(data.verification[guildId] || {}), ...config };
        saveDB(data);
        return data.verification[guildId];
    },

    // ตั๋ว (Tickets)
    createTicket(ticketId, guildId, channelId, userId) {
        const data = loadDB();
        data.tickets[ticketId] = { guildId, channelId, userId, createdAt: Date.now(), closed: false };
        saveDB(data);
        return data.tickets[ticketId];
    },

    getTicket(channelId) {
        const data = loadDB();
        return Object.values(data.tickets).find(t => t.channelId === channelId);
    },

    closeTicket(ticketId) {
        const data = loadDB();
        if (data.tickets[ticketId]) {
            data.tickets[ticketId].closed = true;
            data.tickets[ticketId].closedAt = Date.now();
            saveDB(data);
        }
    },

    // กิจกรรมแจกของ (Giveaways)
    createGiveaway(messageId, guildId, channelId, prize, winnersCount, endsAt, hostId) {
        const data = loadDB();
        data.giveaways[messageId] = {
            messageId,
            guildId,
            channelId,
            prize,
            winnersCount,
            endsAt,
            hostId,
            entries: [],
            ended: false
        };
        saveDB(data);
        return data.giveaways[messageId];
    },

    getGiveaway(messageId) {
        const data = loadDB();
        return data.giveaways[messageId] || null;
    },

    enterGiveaway(messageId, userId) {
        const data = loadDB();
        const g = data.giveaways[messageId];
        if (!g || g.ended) return false;
        if (!g.entries.includes(userId)) {
            g.entries.push(userId);
            saveDB(data);
            return true;
        }
        return false;
    },

    endGiveaway(messageId) {
        const data = loadDB();
        if (data.giveaways[messageId]) {
            data.giveaways[messageId].ended = true;
            saveDB(data);
        }
    },

    getActiveGiveaways() {
        const data = loadDB();
        const now = Date.now();
        return Object.values(data.giveaways).filter(g => !g.ended && g.endsAt <= now);
    },

    // Uptime URLs
    getUptimeUrls() {
        const data = loadDB();
        return data.uptimeUrls || [];
    },

    addUptimeUrl(url, userId) {
        const data = loadDB();
        if (!data.uptimeUrls.some(u => u.url === url)) {
            data.uptimeUrls.push({
                url,
                userId,
                addedAt: Date.now(),
                status: 'pending',
                lastPing: null,
                totalPings: 0,
                successPings: 0
            });
            saveDB(data);
            return true;
        }
        return false;
    },

    removeUptimeUrl(url) {
        const data = loadDB();
        const initLen = data.uptimeUrls.length;
        data.uptimeUrls = data.uptimeUrls.filter(u => u.url !== url);
        saveDB(data);
        return data.uptimeUrls.length < initLen;
    },

    updateUptimeUrl(url, updateData) {
        const data = loadDB();
        const target = data.uptimeUrls.find(u => u.url === url);
        if (target) {
            Object.assign(target, updateData);
            saveDB(data);
        }
    },

    updateUptimeStats(url, updateData) {
        return this.updateUptimeUrl(url, updateData);
    },

    // การตักเตือน (Warnings)
    addWarning(userId, moderatorId, reason) {
        const data = loadDB();
        data.warnings[userId] = data.warnings[userId] || [];
        const warnObj = {
            id: Date.now().toString(),
            moderatorId,
            reason,
            timestamp: Date.now()
        };
        data.warnings[userId].push(warnObj);
        saveDB(data);
        return warnObj;
    },

    getWarnings(userId) {
        const data = loadDB();
        return data.warnings[userId] || [];
    },

    clearWarnings(userId) {
        const data = loadDB();
        if (data.warnings[userId]) {
            const count = data.warnings[userId].length;
            delete data.warnings[userId];
            saveDB(data);
            return count;
        }
        return 0;
    },

    // เลเวลและค่าประสบการณ์ (Leveling)
    getLevel(userId) {
        const data = loadDB();
        return data.levels[userId] || { xp: 0, level: 1, lastMessage: 0 };
    },

    addXp(userId, amount) {
        const data = loadDB();
        const current = data.levels[userId] || { xp: 0, level: 1, lastMessage: 0 };
        current.xp += amount;
        
        let leveledUp = false;
        let nextLevelXp = current.level * 100 * 1.5;
        while (current.xp >= nextLevelXp) {
            current.level++;
            leveledUp = true;
            nextLevelXp = current.level * 100 * 1.5;
        }

        current.lastMessage = Date.now();
        data.levels[userId] = current;
        saveDB(data);

        return { current, leveledUp };
    },

    getLevelLeaderboard(limit = 10) {
        const data = loadDB();
        return Object.entries(data.levels || {})
            .map(([id, stats]) => ({ id, xp: stats.xp, level: stats.level }))
            .sort((a, b) => b.xp - a.xp)
            .slice(0, limit);
    },

    // สถานะ AFK
    setAfk(userId, reason) {
        const data = loadDB();
        data.afk[userId] = {
            reason: reason || 'AFK (ไม่อยู่)',
            timestamp: Date.now()
        };
        saveDB(data);
    },

    getAfk(userId) {
        const data = loadDB();
        return data.afk?.[userId] || null;
    },

    removeAfk(userId) {
        const data = loadDB();
        if (data.afk?.[userId]) {
            delete data.afk[userId];
            saveDB(data);
            return true;
        }
        return false;
    },

    // การตั้งค่าเซิร์ฟเวอร์
    getSettings(guildId) {
        const data = loadDB();
        return data.settings[guildId] || {};
    },

    setSettings(guildId, settings) {
        const data = loadDB();
        data.settings[guildId] = { ...(data.settings[guildId] || {}), ...settings };
        saveDB(data);
        return data.settings[guildId];
    },

    // ระบบแจ้งเตือน Blox Fruits
    getUserBloxFruitsAlerts(userId) {
        const data = loadDB();
        return data.bloxfruitsAlerts?.[userId] || [];
    },

    setUserBloxFruitsAlerts(userId, fruitIds) {
        const data = loadDB();
        data.bloxfruitsAlerts = data.bloxfruitsAlerts || {};
        data.bloxfruitsAlerts[userId] = fruitIds;
        saveDB(data);
        return fruitIds;
    },

    getAllBloxFruitsSubscribers() {
        const data = loadDB();
        const alerts = data.bloxfruitsAlerts || {};
        const map = {};
        for (const [userId, fruitList] of Object.entries(alerts)) {
            if (Array.isArray(fruitList)) {
                for (const fruitId of fruitList) {
                    if (!map[fruitId]) map[fruitId] = [];
                    map[fruitId].push(userId);
                }
            }
        }
        return map;
    },

    setBloxFruitsChannel(guildId, channelId) {
        const data = loadDB();
        data.bloxfruitsChannels = data.bloxfruitsChannels || {};
        data.bloxfruitsChannels[guildId] = channelId;
        saveDB(data);
    },

    getBloxFruitsChannel(guildId) {
        const data = loadDB();
        return data.bloxfruitsChannels?.[guildId] || null;
    },

    getAllBloxFruitsChannels() {
        const data = loadDB();
        return data.bloxfruitsChannels || {};
    },

    // ระบบ AutoMod
    getAutoMod(guildId) {
        const data = loadDB();
        return data.automod?.[guildId] || { antiInvite: true, antiSpam: true };
    },

    getAutomod(guildId) {
        return this.getAutoMod(guildId);
    },

    setAutoMod(guildId, config) {
        const data = loadDB();
        data.automod = data.automod || {};
        data.automod[guildId] = { ...(data.automod[guildId] || { antiInvite: true, antiSpam: true }), ...config };
        saveDB(data);
        return data.automod[guildId];
    },

    // ==========================================
    // DOCOMIN SHOP & REPUTATION SYSTEM
    // ==========================================

    // --- Vouch & Reputation (รีวิวและเครดิตร้านค้า) ---
    addVouch(vouch) {
        const data = loadDB();
        data.vouches = data.vouches || [];
        const newVouch = {
            id: `vouch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            sellerId: vouch.sellerId,
            buyerId: vouch.buyerId,
            buyerTag: vouch.buyerTag,
            guildId: vouch.guildId,
            stars: Math.max(1, Math.min(5, parseInt(vouch.stars) || 5)),
            comment: vouch.comment || 'ไม่มีความคิดเห็น',
            item: vouch.item || 'สินค้าทั่วไป',
            proofUrl: vouch.proofUrl || null,
            timestamp: Date.now()
        };
        data.vouches.push(newVouch);
        saveDB(data);
        return newVouch;
    },

    getVouches(filter = {}) {
        const data = loadDB();
        let list = data.vouches || [];
        if (filter.sellerId) {
            list = list.filter(v => v.sellerId === filter.sellerId);
        }
        if (filter.guildId) {
            list = list.filter(v => v.guildId === filter.guildId);
        }
        return list.sort((a, b) => b.timestamp - a.timestamp);
    },

    getVouchStats(sellerId) {
        const list = this.getVouches({ sellerId });
        const total = list.length;
        if (total === 0) {
            return {
                total: 0,
                average: 0,
                breakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
                recent: []
            };
        }
        const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        let sum = 0;
        for (const v of list) {
            const s = Math.max(1, Math.min(5, v.stars));
            breakdown[s] = (breakdown[s] || 0) + 1;
            sum += s;
        }
        const average = Number((sum / total).toFixed(1));
        return {
            total,
            average,
            breakdown,
            recent: list.slice(0, 5)
        };
    },

    setReviewChannel(guildId, channelId) {
        const data = loadDB();
        data.shopSettings = data.shopSettings || {};
        data.shopSettings[guildId] = data.shopSettings[guildId] || {};
        data.shopSettings[guildId].reviewChannelId = channelId;
        saveDB(data);
    },

    getReviewChannel(guildId) {
        const data = loadDB();
        return data.shopSettings?.[guildId]?.reviewChannelId || null;
    },

    // --- Payment Configuration (การตั้งค่าช่องทางชำระเงิน) ---
    setPaymentConfig(guildId, config) {
        const data = loadDB();
        data.paymentConfig = data.paymentConfig || {};
        data.paymentConfig[guildId] = {
            promptpay: config.promptpay || '',
            bankName: config.bankName || '',
            bankAccount: config.bankAccount || '',
            accountName: config.accountName || '',
            truemoney: config.truemoney || '',
            updatedAt: Date.now()
        };
        saveDB(data);
        return data.paymentConfig[guildId];
    },

    getPaymentConfig(guildId) {
        const data = loadDB();
        return data.paymentConfig?.[guildId] || null;
    },

    // --- Product Catalog (แคตตาล็อกสินค้า Docomin Shop) ---
    addProduct(guildId, product) {
        const data = loadDB();
        data.products = data.products || {};
        data.products[guildId] = data.products[guildId] || {};
        const pid = product.id.toUpperCase();
        data.products[guildId][pid] = {
            id: pid,
            name: product.name,
            price: Number(product.price) || 0,
            category: product.category || 'general',
            stock: parseInt(product.stock) || 0,
            description: product.description || 'ไม่มีรายละเอียดเพิ่มเติม',
            imageUrl: product.imageUrl || null,
            createdAt: Date.now()
        };
        saveDB(data);
        return data.products[guildId][pid];
    },

    getProduct(guildId, productId) {
        const data = loadDB();
        return data.products?.[guildId]?.[productId.toUpperCase()] || null;
    },

    getProducts(guildId, category = null) {
        const data = loadDB();
        const guildProducts = data.products?.[guildId] || {};
        const list = Object.values(guildProducts);
        if (category && category !== 'all') {
            return list.filter(p => p.category.toLowerCase() === category.toLowerCase());
        }
        return list;
    },

    updateProductStock(guildId, productId, newStock) {
        const data = loadDB();
        const pid = productId.toUpperCase();
        if (data.products?.[guildId]?.[pid]) {
            data.products[guildId][pid].stock = Math.max(0, parseInt(newStock) || 0);
            saveDB(data);
            return data.products[guildId][pid];
        }
        return null;
    },

    removeProduct(guildId, productId) {
        const data = loadDB();
        const pid = productId.toUpperCase();
        if (data.products?.[guildId]?.[pid]) {
            delete data.products[guildId][pid];
            saveDB(data);
            return true;
        }
        return false;
    },

    // --- Discount Coupons (คูปองส่วนลด) ---
    createCoupon(guildId, coupon) {
        const data = loadDB();
        data.coupons = data.coupons || {};
        data.coupons[guildId] = data.coupons[guildId] || {};
        const code = coupon.code.toUpperCase();
        data.coupons[guildId][code] = {
            code,
            discount: Number(coupon.discount) || 0,
            type: coupon.type || 'percent', // 'percent' หรือ 'fixed'
            minSpend: Number(coupon.minSpend) || 0,
            maxUses: parseInt(coupon.maxUses) || 0, // 0 = ไม่จำกัด
            usedCount: 0,
            users: [],
            createdAt: Date.now()
        };
        saveDB(data);
        return data.coupons[guildId][code];
    },

    getCoupon(guildId, code) {
        const data = loadDB();
        return data.coupons?.[guildId]?.[code.toUpperCase()] || null;
    },

    getCoupons(guildId) {
        const data = loadDB();
        return Object.values(data.coupons?.[guildId] || {});
    },

    useCoupon(guildId, code, userId) {
        const data = loadDB();
        const c = data.coupons?.[guildId]?.[code.toUpperCase()];
        if (!c) return { success: false, reason: 'ไม่พบคูปองนี้' };
        if (c.maxUses > 0 && c.usedCount >= c.maxUses) return { success: false, reason: 'คูปองนี้ถูกใช้จนครบสิทธิ์แล้ว' };
        if (c.users && c.users.includes(userId)) return { success: false, reason: 'คุณเคยใช้คูปองนี้ไปแล้ว' };
        
        c.usedCount = (c.usedCount || 0) + 1;
        c.users = c.users || [];
        c.users.push(userId);
        saveDB(data);
        return { success: true, coupon: c };
    },

    deleteCoupon(guildId, code) {
        const data = loadDB();
        const c = code.toUpperCase();
        if (data.coupons?.[guildId]?.[c]) {
            delete data.coupons[guildId][c];
            saveDB(data);
            return true;
        }
        return false;
    },

    // --- Multi-Category Order Tickets ---
    setOrderTicket(channelId, ticketData) {
        const data = loadDB();
        data.orderTickets = data.orderTickets || {};
        data.orderTickets[channelId] = {
            channelId,
            ...ticketData,
            createdAt: ticketData.createdAt || Date.now()
        };
        saveDB(data);
        return data.orderTickets[channelId];
    },

    getOrderTicket(channelId) {
        const data = loadDB();
        return data.orderTickets?.[channelId] || null;
    },

    closeOrderTicket(channelId) {
        const data = loadDB();
        if (data.orderTickets?.[channelId]) {
            data.orderTickets[channelId].closedAt = Date.now();
            data.orderTickets[channelId].status = 'closed';
            saveDB(data);
            return true;
        }
        return false;
    },

    // --- General Shop Settings ---
    getShopSettings(guildId) {
        const data = loadDB();
        return data.shopSettings?.[guildId] || {};
    },

    setShopSettings(guildId, settings) {
        const data = loadDB();
        data.shopSettings = data.shopSettings || {};
        data.shopSettings[guildId] = { ...(data.shopSettings[guildId] || {}), ...settings };
        saveDB(data);
        return data.shopSettings[guildId];
    },

    // --- Sales Analytics & Order History (บันทึกยอดขายและสถิติร้านค้า) ---
    recordSale(guildId, saleData) {
        const data = loadDB();
        data.sales = data.sales || [];
        const newSale = {
            id: `sale_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            guildId,
            orderId: saleData.orderId || null,
            customerId: saleData.customerId,
            customerTag: saleData.customerTag || 'Unknown',
            productId: saleData.productId || null,
            productName: saleData.productName || 'สินค้า',
            quantity: parseInt(saleData.quantity) || 1,
            originalAmount: Number(saleData.originalAmount) || 0,
            amount: Number(saleData.amount) || 0,
            discount: Number(saleData.discount) || 0,
            couponCode: saleData.couponCode || null,
            adminId: saleData.adminId || null,
            adminTag: saleData.adminTag || 'Admin',
            timestamp: Date.now()
        };
        data.sales.push(newSale);
        saveDB(data);
        return newSale;
    },

    getSales(guildId, limit = 50) {
        const data = loadDB();
        let list = data.sales || [];
        if (guildId) {
            list = list.filter(s => s.guildId === guildId);
        }
        return list.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
    },

    getSalesAnalytics(guildId) {
        const list = this.getSales(guildId, 1000);
        const totalSalesCount = list.length;
        let totalRevenue = 0;
        let totalDiscount = 0;
        const uniqueCustomers = new Set();
        const productStats = {};
        const now = Date.now();
        const oneDayAgo = now - 24 * 60 * 60 * 1000;
        const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
        let todayRevenue = 0;
        let weekRevenue = 0;
        let couponsUsedCount = 0;

        for (const s of list) {
            totalRevenue += (s.amount || 0);
            totalDiscount += (s.discount || 0);
            if (s.customerId) uniqueCustomers.add(s.customerId);
            if (s.couponCode) couponsUsedCount++;

            const pName = s.productName || 'อื่นๆ';
            if (!productStats[pName]) {
                productStats[pName] = { name: pName, count: 0, revenue: 0 };
            }
            productStats[pName].count += (s.quantity || 1);
            productStats[pName].revenue += (s.amount || 0);

            if (s.timestamp >= oneDayAgo) {
                todayRevenue += (s.amount || 0);
            }
            if (s.timestamp >= sevenDaysAgo) {
                weekRevenue += (s.amount || 0);
            }
        }

        const topProducts = Object.values(productStats)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);

        return {
            totalSalesCount,
            totalRevenue,
            totalDiscount,
            uniqueCustomersCount: uniqueCustomers.size,
            couponsUsedCount,
            todayRevenue,
            weekRevenue,
            topProducts,
            recentSales: list.slice(0, 5)
        };
    },

    // --- VIP Loyalty & Customer Analytics (ระบบสมาชิกระดับ VIP และส่วนลดอัตโนมัติ) ---
    getCustomerStats(guildId, customerId) {
        const data = loadDB();
        const sales = (data.sales || []).filter(s => s.guildId === guildId && s.customerId === customerId);
        const totalOrders = sales.length;
        const totalSpent = sales.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
        const totalSaved = sales.reduce((sum, s) => sum + (Number(s.discount) || 0), 0);

        let tier = 'bronze';
        let tierName = '🥉 Member ทั่วไป';
        let discountPercent = 0;
        let nextTier = '🥈 Silver VIP';
        let nextTierThreshold = 500;

        if (totalSpent >= 5000) {
            tier = 'diamond';
            tierName = '💎 Diamond VIP';
            discountPercent = 10;
            nextTier = 'ระดับสูงสุดแล้ว';
            nextTierThreshold = 5000;
        } else if (totalSpent >= 1500) {
            tier = 'gold';
            tierName = '🥇 Gold VIP';
            discountPercent = 5;
            nextTier = '💎 Diamond VIP';
            nextTierThreshold = 5000;
        } else if (totalSpent >= 500) {
            tier = 'silver';
            tierName = '🥈 Silver VIP';
            discountPercent = 3;
            nextTier = '🥇 Gold VIP';
            nextTierThreshold = 1500;
        }

        const remainingToNext = Math.max(0, nextTierThreshold - totalSpent);
        const progress = nextTierThreshold > 0 
            ? Math.min(100, Math.round((totalSpent / nextTierThreshold) * 100))
            : 100;

        return {
            customerId,
            totalOrders,
            totalSpent,
            totalSaved,
            tier,
            tierName,
            discountPercent,
            nextTier,
            nextTierThreshold,
            remainingToNext,
            progress,
            orders: sales.slice(-10).reverse()
        };
    },

    // --- Restock Wishlist / Waiting List (ระบบจองคิวแจ้งเตือนเมื่อสินค้าเข้า) ---
    subscribeRestock(productId, userId) {
        const data = loadDB();
        data.restockSubscribers = data.restockSubscribers || {};
        const pid = productId.toUpperCase();
        data.restockSubscribers[pid] = data.restockSubscribers[pid] || [];
        if (!data.restockSubscribers[pid].includes(userId)) {
            data.restockSubscribers[pid].push(userId);
            saveDB(data);
            return { success: true, count: data.restockSubscribers[pid].length, subscribed: true };
        }
        return { success: true, count: data.restockSubscribers[pid].length, subscribed: false };
    },

    getRestockSubscribers(productId) {
        const data = loadDB();
        const pid = productId.toUpperCase();
        return data.restockSubscribers?.[pid] || [];
    },

    clearRestockSubscribers(productId) {
        const data = loadDB();
        const pid = productId.toUpperCase();
        if (data.restockSubscribers?.[pid]) {
            const count = data.restockSubscribers[pid].length;
            delete data.restockSubscribers[pid];
            saveDB(data);
            return count;
        }
        return 0;
    },

    // --- Scammer Blacklist Protection (ระบบบัญชีดำป้องกันมิจฉาชีพ) ---
    addBlacklist(userId, reason, adminId) {
        const data = loadDB();
        data.blacklist = data.blacklist || {};
        data.blacklist[userId] = {
            userId,
            reason: reason || 'พฤติกรรมน่าสงสัย / หลอกลวง',
            adminId,
            timestamp: Date.now()
        };
        saveDB(data);
        return data.blacklist[userId];
    },

    getBlacklist(userId) {
        const data = loadDB();
        return data.blacklist?.[userId] || null;
    },

    removeBlacklist(userId) {
        const data = loadDB();
        if (data.blacklist?.[userId]) {
            delete data.blacklist[userId];
            saveDB(data);
            return true;
        }
        return false;
    },

    getAllBlacklist() {
        const data = loadDB();
        return Object.values(data.blacklist || {});
    },

    // --- Digital Code Vault & Instant Delivery ---
    addProductKeys(productId, keysArray) {
        const data = loadDB();
        data.productKeys = data.productKeys || {};
        const pid = productId.toUpperCase();
        data.productKeys[pid] = data.productKeys[pid] || [];
        const cleanedKeys = keysArray.map(k => k.trim()).filter(Boolean);
        data.productKeys[pid].push(...cleanedKeys);
        saveDB(data);
        return { added: cleanedKeys.length, total: data.productKeys[pid].length };
    },

    popProductKey(productId) {
        const data = loadDB();
        data.productKeys = data.productKeys || {};
        const pid = productId.toUpperCase();
        if (data.productKeys[pid] && data.productKeys[pid].length > 0) {
            const key = data.productKeys[pid].shift();
            saveDB(data);
            return key;
        }
        return null;
    },

    getProductKeysCount(productId) {
        const data = loadDB();
        const pid = productId.toUpperCase();
        return data.productKeys?.[pid]?.length || 0;
    },

    getAllProductKeys(productId) {
        const data = loadDB();
        const pid = productId.toUpperCase();
        return data.productKeys?.[pid] || [];
    },

    // --- Verified Customer Role System ---
    setCustomerRole(guildId, roleId) {
        const data = loadDB();
        data.customerRoles = data.customerRoles || {};
        data.customerRoles[guildId] = roleId;
        saveDB(data);
        return roleId;
    },

    getCustomerRole(guildId) {
        const data = loadDB();
        return data.customerRoles?.[guildId] || null;
    },

    // --- Cloud Database Backup & Restore ---
    backupDB() {
        const data = loadDB();
        return JSON.stringify(data, null, 2);
    },

    restoreDB(jsonString) {
        try {
            const parsed = JSON.parse(jsonString);
            if (typeof parsed !== 'object' || parsed === null) throw new Error('Invalid JSON format');
            saveDB(parsed);
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }
};

module.exports = db;
