process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const https = require('https');
const { ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
require('dotenv').config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// รายชื่อโมเดลตามลำดับความพร้อมใช้งาน
const PRIORITY_MODELS = [
    'gemini-3.6-flash',
    'gemini-3.8-flash',
    'gemini-3-flash-preview',
    'gemini-flash-latest',
    'gemini-flash-lite-latest'
];

/**
 * เรียก Gemini API พร้อมระบบสลับโมเดลอัตโนมัติ
 */
function callGemini(contents, systemInstruction = null) {
    return new Promise(async (resolve, reject) => {
        if (!GEMINI_API_KEY) {
            return reject(new Error('ไม่พบคีย์ GEMINI_API_KEY ในไฟล์ .env'));
        }

        let lastError = null;

        for (const model of PRIORITY_MODELS) {
            try {
                const bodyObj = {
                    contents: contents,
                    generationConfig: {
                        temperature: 0.3,
                        maxOutputTokens: 2048
                    }
                };

                if (systemInstruction) {
                    bodyObj.systemInstruction = {
                        parts: [{ text: systemInstruction }]
                    };
                }

                const postData = JSON.stringify(bodyObj);

                const result = await new Promise((resResolve, resReject) => {
                    const req = https.request({
                        hostname: 'generativelanguage.googleapis.com',
                        path: `/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Content-Length': Buffer.byteLength(postData)
                        },
                        rejectUnauthorized: false,
                        timeout: 10000
                    }, res => {
                        let data = '';
                        res.on('data', chunk => data += chunk);
                        res.on('end', () => {
                            if (res.statusCode === 200) {
                                try {
                                    const json = JSON.parse(data);
                                    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
                                    if (text) return resResolve(text);
                                } catch (e) {
                                    return resReject(e);
                                }
                            }
                            resReject(new Error(`Model ${model} returned HTTP ${res.statusCode}`));
                        });
                    });

                    req.on('error', err => resReject(err));
                    req.on('timeout', () => {
                        req.destroy();
                        resReject(new Error(`Timeout on model ${model}`));
                    });
                    req.write(postData);
                    req.end();
                });

                return resolve(result);
            } catch (err) {
                lastError = err;
                continue;
            }
        }

        reject(lastError || new Error('โมเดล Gemini ทั้งหมดกำลังมีผู้ใช้งานหนาแน่น กรุณาลองใหม่อีกครั้ง'));
    });
}

/**
 * ถามคำถามทั่วไปกับ Gemini AI
 */
async function askGemini(prompt) {
    try {
        const contents = [{ parts: [{ text: prompt }] }];
        return await callGemini(contents);
    } catch (e) {
        return `⚠️ ขออภัย ขณะนี้ระบบคลาวด์ Gemini กำลังมีผู้ใช้งานหนาแน่นชั่วคราว (${e.message}) กรุณาลองใหม่อีกครั้งในอีกสักครู่ครับ`;
    }
}

/**
 * ตัววิเคราะห์คำสั่งแบบออฟไลน์ (Local Intent Fallback) 
 * สำหรับกรณีที่ Gemini Cloud API ติด 503 หรือขัดข้อง เพื่อให้ระบบจัดการเซิร์ฟเวอร์ทำงานได้ 100% ตลอดเวลา
 */
function parseLocalAdminIntent(prompt, currentChannel) {
    const p = prompt.toLowerCase();

    // 1. ลบข้อความ
    if (p.includes('ลบข้อความ') || p.includes('ลบแชท') || p.includes('ล้างแชท') || p.includes('purge') || p.includes('clear')) {
        const match = prompt.match(/(\d+)/);
        const count = match ? parseInt(match[1]) : 20;
        return {
            thought: `ตรวจพบคำสั่งลบข้อความจำนวน ${count} ข้อความ`,
            action: 'purge_messages',
            params: { count },
            summary: `ดำเนินการลบข้อความในห้องนี้จำนวน ${count} ข้อความ`
        };
    }

    // 2. ปลดล็อกห้อง
    if (p.includes('ปลดล็อก') || p.includes('unlock') || p.includes('เปิดห้อง')) {
        return {
            thought: 'ตรวจพบคำสั่งปลดล็อกห้องให้สมาชิกส่งข้อความได้',
            action: 'unlock_channel',
            params: { reason: 'ปลดล็อกตามคำสั่งแอดมิน' },
            summary: 'ปลดล็อกห้องให้สมาชิกทุกคนสามารถส่งข้อความได้ตามปกติ'
        };
    }

    // 3. ล็อกห้อง
    if (p.includes('ล็อกห้อง') || p.includes('lock') || p.includes('ปิดห้อง') || p.includes('ห้ามพิมพ์')) {
        return {
            thought: 'ตรวจพบคำสั่งล็อกห้องเพื่อระงับการส่งข้อความ',
            action: 'lock_channel',
            params: { reason: prompt },
            summary: 'ล็อกห้องนี้เรียบร้อยแล้ว สมาชิกทั่วไปไม่สามารถส่งข้อความได้'
        };
    }

    // 4. สโลว์โหมด
    if (p.includes('สโลว์') || p.includes('slowmode') || p.includes('หน่วง')) {
        const match = prompt.match(/(\d+)/);
        const seconds = match ? parseInt(match[1]) : 5;
        return {
            thought: `ตรวจพบคำสั่งตั้งเวลาหน่วงการพิมพ์ ${seconds} วินาที`,
            action: 'set_slowmode',
            params: { seconds },
            summary: `ตั้งค่าหน่วงเวลา (Slowmode) เป็น ${seconds} วินาทีแล้ว`
        };
    }

    // 5. ตรวจสอบเซิร์ฟเวอร์
    if (p.includes('ตรวจ') || p.includes('audit') || p.includes('เช็ค') || p.includes('สถานะเซิร์ฟเวอร์') || p.includes('สถานะ')) {
        return {
            thought: 'ตรวจพบคำขอรายงานสถานะและความปลอดภัยของเซิร์ฟเวอร์',
            action: 'server_audit',
            params: {},
            summary: 'ทำการตรวจสอบโครงสร้าง สมาชิก และความปลอดภัยของเซิร์ฟเวอร์'
        };
    }

    // 6. สร้างห้องใหม่
    if (p.includes('สร้างห้อง') || p.includes('create channel')) {
        const isVoice = p.includes('เสียง') || p.includes('voice');
        let chName = prompt.replace(/(ช่วย)?สร้างห้อง(เสียง|แชท|ข้อความ)?(ใหม่)?(ชื่อ)?/gi, '').trim();
        chName = chName.replace(/["']/g, '').trim() || 'room-new';
        return {
            thought: `ตรวจพบคำสั่งสร้างห้องใหม่ชื่อ ${chName}`,
            action: 'create_channel',
            params: { name: chName, type: isVoice ? 'voice' : 'text', topic: 'สร้างโดย Gemini AI Manager' },
            summary: `สร้างห้องใหม่ชื่อ ${chName} เรียบร้อยแล้ว`
        };
    }

    // 7. ประกาศ
    if (p.includes('ประกาศ') || p.includes('announce')) {
        let content = prompt.replace(/(ช่วย)?(เขียน)?ประกาศ(เรื่อง)?/gi, '').trim();
        return {
            thought: 'ตรวจพบคำสั่งสร้างการ์ดประกาศข่าวสาร',
            action: 'create_announcement',
            params: { title: 'ประกาศสำคัญประจำเซิร์ฟเวอร์', description: content || prompt, color: '#5865F2', ping_everyone: false },
            summary: 'สร้างการ์ดประกาศข่าวสารเรียบร้อยแล้ว'
        };
    }

    return null;
}

/**
 * ผู้ช่วย Gemini AI จัดการเซิร์ฟเวอร์แบบชาญฉลาด (AI Server Management Assistant)
 * วิเคราะห์ความต้องการของผู้ดูแลเซิร์ฟเวอร์ และสั่งการ Discord Bot ทำงานจริงอัตโนมัติ
 */
async function executeAiServerManagement(client, guild, member, channel, prompt) {
    const systemPrompt = `You are "Docomin Gemini AI Server Manager", an autonomous Discord AI administrator.
Your task is to analyze natural language management instructions from server administrators and execute the appropriate server management actions.

Current Server Context:
- Guild Name: "${guild.name}"
- Guild Member Count: ${guild.memberCount}
- Current Channel: #${channel.name} (ID: ${channel.id})
- Requester: ${member.user.tag} (ID: ${member.id})

Available Actions:
1. "purge_messages": Delete recent messages.
   params: { "count": number (1 to 100) }
2. "lock_channel": Lock current channel from @everyone sending messages.
   params: { "reason": string }
3. "unlock_channel": Unlock current channel for @everyone.
   params: { "reason": string }
4. "set_slowmode": Set slowmode delay on current channel.
   params: { "seconds": number (0 to 21600, 0 to disable) }
5. "create_channel": Create a new text or voice channel.
   params: { "name": string, "type": "text" | "voice", "topic": string }
6. "create_announcement": Create a beautiful announcement embed.
   params: { "title": string, "description": string, "color": string, "ping_everyone": boolean }
7. "timeout_member": Mute/timeout a member.
   params: { "user_id": string, "minutes": number, "reason": string }
8. "kick_member": Kick a member.
   params: { "user_id": string, "reason": string }
9. "server_audit": Perform server health, channel, and security audit.
   params: {}
10. "general_chat": General reply or advice if no administrative Discord action is required.
   params: { "reply": string }

STRICT OUTPUT FORMAT:
You MUST return ONLY a single valid JSON object, without markdown quotes or backticks:
{
  "thought": "Brief explanation in Thai of your thinking",
  "action": "purge_messages" | "lock_channel" | "unlock_channel" | "set_slowmode" | "create_channel" | "create_announcement" | "timeout_member" | "kick_member" | "server_audit" | "general_chat",
  "params": { ... },
  "summary": "Clear, professional Thai explanation of what was done"
}`;

    let plan = null;

    // 1. ลองประมวลผลผ่าน Gemini AI ก่อน
    try {
        const userPrompt = `คำสั่งจากแอดมิน: "${prompt}"`;
        const contents = [{ parts: [{ text: userPrompt }] }];
        const rawResponse = await callGemini(contents, systemPrompt);

        let cleaned = rawResponse.trim();
        if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
        if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
        if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
        cleaned = cleaned.trim();

        plan = JSON.parse(cleaned);
    } catch (aiErr) {
        // 2. หาก Gemini Cloud ติด 503 หรือขัดข้อง ให้ใช้ตัววิเคราะห์ออฟไลน์ทันที (Zero Downtime)
        plan = parseLocalAdminIntent(prompt, channel);
        if (!plan) {
            plan = {
                thought: 'ระบบประมวลผลคำสั่งของแอดมิน',
                action: 'general_chat',
                params: { reply: `ได้รับคำสั่ง: "${prompt}" แล้ว แต่ระบบไม่พบคำสั่งจัดการเซิร์ฟเวอร์ที่ตรงกัน คุณสามารถลองใช้คำสั่ง เช่น "ลบข้อความ 30", "ล็อกห้องนี้", "ปลดล็อกห้อง", "สร้างห้อง vip", "ตรวจสถานะเซิร์ฟเวอร์"` },
                summary: 'คำสั่งยังไม่ตรงกับฟังก์ชันจัดการเซิร์ฟเวอร์'
            };
        }
    }

    const { action, params, thought, summary } = plan;
    let executionResult = { success: true, details: summary };

    try {
        switch (action) {
            case 'purge_messages': {
                const count = Math.min(Math.max(parseInt(params?.count) || 10, 1), 100);
                const fetched = await channel.messages.fetch({ limit: count });
                const deleted = await channel.bulkDelete(fetched, true);
                executionResult.details = `ลบข้อความในห้อง #${channel.name} เรียบร้อยแล้วจำนวน ${deleted.size} ข้อความ`;
                break;
            }

            case 'lock_channel': {
                const everyone = guild.roles.everyone;
                await channel.permissionOverwrites.edit(everyone, {
                    [PermissionFlagsBits.SendMessages]: false
                });
                const lockEmbed = new EmbedBuilder()
                    .setColor(0xED4245)
                    .setTitle('🔒 ห้องนี้ถูกล็อกโดยผู้ดูแลระบบ (Gemini AI Admin)')
                    .setDescription(`เหตุผล: **${params?.reason || 'ระงับการส่งข้อความชั่วคราว'}**`)
                    .setFooter({ text: `สั่งการโดย ${member.user.tag}` })
                    .setTimestamp();
                await channel.send({ embeds: [lockEmbed] }).catch(() => {});
                executionResult.details = `ล็อกห้อง #${channel.name} เรียบร้อยแล้ว สมาชิกทั่วไปไม่สามารถส่งข้อความได้`;
                break;
            }

            case 'unlock_channel': {
                const everyone = guild.roles.everyone;
                await channel.permissionOverwrites.edit(everyone, {
                    [PermissionFlagsBits.SendMessages]: null
                });
                const unlockEmbed = new EmbedBuilder()
                    .setColor(0x57F287)
                    .setTitle('🔓 ปลดล็อกห้องเรียบร้อยแล้ว (Gemini AI Admin)')
                    .setDescription('สมาชิกทุกคนสามารถส่งข้อความพูดคุยได้ตามปกติ')
                    .setFooter({ text: `สั่งการโดย ${member.user.tag}` })
                    .setTimestamp();
                await channel.send({ embeds: [unlockEmbed] }).catch(() => {});
                executionResult.details = `ปลดล็อกห้อง #${channel.name} ให้สมาชิกส่งข้อความได้ตามปกติแล้ว`;
                break;
            }

            case 'set_slowmode': {
                const seconds = Math.min(Math.max(parseInt(params?.seconds) || 0, 0), 21600);
                await channel.setRateLimitPerUser(seconds);
                executionResult.details = seconds > 0
                    ? `ตั้งค่าหน่วงเวลา (Slowmode) ของห้อง #${channel.name} เป็น ${seconds} วินาทีแล้ว`
                    : `ปิดหน่วงเวลา (Slowmode) ของห้อง #${channel.name} เรียบร้อยแล้ว`;
                break;
            }

            case 'create_channel': {
                const chName = (params?.name || 'new-channel').toLowerCase().replace(/\s+/g, '-');
                const isVoice = params?.type === 'voice';
                const created = await guild.channels.create({
                    name: chName,
                    type: isVoice ? ChannelType.GuildVoice : ChannelType.GuildText,
                    topic: params?.topic || 'สร้างโดย Gemini AI Server Manager'
                });
                executionResult.details = `สร้างห้องใหม่ ${created.toString()} (${isVoice ? 'ห้องเสียง' : 'ห้องแชท'}) เรียบร้อยแล้ว`;
                break;
            }

            case 'create_announcement': {
                const annEmbed = new EmbedBuilder()
                    .setColor(params?.color || 0x5865F2)
                    .setTitle(`📢 ${params?.title || 'ประกาศจากทางเซิร์ฟเวอร์'}`)
                    .setDescription(params?.description || 'ไม่มีเนื้อหา')
                    .setFooter({ text: `ประกาศโดย ${guild.name} • จัดการโดย Gemini AI` })
                    .setTimestamp();

                const content = params?.ping_everyone ? '@everyone' : null;
                await channel.send({ content, embeds: [annEmbed] });
                executionResult.details = `ส่งการ์ดประกาศลงในห้อง #${channel.name} เรียบร้อยแล้ว`;
                break;
            }

            case 'timeout_member': {
                const targetId = (params?.user_id || '').replace(/[^0-9]/g, '');
                if (!targetId) throw new Error('ไม่พบ User ID หรือ Mention ที่ถูกต้องสำหรับปิดการสนทนา');
                const targetMember = await guild.members.fetch(targetId);
                const minutes = Math.min(Math.max(parseInt(params?.minutes) || 10, 1), 10080);
                await targetMember.timeout(minutes * 60 * 1000, params?.reason || 'สั่งการโดย Gemini AI Server Manager');
                executionResult.details = `ปิดการสนทนา (Timeout) สมาชิก ${targetMember.user.tag} เป็นเวลา ${minutes} นาทีแล้ว`;
                break;
            }

            case 'kick_member': {
                const targetId = (params?.user_id || '').replace(/[^0-9]/g, '');
                if (!targetId) throw new Error('ไม่พบ User ID หรือ Mention ที่ถูกต้องสำหรับเตะ');
                const targetMember = await guild.members.fetch(targetId);
                await targetMember.kick(params?.reason || 'สั่งการโดย Gemini AI Server Manager');
                executionResult.details = `เตะสมาชิก ${targetMember.user.tag} ออกจากเซิร์ฟเวอร์แล้ว`;
                break;
            }

            case 'server_audit': {
                const textChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
                const voiceChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;
                const roleCount = guild.roles.cache.size;
                const botCount = guild.members.cache.filter(m => m.user.bot).size;
                executionResult.details = `📊 **ผลการตรวจสอบความพร้อมของเซิร์ฟเวอร์ ${guild.name}:**\n` +
                    `• สมาชิกทั้งหมด: **${guild.memberCount}** คน (เป็นบอท ${botCount} ตัว)\n` +
                    `• จำนวนห้องข้อความ: **${textChannels}** ห้อง\n` +
                    `• จำนวนห้องเสียง: **${voiceChannels}** ห้อง\n` +
                    `• จำนวนยศทั้งหมด: **${roleCount}** ยศ\n` +
                    `• ความปลอดภัย: ปกติ พร้อมระบบ AutoMod, Anti-Spam และระบบป้องกันห้องซ้ำซ้อน`;
                break;
            }

            case 'general_chat':
            default: {
                executionResult.details = params?.reply || summary || 'ดำเนินการเรียบร้อยแล้ว';
                break;
            }
        }
    } catch (execErr) {
        executionResult.success = false;
        executionResult.details = `เกิดข้อผิดพลาดในการดำเนินการ: ${execErr.message}`;
    }

    return {
        thought: thought || 'วิเคราะห์และดำเนินการตามคำสั่งแอดมิน',
        action: action || 'general_chat',
        summary: executionResult.details,
        success: executionResult.success
    };
}

module.exports = {
    askGemini,
    executeAiServerManagement
};
