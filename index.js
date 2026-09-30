const {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    SlashCommandBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    ChannelType,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActivityType
} = require('discord.js');
require('dotenv').config();

const { getRobloxUser, getRobloxGame, getRobloxGroup } = require('./roblox');
const db = require('./db');
const music = require('./music');
const { askGemini, executeAiServerManagement } = require('./ai');
const panel = require('./panel');
const uptime = require('./uptime');
const { runAutoSetup } = require('./autosetup');
const bftrade = require('./bftrade');
const voicemaster = require('./voicemaster');
const docominShop = require('./docomin_shop');
const { startWebServer } = require('./web_server');
const {
    FRUITS,
    getDealerStock,
    getMirageStock,
    createStockEmbed,
    createFruitAlertEmbed,
    createFruitSelectMenu,
    startStockWatcher
} = require('./bloxfruits');

const TOKEN = process.env.DISCORD_TOKEN;
const PREFIX = process.env.PREFIX || '!';

if (!TOKEN || TOKEN === 'ใส่โทเค็นบอทของคุณที่นี่') {
    console.error('❌ ข้อผิดพลาด: ไม่พบ DISCORD_TOKEN ในไฟล์ .env');
    console.error('กรุณาเปิดไฟล์ .env แล้วใส่โทเค็นบอทของคุณก่อนเริ่มทำงาน');
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// กำหนดนิยามคำสั่ง Slash Commands ทั้งหมด
const commands = [
    // --- ระบบถาม-ตอบ AI (Gemini 3.8 Flash) ---
    new SlashCommandBuilder()
        .setName('ask')
        .setDescription('ถามคำถามกับ Gemini AI อัจฉริยะ')
        .addStringOption(opt =>
            opt.setName('prompt').setDescription('คำถามหรือข้อความที่ต้องการถาม AI').setRequired(true)
        ),

    // --- ระบบ Web Uptime Monitor (Web Pinger ให้ออนตลอด 24 ชม.) ---
    new SlashCommandBuilder()
        .setName('uptime-add')
        .setDescription('เพิ่มลิงก์เว็บไซต์หรือโปรเจกต์ให้ออนตลอด 24 ชั่วโมง')
        .addStringOption(opt =>
            opt.setName('url').setDescription('URL เว็บไซต์ เช่น https://my-bot.glitch.me').setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('uptime-remove')
        .setDescription('ลบลิงก์เว็บไซต์ออกจากระบบมอนิเตอร์')
        .addStringOption(opt =>
            opt.setName('url').setDescription('URL ที่ต้องการลบ').setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('uptime-list')
        .setDescription('ดูรายชื่อเว็บไซต์ทั้งหมดที่กำลังรันออนอยู่ และสถานะ'),

    // --- ระบบจัดระเบียบเซิร์ฟเวอร์อัตโนมัติ (Auto-Setup) ---
    new SlashCommandBuilder()
        .setName('auto-setup')
        .setDescription('จัดระเบียบเซิร์ฟเวอร์อัตโนมัติ สร้างหมวดหมู่ ห้องแชท และแผงระบบครบวงจร')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    // --- ระบบจัดการเซิร์ฟเวอร์สไตล์ Carl-bot (Moderation) ---
    new SlashCommandBuilder()
        .setName('kick')
        .setDescription('เตะสมาชิกออกจากเซิร์ฟเวอร์')
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
        .addUserOption(opt => opt.setName('user').setDescription('สมาชิกที่ต้องการเตะ').setRequired(true))
        .addStringOption(opt => opt.setName('reason').setDescription('เหตุผล').setRequired(false)),
    new SlashCommandBuilder()
        .setName('ban')
        .setDescription('แบนสมาชิกออกจากเซิร์ฟเวอร์')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addUserOption(opt => opt.setName('user').setDescription('สมาชิกที่ต้องการแบน').setRequired(true))
        .addStringOption(opt => opt.setName('reason').setDescription('เหตุผล').setRequired(false)),
    new SlashCommandBuilder()
        .setName('unban')
        .setDescription('ปลดแบนผู้ใช้ด้วย User ID')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addStringOption(opt => opt.setName('userid').setDescription('ID ของผู้ใช้ที่ต้องการปลดแบน').setRequired(true)),
    new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('ปิดการสนทนาชั่วคราว (Mute/Timeout)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(opt => opt.setName('user').setDescription('สมาชิกที่ต้องการปิดการสนทนา').setRequired(true))
        .addIntegerOption(opt => opt.setName('minutes').setDescription('ระยะเวลา (นาที)').setRequired(true).setMinValue(1))
        .addStringOption(opt => opt.setName('reason').setDescription('เหตุผล').setRequired(false)),
    new SlashCommandBuilder()
        .setName('warn')
        .setDescription('ตักเตือนสมาชิกและบันทึกประวัติ')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(opt => opt.setName('user').setDescription('สมาชิกที่ต้องการตักเตือน').setRequired(true))
        .addStringOption(opt => opt.setName('reason').setDescription('เหตุผลการตักเตือน').setRequired(true)),
    new SlashCommandBuilder()
        .setName('warnings')
        .setDescription('ดูประวัติการตักเตือนของสมาชิก')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(opt => opt.setName('user').setDescription('เลือกสมาชิก').setRequired(true)),
    new SlashCommandBuilder()
        .setName('clear-warnings')
        .setDescription('ล้างประวัติการตักเตือนทั้งหมดของสมาชิก')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(opt => opt.setName('user').setDescription('เลือกสมาชิก').setRequired(true)),
    new SlashCommandBuilder()
        .setName('slowmode')
        .setDescription('ตั้งเวลาหน่วงการพิมพ์ในห้องนี้ (Slowmode)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addIntegerOption(opt => opt.setName('seconds').setDescription('วินาที (ใส่ 0 เพื่อปิด)').setRequired(true).setMinValue(0).setMaxValue(21600)),
    new SlashCommandBuilder()
        .setName('lock')
        .setDescription('ล็อกห้องนี้ไม่ให้สมาชิกทั่วไปส่งข้อความ')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    new SlashCommandBuilder()
        .setName('unlock')
        .setDescription('ปลดล็อกห้องนี้ให้สมาชิกทั่วไปส่งข้อความได้ตามปกติ')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    new SlashCommandBuilder()
        .setName('embed')
        .setDescription('สร้างการ์ด Embed ประกาศข่าวสารสวยงาม')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addStringOption(opt => opt.setName('title').setDescription('หัวข้อของการ์ด').setRequired(true))
        .addStringOption(opt => opt.setName('description').setDescription('เนื้อหาข้อความ').setRequired(true))
        .addStringOption(opt => opt.setName('color').setDescription('โค้ดสี เช่น #5865F2, #57F287, #ED4245').setRequired(false)),

    // --- ระบบเปิดเพลง (Music) ---
    new SlashCommandBuilder()
        .setName('play')
        .setDescription('เปิดเพลงหรือค้นหาเพลงพร้อมเมนูเลือกและตัวเลือกเล่นทันที/เข้าคิว')
        .addStringOption(opt =>
            opt.setName('query').setDescription('ชื่อเพลง หรือ ลิงก์ YouTube').setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('search')
        .setDescription('ค้นหาเพลงจาก YouTube และแสดงเมนูให้เลือกเพลง')
        .addStringOption(opt =>
            opt.setName('query').setDescription('ชื่อเพลงที่ต้องการค้นหา').setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('music-panel')
        .setDescription('ส่งแผงควบคุมเพลง (Music Dashboard) พร้อมปุ่มค้นหาและควบคุม'),
    new SlashCommandBuilder()
        .setName('skip')
        .setDescription('ข้ามเพลงที่กำลังเล่นอยู่ไปยังเพลงถัดไป'),
    new SlashCommandBuilder()
        .setName('stop')
        .setDescription('หยุดเล่นเพลง ล้างคิว และออกจากห้องเสียง'),
    new SlashCommandBuilder()
        .setName('pause')
        .setDescription('หยุดเพลงชั่วคราว หรือ เล่นต่อ'),
    new SlashCommandBuilder()
        .setName('resume')
        .setDescription('เล่นเพลงต่อจากที่หยุดไว้'),
    new SlashCommandBuilder()
        .setName('queue')
        .setDescription('ดูรายการเพลงทั้งหมดในคิว'),
    new SlashCommandBuilder()
        .setName('nowplaying')
        .setDescription('ดูข้อมูลเพลงที่กำลังเล่นอยู่ ณ ตอนนี้'),

    // --- ระบบ Roblox ---
    new SlashCommandBuilder()
        .setName('roblox-user')
        .setDescription('ค้นหาและดูข้อมูลโปรไฟล์ผู้เล่น Roblox')
        .addStringOption(opt =>
            opt.setName('username').setDescription('ชื่อผู้ใช้ Roblox ที่ต้องการค้นหา').setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('roblox-game')
        .setDescription('ดูข้อมูลแมพ/เกม Roblox (จำนวนผู้เล่น, ยอดเข้าชม)')
        .addStringOption(opt =>
            opt.setName('placeid').setDescription('Place ID หรือ ลิงก์แมพ Roblox').setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('roblox-group')
        .setDescription('ดูข้อมูลกลุ่ม Roblox')
        .addStringOption(opt =>
            opt.setName('groupid').setDescription('Group ID ของกลุ่ม Roblox').setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('roblox-bind')
        .setDescription('ผูกบัญชี Roblox เข้ากับดิสคอร์ดของคุณ')
        .addStringOption(opt =>
            opt.setName('username').setDescription('ชื่อผู้ใช้ Roblox ของคุณ').setRequired(true)
        ),

    // --- ระบบตั๋ว (Tickets) ---
    new SlashCommandBuilder()
        .setName('setup-ticket')
        .setDescription('สร้างแผงเมนูเปิดตั๋วติดต่อ/แจ้งปัญหา (Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    // --- ระบบยืนยันตัวตน (Verify) ---
    new SlashCommandBuilder()
        .setName('setup-verify')
        .setDescription('ติดตั้งระบบปุ่มกดยืนยันตัวตนสำหรับสมาชิกใหม่ (Verification Gate)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addRoleOption(opt =>
            opt.setName('role').setDescription('ยศที่จะได้รับเมื่อกดยืนยันตัวตน').setRequired(true)
        )
        .addChannelOption(opt =>
            opt.setName('channel').setDescription('ห้องที่จะส่งข้อความยืนยันตัวตน (เว้นว่างไว้หากใช้ห้องปัจจุบัน)').setRequired(false)
        ),

    // --- ระบบกิจกรรมแจกของ (Giveaway) ---
    new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('สร้างกิจกรรมสุ่มแจกของรางวัล')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addStringOption(opt => opt.setName('prize').setDescription('ของรางวัล').setRequired(true))
        .addIntegerOption(opt => opt.setName('duration_mins').setDescription('ระยะเวลากิจกรรม (นาที)').setRequired(true).setMinValue(1))
        .addIntegerOption(opt => opt.setName('winners').setDescription('จำนวนผู้ชนะ').setRequired(false).setMinValue(1)),

    // --- ระบบเศรษฐกิจ & สะสมเหรียญ (Economy) ---
    new SlashCommandBuilder()
        .setName('daily')
        .setDescription('เช็กอินรับเหรียญฟรีประจำวัน (100 - 500 เหรียญ)'),
    new SlashCommandBuilder()
        .setName('balance')
        .setDescription('ดูเหรียญในกระเป๋าของคุณหรือเพื่อน')
        .addUserOption(opt => opt.setName('user').setDescription('เลือกผู้ใช้ที่ต้องการดูยอดเงิน').setRequired(false)),
    new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('ดูตารางอันดับคนรวยสุดในเซิร์ฟเวอร์'),
    new SlashCommandBuilder()
        .setName('pay')
        .setDescription('โอนเหรียญให้เพื่อน')
        .addUserOption(opt => opt.setName('user').setDescription('ผู้รับ').setRequired(true))
        .addIntegerOption(opt => opt.setName('amount').setDescription('จำนวนเหรียญ').setRequired(true).setMinValue(1)),

    // --- ระบบจัดการข้อความและห้อง ---
    new SlashCommandBuilder()
        .setName('clear')
        .setDescription('ลบข้อความทีละเยอะๆ (รองรับสูงสุด 1,000 ข้อความ)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addIntegerOption(opt =>
            opt.setName('amount').setDescription('จำนวนข้อความที่ต้องการลบ (1 - 1,000)').setRequired(true).setMinValue(1).setMaxValue(1000)
        )
        .addUserOption(opt =>
            opt.setName('user').setDescription('เลือกลบเฉพาะข้อความของผู้ใช้คนนี้ (ไม่บังคับ)').setRequired(false)
        ),
    new SlashCommandBuilder()
        .setName('delete-channel')
        .setDescription('ลบห้องแชท (ห้องปัจจุบันหรือห้องที่เลือก)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addChannelOption(opt =>
            opt.setName('channel').setDescription('เลือกห้องที่ต้องการลบ (หากไม่ระบุจะลบห้องปัจจุบัน)').setRequired(false)
        ),
    new SlashCommandBuilder()
        .setName('delete-category')
        .setDescription('ลบห้องทั้งหมดในหมวดหมู่นี้ในครั้งเดียว (Mass Channel Delete)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addChannelOption(opt =>
            opt.setName('category').setDescription('เลือกหมวดหมู่ที่ต้องการลบห้องทั้งหมด').addChannelTypes(ChannelType.GuildCategory).setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('nuke')
        .setDescription('ล้างห้องแชททั้งหมด (ลบทุกข้อความไม่จำกัดจำนวนและไม่ติดจำกัด 14 วัน)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    // --- ระบบ Blox Fruits Real-Time Stock & Alert ---
    new SlashCommandBuilder()
        .setName('bloxfruits-stock')
        .setDescription('ดูสต็อกผลปีศาจ Blox Fruits แบบเรียลไทม์ พร้อมรูปภาพและเวลารีสต็อก')
        .addStringOption(opt =>
            opt.setName('dealer')
                .setDescription('เลือกร้านค้าที่ต้องการดูสต็อก')
                .setRequired(false)
                .addChoices(
                    { name: '🛒 ปกติ (Normal Dealer - ทุก 4 ชม.)', value: 'normal' },
                    { name: '🏝️ เกาะลวงตา (Mirage Island - ทุก 2 ชม.)', value: 'mirage' }
                )
        ),
    new SlashCommandBuilder()
        .setName('bloxfruits-alert')
        .setDescription('เลือกผลปีศาจที่ต้องการรับแจ้งเตือนพร้อมรูปภาพเมื่อมีจำหน่ายในร้าน'),
    new SlashCommandBuilder()
        .setName('bloxfruits-channel')
        .setDescription('ตั้งห้องส่งประกาศสต็อกผลปีศาจ Blox Fruits อัตโนมัติทุกรอบรีเซ็ต')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(opt =>
            opt.setName('channel').setDescription('เลือกห้องแชทที่จะให้บอทส่งสต็อกอัตโนมัติ').setRequired(true)
        ),

    // --- ระบบเลเวลและแรงค์ (Leveling & Rank) ---
    new SlashCommandBuilder()
        .setName('rank')
        .setDescription('ดูเลเวล ค่าประสบการณ์ EXP และความคืบหน้าในการแชทของคุณหรือเพื่อน')
        .addUserOption(opt => opt.setName('user').setDescription('เลือกสมาชิกที่ต้องการดู').setRequired(false)),
    new SlashCommandBuilder()
        .setName('rank-leaderboard')
        .setDescription('ดูตารางอันดับผู้ใช้ที่มีเลเวลและ EXP สูงสุดในเซิร์ฟเวอร์'),

    // --- ระบบ AFK ---
    new SlashCommandBuilder()
        .setName('afk')
        .setDescription('ตั้งสถานะไม่อยู่ (AFK) พร้อมเหตุผล บอทจะแจ้งเตือนเมื่อมีคนแท็กคุณ')
        .addStringOption(opt => opt.setName('reason').setDescription('เหตุผล เช่น ไปกินข้าว, ทำการบ้าน...').setRequired(false)),

    // --- ระบบมินิเกมและการเดิมพัน (Mini-games / Gambling) ---
    new SlashCommandBuilder()
        .setName('slots')
        .setDescription('เล่นสล็อตแมชชีนเดิมพันเหรียญ ลุ้นรับแจ็คพอต 10 เท่า!')
        .addIntegerOption(opt => opt.setName('bet').setDescription('จำนวนเหรียญที่ต้องการเดิมพัน').setRequired(true).setMinValue(10)),
    new SlashCommandBuilder()
        .setName('coinflip')
        .setDescription('โยนเหรียญทายหัว-ก้อย ลุ้นรับเหรียญ 2 เท่า!')
        .addStringOption(opt =>
            opt.setName('choice')
                .setDescription('เลือกทายหัว หรือ ก้อย')
                .setRequired(true)
                .addChoices(
                    { name: '🪙 หัว (Heads)', value: 'heads' },
                    { name: '🦅 ก้อย (Tails)', value: 'tails' }
                )
        )
        .addIntegerOption(opt => opt.setName('bet').setDescription('จำนวนเหรียญที่ต้องการเดิมพัน').setRequired(true).setMinValue(10)),
    new SlashCommandBuilder()
        .setName('rps')
        .setDescription('เป่ายิ้งฉุบกับบอท ชนะรับเหรียญ 2 เท่า เสมอคืนทุน!')
        .addStringOption(opt =>
            opt.setName('choice')
                .setDescription('เลือกออก ค้อน กรรไกร หรือ กระดาษ')
                .setRequired(true)
                .addChoices(
                    { name: '✊ ค้อน (Rock)', value: 'rock' },
                    { name: '✌️ กรรไกร (Scissors)', value: 'scissors' },
                    { name: '🖐️ กระดาษ (Paper)', value: 'paper' }
                )
        )
        .addIntegerOption(opt => opt.setName('bet').setDescription('จำนวนเหรียญที่ต้องการเดิมพัน').setRequired(true).setMinValue(10)),
    new SlashCommandBuilder()
        .setName('dice')
        .setDescription('ทอยลูกเต๋า 6 หน้า ทายถูกรับเงิน 5 เท่า!')
        .addIntegerOption(opt => opt.setName('guess').setDescription('ตัวเลขที่ทาย (1 - 6)').setRequired(true).setMinValue(1).setMaxValue(6))
        .addIntegerOption(opt => opt.setName('bet').setDescription('จำนวนเหรียญที่ต้องการเดิมพัน').setRequired(true).setMinValue(10)),

    // --- ระบบ Welcome, Logs, Auto-Role, Stats, Auto-Mod (Carl-bot Extra) ---
    new SlashCommandBuilder()
        .setName('set-welcome')
        .setDescription('ตั้งห้องส่งการ์ดต้อนรับสมาชิกใหม่และแจ้งเตือนเมื่อสมาชิกออก')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(opt => opt.setName('channel').setDescription('เลือกห้องต้อนรับ').setRequired(true)),
    new SlashCommandBuilder()
        .setName('set-autorole')
        .setDescription('ตั้งยศที่จะแจกอัตโนมัติให้สมาชิกใหม่ทุกคนเมื่อเข้าเซิร์ฟเวอร์')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addRoleOption(opt => opt.setName('role').setDescription('เลือกยศสมาชิกใหม่อัตโนมัติ').setRequired(true)),
    new SlashCommandBuilder()
        .setName('set-logs')
        .setDescription('ตั้งห้องบันทึกประวัติการกระทำ (Mod Logs / Audit Logs)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(opt => opt.setName('channel').setDescription('เลือกห้องบันทึก Logs').setRequired(true)),
    new SlashCommandBuilder()
        .setName('setup-stats')
        .setDescription('สร้างหมวดหมู่ห้องเสียงแสดงสถิติจำนวนสมาชิกสด (Live Server Stats)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder()
        .setName('automod')
        .setDescription('เปิด/ปิดระบบตรวจจับลิงก์เชิญเซิร์ฟเวอร์อื่นและป้องกันสแปมข้อความ')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addBooleanOption(opt => opt.setName('anti_invite').setDescription('เปิดระบบลบลิงก์เชิญดิสคอร์ดอื่นอัตโนมัติ (Anti-Invite)').setRequired(true))
        .addBooleanOption(opt => opt.setName('anti_spam').setDescription('เปิดระบบป้องกันการส่งข้อความรัวรัว (Anti-Spam)').setRequired(true)),


    // --- ระบบ Blox Fruits Trading & Value Calculator ---
    new SlashCommandBuilder()
        .setName('bf-value')
        .setDescription('ดูมูลค่าเทรดจริง ค่าความต้องการ (Demand) และแนวโน้มราคาของผลปีศาจ')
        .addStringOption(opt =>
            opt.setName('fruit').setDescription('ชื่อผลปีศาจ เช่น Dough, Kitsune, Buddha, Leopard...').setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('bf-trade')
        .setDescription('เครื่องคำนวณและประเมินผลการเทรด Blox Fruits (Trade Calculator) วิเคราะห์กำไร/ขาดทุน')
        .addStringOption(opt =>
            opt.setName('your_fruits').setDescription('ผลฝั่งคุณ (คั่นด้วยจุลภาค เช่น Dough, Buddha)').setRequired(true)
        )
        .addStringOption(opt =>
            opt.setName('their_fruits').setDescription('ผลฝั่งเขา (คั่นด้วยจุลภาค เช่น Leopard, T-Rex)').setRequired(true)
        ),

    // --- ระบบ Voice Master (ห้องเสียงส่วนตัวอัตโนมัติ) ---
    new SlashCommandBuilder()
        .setName('setup-voicemaster')
        .setDescription('ติดตั้งระบบห้องเสียงส่วนตัวอัตโนมัติ (Click to Create Voice Channel)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),


    // --- ระบบเศรษฐกิจ & ธนาคาร (Economy & Bank 2.0) ---
    new SlashCommandBuilder()
        .setName('bank')
        .setDescription('ดูยอดเงินสดในกระเป๋า บัญชีธนาคาร และมูลค่าทรัพย์สินรวม (Net Worth)')
        .addUserOption(opt => opt.setName('user').setDescription('เลือกสมาชิกที่ต้องการดู').setRequired(false)),
    new SlashCommandBuilder()
        .setName('deposit')
        .setDescription('ฝากเงินสดเข้าธนาคารเพื่อความปลอดภัย (ป้องกันการถูกปล้น)')
        .addStringOption(opt => opt.setName('amount').setDescription('จำนวนเงินที่ต้องการฝาก หรือพิมพ์ all').setRequired(true)),
    new SlashCommandBuilder()
        .setName('withdraw')
        .setDescription('ถอนเงินจากธนาคารเข้ากระเป๋าเงินสด')
        .addStringOption(opt => opt.setName('amount').setDescription('จำนวนเงินที่ต้องการถอน หรือพิมพ์ all').setRequired(true)),
    new SlashCommandBuilder()
        .setName('work')
        .setDescription('ทำงานหาเหรียญตามสายอาชีพ (คูลดาวน์ 30 นาที)'),
    new SlashCommandBuilder()
        .setName('rob')
        .setDescription('พยายามปล้นเงินสดจากสมาชิกคนอื่น (มีโอกาสโดนจับและเสียค่าปรับ)')
        .addUserOption(opt => opt.setName('user').setDescription('สมาชิกที่ต้องการปล้น').setRequired(true)),

    // --- ระบบร้านค้าเซิร์ฟเวอร์ (Server Shop) ---
    new SlashCommandBuilder()
        .setName('shop')
        .setDescription('ดูรายการสินค้าและยศพิเศษในร้านค้าของเซิร์ฟเวอร์'),
    new SlashCommandBuilder()
        .setName('buy')
        .setDescription('ซื้อสินค้าหรือยศพิเศษจากร้านค้าเซิร์ฟเวอร์ด้วยเหรียญ')
        .addStringOption(opt => opt.setName('item_id').setDescription('รหัสสินค้า (Item ID)').setRequired(true)),
    new SlashCommandBuilder()
        .setName('shop-add')
        .setDescription('เพิ่มยศหรือสินค้าลงในร้านค้าเซิร์ฟเวอร์')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(opt => opt.setName('name').setDescription('ชื่อสินค้า/ยศ').setRequired(true))
        .addIntegerOption(opt => opt.setName('price').setDescription('ราคาเหรียญ').setRequired(true).setMinValue(1))
        .addRoleOption(opt => opt.setName('role').setDescription('ยศที่จะมอบให้เมื่อซื้อ').setRequired(true))
        .addStringOption(opt => opt.setName('description').setDescription('คำอธิบายสินค้า').setRequired(false)),
    new SlashCommandBuilder()
        .setName('shop-remove')
        .setDescription('ลบสินค้าออกจากร้านค้าเซิร์ฟเวอร์')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(opt => opt.setName('item_id').setDescription('รหัสสินค้า (Item ID) ที่ต้องการลบ').setRequired(true)),
    // --- ระบบ Docomin Shop & Reputation (รีวิว, ชำระเงิน, แคตตาล็อก, ตั๋วสั่งซื้อ) ---
    new SlashCommandBuilder()
        .setName('vouch')
        .setDescription('ส่งรีวิว ให้คะแนนดาว และบันทึกเครดิตการซื้อขาย (Docomin Shop)')
        .addUserOption(opt => opt.setName('seller').setDescription('ผู้ขายหรือร้านค้าที่ซื้อของด้วย').setRequired(true))
        .addIntegerOption(opt =>
            opt.setName('stars')
                .setDescription('คะแนนความพึงพอใจ 1-5 ดาว')
                .setRequired(true)
                .addChoices(
                    { name: '⭐⭐⭐⭐⭐ (5 ดาว - ดีเยี่ยม)', value: 5 },
                    { name: '⭐⭐⭐⭐☆ (4 ดาว - ดีมาก)', value: 4 },
                    { name: '⭐⭐⭐☆☆ (3 ดาว - ปานกลาง)', value: 3 },
                    { name: '⭐⭐☆☆☆ (2 ดาว - พอใช้)', value: 2 },
                    { name: '⭐☆☆☆☆ (1 ดาว - ปรับปรุง)', value: 1 }
                )
        )
        .addStringOption(opt => opt.setName('comment').setDescription('ความคิดเห็นและคำชมเชย').setRequired(true))
        .addStringOption(opt => opt.setName('item').setDescription('ชื่อสินค้าที่ซื้อ (เช่น ผล Kitsune ถาวร)').setRequired(true))
        .addStringOption(opt => opt.setName('proof').setDescription('ลิงก์รูปภาพสลิปหรือหลักฐานการซื้อขาย').setRequired(false)),

    new SlashCommandBuilder()
        .setName('reputation')
        .setDescription('ดูประวัติเครดิต คะแนนความน่าเชื่อถือ และรีวิวจากลูกค้า')
        .addUserOption(opt => opt.setName('user').setDescription('เลือกสมาชิกหรือร้านค้าที่ต้องการดู').setRequired(false)),

    new SlashCommandBuilder()
        .setName('set-review-channel')
        .setDescription('ตั้งห้องส่งการ์ดรีวิวและเครดิตอัตโนมัติ (Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(opt => opt.setName('channel').setDescription('ห้องที่จะให้บอทส่งการ์ดรีวิว').setRequired(true)),

    new SlashCommandBuilder()
        .setName('payment')
        .setDescription('ดูช่องทางการชำระเงินอย่างเป็นทางการของร้าน Docomin Shop (PromptPay / ธนาคาร)'),

    new SlashCommandBuilder()
        .setName('pay-qr')
        .setDescription('สร้าง QR Code พร้อมเพย์ตามยอดเงินที่ระบุ เพื่อสแกนจ่ายได้ทันที')
        .addNumberOption(opt => opt.setName('amount').setDescription('จำนวนเงินที่ต้องชำระ (บาท)').setRequired(true).setMinValue(1))
        .addStringOption(opt => opt.setName('note').setDescription('หมายเหตุคำสั่งซื้อ').setRequired(false)),

    new SlashCommandBuilder()
        .setName('set-payment')
        .setDescription('ตั้งค่าช่องทางการรับชำระเงินของร้านค้า (เปิดหน้าต่างกรอกข้อมูล หรือพิมพ์ออปชัน)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(opt => opt.setName('promptpay').setDescription('เบอร์พร้อมเพย์ หรือ เลขบัตร ปชช.').setRequired(false))
        .addStringOption(opt => opt.setName('bank_name').setDescription('ชื่อธนาคาร (เช่น กสิกรไทย, SCB, กรุงไทย)').setRequired(false))
        .addStringOption(opt => opt.setName('bank_account').setDescription('เลขที่บัญชีธนาคาร').setRequired(false))
        .addStringOption(opt => opt.setName('account_name').setDescription('ชื่อบัญชีผู้รับเงิน').setRequired(false))
        .addStringOption(opt => opt.setName('truemoney').setDescription('เบอร์ TrueMoney หรือ ลิงก์ซองของขวัญ').setRequired(false)),

    new SlashCommandBuilder()
        .setName('products')
        .setDescription('ดูแคตตาล็อกสินค้าและสต็อกพร้อมส่งของร้าน Docomin Shop')
        .addStringOption(opt =>
            opt.setName('category')
                .setDescription('เลือกหมวดหมู่สินค้า')
                .setRequired(false)
                .addChoices(
                    { name: '📦 ทั้งหมด (All Items)', value: 'all' },
                    { name: '🍎 Blox Fruits (ผลปีศาจ/ไอดี)', value: 'blox_fruits' },
                    { name: '🪙 Robux & บัตรเติมเงิน', value: 'robux' },
                    { name: '🚀 Discord Nitro', value: 'nitro' },
                    { name: '⚔️ บริการฟาร์ม / เควส', value: 'services' },
                    { name: '🎁 สินค้าอื่นๆ', value: 'other' }
                )
        ),

    new SlashCommandBuilder()
        .setName('product-add')
        .setDescription('เพิ่มหรืออัปเดตสินค้าในร้าน Docomin Shop (Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(opt => opt.setName('id').setDescription('รหัสสินค้า (ID เช่น BF-KIT-P, ROBUX-100)').setRequired(true))
        .addStringOption(opt => opt.setName('name').setDescription('ชื่อสินค้า').setRequired(true))
        .addNumberOption(opt => opt.setName('price').setDescription('ราคา (บาท)').setRequired(true).setMinValue(1))
        .addIntegerOption(opt => opt.setName('stock').setDescription('จำนวนสต็อกสินค้าพร้อมส่ง').setRequired(true).setMinValue(0))
        .addStringOption(opt =>
            opt.setName('category')
                .setDescription('หมวดหมู่สินค้า')
                .setRequired(true)
                .addChoices(
                    { name: '🍎 Blox Fruits (ผลปีศาจ/ไอดี)', value: 'blox_fruits' },
                    { name: '🪙 Robux & บัตรเติมเงิน', value: 'robux' },
                    { name: '🚀 Discord Nitro', value: 'nitro' },
                    { name: '⚔️ บริการฟาร์ม / เควส', value: 'services' },
                    { name: '🎁 สินค้าอื่นๆ', value: 'other' }
                )
        )
        .addStringOption(opt => opt.setName('description').setDescription('รายละเอียดสินค้า').setRequired(false))
        .addStringOption(opt => opt.setName('image_url').setDescription('ลิงก์รูปภาพสินค้า').setRequired(false)),

    new SlashCommandBuilder()
        .setName('product-remove')
        .setDescription('ลบสินค้าออกจากร้าน Docomin Shop (Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(opt => opt.setName('id').setDescription('รหัสสินค้า (ID) ที่ต้องการลบ').setRequired(true)),

    new SlashCommandBuilder()
        .setName('product-stock')
        .setDescription('แก้ไขจำนวนสต็อกสินค้าในร้าน Docomin Shop (Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(opt => opt.setName('id').setDescription('รหัสสินค้า (ID)').setRequired(true))
        .addIntegerOption(opt => opt.setName('stock').setDescription('จำนวนสต็อกใหม่').setRequired(true).setMinValue(0)),

    new SlashCommandBuilder()
        .setName('setup-order-ticket')
        .setDescription('ติดตั้งแผงตั๋วสั่งซื้อสินค้าและบริการ Docomin Service Desk (Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(opt => opt.setName('channel').setDescription('ห้องที่จะส่งแผงตั๋ว').setRequired(false)),

    new SlashCommandBuilder()
        .setName('setup-docomin-shop')
        .setDescription('ติดตั้งหมวดหมู่และระบบร้านค้า Docomin Shop ครบวงจรใน 1 วินาที (Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('coupon-create')
        .setDescription('สร้างโค้ดคูปองส่วนลดสำหรับร้านค้า (Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(opt => opt.setName('code').setDescription('ชื่อโค้ดคูปอง เช่น DOCOMIN10').setRequired(true))
        .addNumberOption(opt => opt.setName('discount').setDescription('มูลค่าส่วนลด (เช่น 10 สำหรับ 10% หรือ 50 สำหรับ 50 บาท)').setRequired(true).setMinValue(1))
        .addStringOption(opt =>
            opt.setName('type')
                .setDescription('ประเภทส่วนลด')
                .setRequired(true)
                .addChoices(
                    { name: '📊 เปอร์เซ็นต์ (%)', value: 'percent' },
                    { name: '💵 ลดเป็นบาทคงที่ (฿)', value: 'fixed' }
                )
        )
        .addNumberOption(opt => opt.setName('min_spend').setDescription('ยอดซื้อขั้นต่ำ (บาท)').setRequired(false).setMinValue(0))
        .addIntegerOption(opt => opt.setName('max_uses').setDescription('จำนวนสิทธิ์การใช้ (เว้นว่างไว้คือไม่จำกัด)').setRequired(false).setMinValue(1)),

    new SlashCommandBuilder()
        .setName('coupon-check')
        .setDescription('ตรวจสอบความถูกต้องและมูลค่าของโค้ดส่วนลด')
        .addStringOption(opt => opt.setName('code').setDescription('โค้ดคูปองที่ต้องการตรวจสอบ').setRequired(true)),

    new SlashCommandBuilder()
        .setName('coupon-list')
        .setDescription('ดูรายการโค้ดคูปองส่วนลดทั้งหมดของร้านค้า (Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('coupon-delete')
        .setDescription('ลบคูปองส่วนลดออกจากระบบ (Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(opt => opt.setName('code').setDescription('ชื่อโค้ดคูปองที่ต้องการลบ').setRequired(true)),

    new SlashCommandBuilder()
        .setName('sales-summary')
        .setDescription('ดูรายงานสรุปยอดขาย รายได้รวม ออเดอร์ และสินค้าขายดี (Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('vip')
        .setDescription('ดูระดับสมาชิก VIP ส่วนลดพิเศษ และความคืบหน้าการเลื่อนระดับของคุณ'),

    new SlashCommandBuilder()
        .setName('my-orders')
        .setDescription('ดูประวัติรายการสั่งซื้อและยอดใช้จ่ายของคุณในร้าน Docomin Shop'),

    new SlashCommandBuilder()
        .setName('notify-restock')
        .setDescription('ลงทะเบียนรับการแจ้งเตือนทันทีเมื่อสินค้าที่เลือกเติมสต็อก')
        .addStringOption(opt => opt.setName('product_id').setDescription('รหัสสินค้า (เช่น BF-KIT-P หรือ BF-DOUGH)').setRequired(true)),

    new SlashCommandBuilder()
        .setName('order-status')
        .setDescription('ตรวจสอบสถานะและรายละเอียดคำสั่งซื้อด้วยรหัสคำสั่งซื้อ')
        .addStringOption(opt => opt.setName('order_id').setDescription('รหัสออเดอร์ หรือ รหัสห้องตั๋ว').setRequired(true)),

    new SlashCommandBuilder()
        .setName('blacklist')
        .setDescription('ระบบจัดการบัญชีดำ (Blacklist Guard) ตรวจสอบ/เพิ่ม/ปลดรายชื่อ')
        .addStringOption(opt =>
            opt.setName('action')
                .setDescription('การกระทำที่ต้องการ')
                .setRequired(true)
                .addChoices(
                    { name: '🔍 ตรวจสอบประวัติ (Check)', value: 'check' },
                    { name: '🚨 เพิ่มเข้าบัญชีดำ (Add)', value: 'add' },
                    { name: '🟢 ปลดออกจากบัญชีดำ (Remove)', value: 'remove' }
                )
        )
        .addUserOption(opt => opt.setName('user').setDescription('เลือกผู้ใช้ที่ต้องการตรวจสอบหรือจัดการ').setRequired(true))
        .addStringOption(opt => opt.setName('reason').setDescription('สาเหตุที่ขึ้นบัญชีดำ (จำเป็นเมื่อเลือก Add)').setRequired(false)),

    new SlashCommandBuilder()
        .setName('restock-alert')
        .setDescription('ประกาศแจ้งเตือนสต็อกสินค้าเข้าใหม่ให้สมาชิกทราบ (Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(opt => opt.setName('product_id').setDescription('รหัสสินค้า (ID) ที่เติมสต็อก').setRequired(true))
        .addIntegerOption(opt => opt.setName('stock').setDescription('จำนวนสต็อกที่เติม').setRequired(true).setMinValue(1))
        .addStringOption(opt => opt.setName('message').setDescription('ข้อความประกาศพิเศษ').setRequired(false)),

    new SlashCommandBuilder()
        .setName('panel')
        .setDescription('เปิดแผงควบคุมเซิร์ฟเวอร์และร้านค้าครบวงจร (Master Control Panel)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('sync')
        .setDescription('บังคับซิงค์และอัปเดตคำสั่ง Slash ในเซิร์ฟเวอร์ทันที (Force Sync Slash Commands)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('ai-admin')
        .setDescription('สั่งการให้ Gemini AI ช่วยจัดการเซิร์ฟเวอร์ด้วยภาษาไทย (ลบข้อความ, ล็อกห้อง, สร้างห้อง, ประกาศ)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(opt => opt.setName('prompt').setDescription('คำสั่งที่ต้องการให้ AI ปฏิบัติการ').setRequired(true)),

    new SlashCommandBuilder()
        .setName('shop-broadcast')
        .setDescription('บรอดแคสต์โปรโมชั่น Flash Sale หรือประกาศพิเศษพร้อมปุ่มสั่งซื้อทันที (Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(opt => opt.setName('title').setDescription('หัวข้อโปรโมชั่น เช่น 🔥 FLASH SALE ลด 20% คืนนี้เท่านั้น!').setRequired(true))
        .addStringOption(opt => opt.setName('description').setDescription('รายละเอียดโปรโมชั่น / เงื่อนไข').setRequired(true))
        .addChannelOption(opt => opt.setName('channel').setDescription('ห้องที่จะส่งการ์ดประกาศ (เว้นว่างไว้คือส่งห้องนี้)').setRequired(false))
        .addStringOption(opt => opt.setName('coupon_code').setDescription('โค้ดคูปองส่วนลดพิเศษที่จะแจกในโพสต์ (Optional)').setRequired(false))
        .addStringOption(opt => opt.setName('image_url').setDescription('ลิงก์รูปภาพแบนเนอร์โปรโมชั่น (Optional)').setRequired(false))
        .addStringOption(opt =>
            opt.setName('ping')
                .setDescription('การแท็กสมาชิก')
                .setRequired(false)
                .addChoices(
                    { name: 'ไม่มีการแท็ก (Silent)', value: 'none' },
                    { name: '🔔 แท็ก @here (เฉพาะคนที่ออนไลน์)', value: 'here' },
                    { name: '🚨 แท็ก @everyone (ทุกคน)', value: 'everyone' }
                )
        ),

    new SlashCommandBuilder()
        .setName('set-customer-role')
        .setDescription('กำหนดยศพิเศษที่จะมอบให้ลูกค้าอัตโนมัติเมื่อซื้อสินค้าสำเร็จ (Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addRoleOption(opt => opt.setName('role').setDescription('ยศที่จะมอบให้ลูกค้า เช่น @ลูกค้าประจำ หรือ @Verified Buyer').setRequired(true)),

    new SlashCommandBuilder()
        .setName('stock-add-keys')
        .setDescription('เพิ่มชุดรหัส/คีย์/ไอดี เข้าสู่คลังสต็อกดิจิทัลอัตโนมัติ (Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(opt => opt.setName('product_id').setDescription('รหัสสินค้า (เช่น BF-KIT-P หรือ ROBUX-100)').setRequired(true))
        .addStringOption(opt => opt.setName('keys').setDescription('ชุดรหัส/คีย์ (คั่นด้วยเครื่องหมายจุลภาค , หรือเว้นวรรค)').setRequired(true)),

    new SlashCommandBuilder()
        .setName('db')
        .setDescription('ระบบสำรองและกู้คืนฐานข้อมูลร้านค้า (Cloud Database Backup & Restore)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(opt =>
            opt.setName('action')
                .setDescription('การกระทำที่ต้องการ')
                .setRequired(true)
                .addChoices(
                    { name: '💾 สำรองฐานข้อมูล (Backup)', value: 'backup' },
                    { name: '📥 กู้คืนฐานข้อมูล (Restore)', value: 'restore' }
                )
        )
        .addAttachmentOption(opt => opt.setName('file').setDescription('ไฟล์ database.json ที่ต้องการนำมากู้คืน (จำเป็นเมื่อเลือก Restore)').setRequired(false)),

    new SlashCommandBuilder()
        .setName('help')
        .setDescription('ดูคำสั่งทั้งหมดของบอท')
];

// ฟังก์ชันลบข้อความทีละเยอะๆ วนลูป
async function massDeleteMessages(channel, totalAmount, filterUser = null, onProgress = null) {
    let remaining = totalAmount;
    let totalDeleted = 0;
    let hitOldMessages = false;

    while (remaining > 0) {
        const fetchLimit = Math.min(remaining > 100 ? 100 : remaining, 100);
        const fetchedMessages = await channel.messages.fetch({ limit: fetchLimit });

        if (fetchedMessages.size === 0) break;

        let messagesToDelete = fetchedMessages;
        if (filterUser) {
            messagesToDelete = fetchedMessages.filter(m => m.author.id === filterUser.id);
        }

        if (messagesToDelete.size === 0) {
            remaining -= fetchLimit;
            continue;
        }

        try {
            const deleted = await channel.bulkDelete(messagesToDelete, true);
            totalDeleted += deleted.size;

            if (deleted.size < messagesToDelete.size) {
                hitOldMessages = true;
                break;
            }

            remaining -= deleted.size;

            if (onProgress && totalAmount > 100) {
                await onProgress(totalDeleted, totalAmount);
            }

            if (fetchedMessages.size < fetchLimit) break;
            if (remaining > 0) {
                await new Promise(r => setTimeout(r, 1000));
            }
        } catch (err) {
            console.error('Error during bulkDelete batch:', err);
            break;
        }
    }

    return { totalDeleted, hitOldMessages };
}

// เมื่อบอทพร้อมทำงาน
client.once('ready', async () => {
    console.log(`✅ บอทออนไลน์แล้วในชื่อ: ${client.user.tag}`);
    console.log(`🤖 ตรวจพบเซิร์ฟเวอร์ทั้งหมด ${client.guilds.cache.size} เซิร์ฟเวอร์`);

    // เริ่มต้นระบบ Web Uptime Monitor ให้ทำงานเบื้องหลัง
    uptime.start();

    // เริ่มต้นระบบ Web Server แสดง Dashboard และรองรับ Cloud Free Hosting 24/7 (Render / Koyeb)
    client.commandsCount = commands.length;
    startWebServer(client, commands.length);

    // เริ่มต้นระบบมอนิเตอร์และแจ้งเตือนสต็อก Blox Fruits เบื้องหลัง
    startStockWatcher(client);

    // เริ่มต้นระบบ Dynamic Rotating Presence (สลับสถานะบอททุกๆ 20 วินาที)
    const activities = [
        () => ({ name: '🛒 Docomin Shop • /help', type: ActivityType.Watching }),
        () => ({ name: '👑 สมาชิก VIP & ส่วนลดอัตโนมัติ', type: ActivityType.Playing }),
        () => ({ name: '🍎 เฝ้าสต็อก Blox Fruits เรียลไทม์', type: ActivityType.Competing }),
        () => {
            const totalMembers = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);
            return { name: `🛡️ ดูแล ${totalMembers.toLocaleString()} สมาชิก`, type: ActivityType.Watching };
        },
        () => ({ name: '⚡ ออนไลน์ 24/7 บน Cloud Server', type: ActivityType.Playing })
    ];
    let activityIdx = 0;
    const updatePresence = () => {
        try {
            const act = activities[activityIdx % activities.length]();
            client.user.setPresence({
                activities: [act],
                status: 'online'
            });
            activityIdx++;
        } catch (err) {
            // ignore presence errors
        }
    };
    updatePresence();
    setInterval(updatePresence, 20000);

    const rest = new REST({ version: '10' }).setToken(TOKEN);
    const cmdData = commands.map(cmd => cmd.toJSON());

    // 1. ลงทะเบียนคำสั่งเข้าแต่ละเซิร์ฟเวอร์โดยตรง (Guild Commands) เพื่อให้อัปเดตทันที
    for (const [guildId, guild] of client.guilds.cache) {
        try {
            await rest.put(
                Routes.applicationGuildCommands(client.user.id, guildId),
                { body: cmdData }
            );
            console.log(`⚡ ลงทะเบียน Slash Commands ทันทีให้เซิร์ฟเวอร์: ${guild.name} (${guildId}) [${commands.length} คำสั่ง]`);
        } catch (error) {
            console.error(`❌ ลงทะเบียนคำสั่งให้เซิร์ฟเวอร์ ${guild.name} ไม่สำเร็จ:`, error);
        }
    }

    // 2. เคลียร์ Global Commands เก่าออก เพื่อป้องกันคำสั่งขึ้นซ้ำ 2 ชุด
    try {
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: [] }
        );
        console.log('🧹 เคลียร์คำสั่ง Global ออกเรียบร้อย (ป้องกันปัญหาคำสั่งซ้ำ)!');
    } catch (error) {
        console.error('❌ เคลียร์ Global Commands ไม่สำเร็จ:', error);
    }
});

// เมื่อบอทถูกเชิญเข้าเซิร์ฟเวอร์ใหม่ ให้ลงทะเบียนคำสั่งทันที
client.on('guildCreate', async guild => {
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        await rest.put(
            Routes.applicationGuildCommands(client.user.id, guild.id),
            { body: commands.map(cmd => cmd.toJSON()) }
        );
        console.log(`⚡ ลงทะเบียนคำสั่งให้เซิร์ฟเวอร์ใหม่เรียบร้อย: ${guild.name}`);
    } catch (e) {
        console.error(e);
    }
});

// จัดการ Interaction ทั้งหมด (Slash Commands, Select Menus, Buttons, Modals)
client.on('interactionCreate', async interaction => {
    // 1. จัดการ Modal Submit (เมื่อพิมพ์ชื่อเพลงในกล่องค้นหา)
    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'modal_music_search') {
            const query = interaction.fields.getTextInputValue('input_music_query');
            return music.searchAndSelect(interaction, query);
        }
        if (interaction.customId.startsWith('modal_vm_')) {
            return voicemaster.handleVoiceModal(interaction);
        }

        // --- Panel Modals ---
        if (interaction.customId === 'modal_panel_purge') {
            await interaction.deferReply({ ephemeral: true });
            const countStr = interaction.fields.getTextInputValue('purge_count');
            const count = Math.min(Math.max(parseInt(countStr) || 20, 1), 100);
            try {
                const fetched = await interaction.channel.messages.fetch({ limit: count }).catch(() => null);
                if (fetched && fetched.size > 0) {
                    const deleted = await interaction.channel.bulkDelete(fetched, true).catch(() => null);
                    return interaction.editReply(`🧹 ลบข้อความในห้องนี้เรียบร้อยแล้วจำนวน **${deleted ? deleted.size : 0}** ข้อความ`);
                }
                return interaction.editReply('⚠️ ไม่พบข้อความที่สามารถลบได้ในห้องนี้');
            } catch (e) {
                return interaction.editReply(`❌ เกิดข้อผิดพลาดในการลบข้อความ: ${e.message}`);
            }
        }

        if (interaction.customId === 'modal_panel_ai_prompt') {
            await interaction.deferReply();
            const instruction = interaction.fields.getTextInputValue('ai_instruction');
            try {
                const aiResult = await executeAiServerManagement(client, interaction.guild, interaction.member, interaction.channel, instruction);
                const aiEmbed = new EmbedBuilder()
                    .setColor(aiResult.success ? 0x5865F2 : 0xED4245)
                    .setTitle('🤖 ผลการสั่งการ Gemini AI Admin')
                    .setDescription(`🧠 **วิเคราะห์:** ${aiResult.thought}\n⚡ **การกระทำ:** \`${aiResult.action}\`\n\n${aiResult.summary}`)
                    .setFooter({ text: 'Docomin AI Server Manager • Zero Demo' })
                    .setTimestamp();
                return interaction.editReply({ embeds: [aiEmbed] });
            } catch (e) {
                return interaction.editReply(`❌ เกิดข้อผิดพลาดในการสั่งงาน AI: ${e.message}`);
            }
        }

        if (interaction.customId === 'modal_panel_add_product') {
            await interaction.deferReply({ ephemeral: true });
            const id = interaction.fields.getTextInputValue('product_id').trim();
            const name = interaction.fields.getTextInputValue('product_name').trim();
            const price = parseFloat(interaction.fields.getTextInputValue('product_price')) || 0;
            const stock = parseInt(interaction.fields.getTextInputValue('product_stock')) || 0;
            const category = interaction.fields.getTextInputValue('product_category').trim();

            db.addProduct(interaction.guildId, {
                id,
                name,
                price,
                stock,
                category,
                description: `สินค้า ${name} พร้อมส่งทันที`
            });

            return interaction.editReply(`✅ เพิ่มสินค้า **${name}** (รหัส: \`${id}\`) ราคา **${price}** บาท สต็อก **${stock}** ชิ้น ลงในร้านค้าสำเร็จ!`);
        }

        // --- Docomin Shop Modals ---
        if (interaction.customId === 'modal_order_buy_submit') {
            await interaction.deferReply({ ephemeral: true });
            const itemName = interaction.fields.getTextInputValue('order_item_name');
            const quantity = interaction.fields.getTextInputValue('order_quantity');
            const paymentMethod = interaction.fields.getTextInputValue('order_payment_method');
            const gameInfo = interaction.fields.getTextInputValue('order_game_info') || 'ไม่ระบุ';
            const note = interaction.fields.getTextInputValue('order_note') || 'ไม่มี';

            try {
                const channelName = `🛒-ออเดอร์-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9_-]/g, '');
                const ticketChannel = await interaction.guild.channels.create({
                    name: channelName || `order-${interaction.user.id.slice(-4)}`,
                    type: ChannelType.GuildText,
                    parent: interaction.channel.parentId || null,
                    permissionOverwrites: [
                        { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory] },
                        { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.EmbedLinks] }
                    ]
                });

                const ticketData = {
                    guildId: interaction.guildId,
                    userId: interaction.user.id,
                    type: 'buy',
                    itemName,
                    quantity,
                    paymentMethod,
                    gameInfo,
                    note,
                    status: 'open'
                };
                db.setOrderTicket(ticketChannel.id, ticketData);

                const orderDossierEmbed = new EmbedBuilder()
                    .setColor(0x57F287)
                    .setTitle(`🛒 ใบสั่งซื้อสินค้าใหม่ — ${interaction.user.username}`)
                    .setDescription(`สวัสดี <@${interaction.user.id}> ยินดีต้อนรับสู่ห้องสั่งซื้อสินค้า Docomin Shop!\nทีมงานได้รับรายละเอียดการสั่งซื้อของคุณเรียบร้อยแล้ว กำลังตรวจสอบและติดต่อกลับโดยเร็วที่สุด`)
                    .addFields(
                        { name: '📦 สินค้าที่สั่ง', value: `\`${itemName}\``, inline: true },
                        { name: '🔢 จำนวน', value: `\`${quantity}\``, inline: true },
                        { name: '💳 ช่องทางชำระเงิน', value: `\`${paymentMethod}\``, inline: true },
                        { name: '👤 ข้อมูลในเกม / รับของ', value: `\`${gameInfo}\``, inline: false },
                        { name: '📝 หมายเหตุ / คูปอง', value: `\`${note}\``, inline: false }
                    )
                    .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                    .setFooter({ text: 'Docomin Shop Service Desk • จัดการออเดอร์' })
                    .setTimestamp();

                const actionBtns = docominShop.createTicketActionButtons(ticketChannel.id);
                await ticketChannel.send({
                    content: `<@${interaction.user.id}> ยินดีต้อนรับครับ! ทีมงานกำลังมาให้บริการครับ`,
                    embeds: [orderDossierEmbed],
                    components: [actionBtns]
                });

                // 1. ตรวจสอบสถานะบัญชีดำ (Blacklist Guard)
                const blacklisted = db.getBlacklist(interaction.user.id);
                if (blacklisted) {
                    const blEmbed = docominShop.createBlacklistEmbed(interaction.user, blacklisted);
                    await ticketChannel.send({
                        content: '🚨 @here **แจ้งเตือนความปลอดภัย (Security Alert):** สมาชิกที่เปิดตั๋วนี้มีประวัติอยู่ในบัญชีดำ (Blacklist)! แอดมินโปรดระมัดระวังและตรวจสอบอย่างละเอียดก่อนทำธุรกรรม',
                        embeds: [blEmbed]
                    });
                }

                // 2. คำนวณราคาและส่วนลดสมาชิก VIP อัตโนมัติ (VIP Loyalty Program)
                const products = db.getProducts(interaction.guildId);
                const itemQuery = (itemName || '').trim().toLowerCase();
                const foundProduct = products.find(p => 
                    p.id.toLowerCase() === itemQuery ||
                    p.name.toLowerCase().includes(itemQuery) ||
                    itemQuery.includes(p.name.toLowerCase()) ||
                    (itemQuery.includes('ไก่ตัน') && p.name.includes('ไก่ตัน')) ||
                    (itemQuery.includes('kitsune') && p.name.toLowerCase().includes('kitsune')) ||
                    (itemQuery.includes('dragon') && p.name.toLowerCase().includes('dragon')) ||
                    (itemQuery.includes('dough') && p.name.toLowerCase().includes('dough'))
                );

                const qty = parseInt(quantity) || 1;
                const baseAmount = foundProduct && foundProduct.price ? foundProduct.price * qty : 150;
                const vipStats = db.getCustomerStats(interaction.guildId, interaction.user.id);

                let finalAmount = baseAmount;
                let vipDiscount = 0;
                let vipNote = '';

                if (vipStats.discountPercent > 0 && baseAmount > 0) {
                    vipDiscount = Math.round((baseAmount * vipStats.discountPercent) / 100);
                    finalAmount = Math.max(0, baseAmount - vipDiscount);
                    vipNote = `\n👑 สิทธิพิเศษ ${vipStats.tierName}: ลดทันที ${vipStats.discountPercent}% (-฿${vipDiscount.toLocaleString()} บาท)`;
                    
                    // บันทึกลงตั๋ว
                    ticketData.originalAmount = baseAmount;
                    ticketData.discount = vipDiscount;
                    ticketData.netAmount = finalAmount;
                    ticketData.vipTier = vipStats.tier;
                    db.setOrderTicket(ticketChannel.id, ticketData);

                    await ticketChannel.send({
                        content: `🎉 ยินดีต้อนรับคุณ <@${interaction.user.id}> ลูกค้าคนพิเศษระดับ **${vipStats.tierName}**!\nระบบได้มอบส่วนลดอัตโนมัติให้คุณ **${vipStats.discountPercent}%** (-฿${vipDiscount.toLocaleString()} บาท) ยอดสุทธิเหลือเพียง **฿${finalAmount.toLocaleString()}** บาท ✨`
                    });
                } else {
                    ticketData.originalAmount = baseAmount;
                    ticketData.netAmount = baseAmount;
                    db.setOrderTicket(ticketChannel.id, ticketData);
                }

                const payEmbed = docominShop.createPaymentEmbed(
                    interaction.guildId,
                    finalAmount,
                    `คำสั่งซื้อ: ${itemName} (x${qty})${vipNote}`
                );
                const payRow = docominShop.createPaymentActionRow(ticketChannel.id);
                await ticketChannel.send({
                    content: '💳 **ช่องทางการชำระเงินสำหรับคำสั่งซื้อของคุณ:**',
                    embeds: [payEmbed],
                    components: [payRow]
                });

                return interaction.editReply({ content: `✅ สร้างห้องตั๋วสั่งซื้อสำเร็จ! ไปที่ห้อง: <#${ticketChannel.id}>` });
            } catch (err) {
                console.error(err);
                return interaction.editReply({ content: `❌ ไม่สามารถสร้างห้องตั๋วได้: ${err.message}` });
            }
        }

        if (interaction.customId === 'modal_order_inquiry_submit') {
            await interaction.deferReply({ ephemeral: true });
            const topic = interaction.fields.getTextInputValue('inquiry_topic');
            const details = interaction.fields.getTextInputValue('inquiry_details');

            try {
                const channelName = `❓-สอบถาม-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9_-]/g, '');
                const ticketChannel = await interaction.guild.channels.create({
                    name: channelName || `inquiry-${interaction.user.id.slice(-4)}`,
                    type: ChannelType.GuildText,
                    parent: interaction.channel.parentId || null,
                    permissionOverwrites: [
                        { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory] },
                        { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.EmbedLinks] }
                    ]
                });

                db.setOrderTicket(ticketChannel.id, {
                    guildId: interaction.guildId,
                    userId: interaction.user.id,
                    type: 'inquiry',
                    topic,
                    details,
                    status: 'open'
                });

                const embed = new EmbedBuilder()
                    .setColor(0x5865F2)
                    .setTitle(`❓ ตั๋วสอบถามข้อมูล — ${interaction.user.username}`)
                    .setDescription(`สวัสดี <@${interaction.user.id}> ทีมงานแอดมินพร้อมตอบคำถามของคุณแล้วครับ`)
                    .addFields(
                        { name: '📌 หัวข้อที่สอบถาม', value: `\`${topic}\``, inline: false },
                        { name: '📝 รายละเอียด', value: details, inline: false }
                    )
                    .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                    .setFooter({ text: 'Docomin Shop Service Desk' })
                    .setTimestamp();

                const actionBtns = docominShop.createTicketActionButtons(ticketChannel.id);
                await ticketChannel.send({
                    content: `<@${interaction.user.id}> ทีมงานจะมาตอบคำถามให้โดยเร็วที่สุดครับ`,
                    embeds: [embed],
                    components: [actionBtns]
                });

                return interaction.editReply({ content: `✅ สร้างห้องตั๋วสอบถามสำเร็จ! ไปที่ห้อง: <#${ticketChannel.id}>` });
            } catch (err) {
                console.error(err);
                return interaction.editReply({ content: `❌ ไม่สามารถสร้างห้องตั๋วได้: ${err.message}` });
            }
        }

        if (interaction.customId === 'modal_order_claim_submit') {
            await interaction.deferReply({ ephemeral: true });
            const claimId = interaction.fields.getTextInputValue('claim_order_id');
            const description = interaction.fields.getTextInputValue('claim_description');

            try {
                const channelName = `🛠️-เคลม-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9_-]/g, '');
                const ticketChannel = await interaction.guild.channels.create({
                    name: channelName || `claim-${interaction.user.id.slice(-4)}`,
                    type: ChannelType.GuildText,
                    parent: interaction.channel.parentId || null,
                    permissionOverwrites: [
                        { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory] },
                        { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.EmbedLinks] }
                    ]
                });

                db.setOrderTicket(ticketChannel.id, {
                    guildId: interaction.guildId,
                    userId: interaction.user.id,
                    type: 'claim',
                    claimId,
                    description,
                    status: 'open'
                });

                const embed = new EmbedBuilder()
                    .setColor(0xED4245)
                    .setTitle(`🛠️ แจ้งปัญหาและเคลมสินค้า — ${interaction.user.username}`)
                    .setDescription(`สวัสดี <@${interaction.user.id}> ทีมงานได้รับเรื่องการเคลมสินค้าของคุณแล้ว เราจะเร่งตรวจสอบและแก้ปัญหาให้อย่างเร่งด่วนครับ`)
                    .addFields(
                        { name: '📦 รหัสออเดอร์ / สินค้า', value: `\`${claimId}\``, inline: false },
                        { name: '⚠️ ปัญหาที่พบ', value: description, inline: false }
                    )
                    .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                    .setFooter({ text: 'Docomin Shop Warranty & Claim Desk' })
                    .setTimestamp();

                const actionBtns = docominShop.createTicketActionButtons(ticketChannel.id);
                await ticketChannel.send({
                    content: `<@${interaction.user.id}> กรุณาเตรียมสลิปหรือหลักฐานแนบไว้ในห้องนี้ได้เลยครับ ทีมงานจะรีบเข้ามาตรวจสอบทันที`,
                    embeds: [embed],
                    components: [actionBtns]
                });

                return interaction.editReply({ content: `✅ สร้างห้องแจ้งปัญหาสำเร็จ! ไปที่ห้อง: <#${ticketChannel.id}>` });
            } catch (err) {
                console.error(err);
                return interaction.editReply({ content: `❌ ไม่สามารถสร้างห้องตั๋วได้: ${err.message}` });
            }
        }

        if (interaction.customId === 'modal_set_payment_submit') {
            await interaction.deferReply({ ephemeral: true });
            const promptpay = interaction.fields.getTextInputValue('payment_promptpay').trim();
            const accountName = interaction.fields.getTextInputValue('payment_account_name').trim();
            const bankName = interaction.fields.getTextInputValue('payment_bank_name').trim();
            const bankAccount = interaction.fields.getTextInputValue('payment_bank_account').trim();
            const truemoney = interaction.fields.getTextInputValue('payment_truemoney')?.trim() || '';

            db.setPaymentConfig(interaction.guildId, {
                promptpay,
                bankName,
                bankAccount,
                accountName,
                truemoney
            });

            const confirmEmbed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle('✅ บันทึกข้อมูลบัญชีรับเงินสำเร็จ!')
                .setDescription('ข้อมูลบัญชีและช่องทางการรับเงินของร้านค้าถูกอัปเดตเรียบร้อยแล้ว')
                .addFields(
                    { name: '📱 พร้อมเพย์', value: `\`${promptpay}\``, inline: true },
                    { name: '🏦 บัญชีธนาคาร', value: `**${bankName}** (\`${bankAccount}\`)`, inline: true },
                    { name: '👤 ชื่อบัญชี', value: `\`${accountName}\``, inline: true }
                )
                .setFooter({ text: 'Docomin Shop Payment System • Real EMVCo QR' })
                .setTimestamp();

            if (truemoney) {
                confirmEmbed.addFields({ name: '🧡 TrueMoney', value: `\`${truemoney}\``, inline: false });
            }

            await interaction.editReply({ embeds: [confirmEmbed] });

            // หากอยู่ในห้องตั๋วออเดอร์ ให้ส่งการ์ด QR โค้ดที่อัปเดตข้อมูลจริงให้ทันที
            const ticket = db.getOrderTicket(interaction.channelId);
            if (ticket) {
                const products = db.getProducts(interaction.guildId);
                const itemQuery = (ticket.itemName || '').trim().toLowerCase();
                const foundProduct = products.find(p => 
                    p.id.toLowerCase() === itemQuery ||
                    p.name.toLowerCase().includes(itemQuery) ||
                    itemQuery.includes(p.name.toLowerCase()) ||
                    (itemQuery.includes('ไก่ตัน') && p.name.includes('ไก่ตัน'))
                );
                const qty = parseInt(ticket.quantity) || 1;
                const amount = foundProduct ? foundProduct.price * qty : null;
                const embed = docominShop.createPaymentEmbed(interaction.guildId, amount, `คำสั่งซื้อ: ${ticket.itemName} (x${qty})`);
                const row = docominShop.createPaymentActionRow(interaction.channelId);
                await interaction.channel.send({ content: '🔄 **อัปเดตช่องทางชำระเงินใหม่ (ข้อมูลจริง):**', embeds: [embed], components: [row] });
            }
            return;
        }

        if (interaction.customId === 'modal_angpao_submit') {
            await interaction.deferReply();
            const link = interaction.fields.getTextInputValue('angpao_link').trim();
            const amount = interaction.fields.getTextInputValue('angpao_amount').trim();
            const note = interaction.fields.getTextInputValue('angpao_note')?.trim() || '';

            const angpaoEmbed = new EmbedBuilder()
                .setColor(0xFF8200)
                .setTitle('🧧 แจ้งชำระเงินด้วยซองของขวัญ TrueMoney')
                .setDescription(`ลูกค้า <@${interaction.user.id}> ได้ส่งซองของขวัญ TrueMoney เรียบร้อยแล้ว!`)
                .addFields(
                    { name: '💰 ยอดเงินในซอง', value: `\`฿${amount} บาท\``, inline: true },
                    { name: '🔗 ลิงก์ซองของขวัญ', value: `\`\`\`fix\n${link}\n\`\`\``, inline: false }
                )
                .setFooter({ text: 'Docomin Shop TrueMoney Service Desk' })
                .setTimestamp();

            if (note) {
                angpaoEmbed.addFields({ name: '📝 หมายเหตุ', value: note, inline: false });
            }

            const adminActionRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`btn_admin_deliver_${interaction.channelId}`)
                    .setLabel('✅ รับยอดแล้ว & ส่งมอบสินค้า')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅'),
                new ButtonBuilder()
                    .setCustomId(`btn_admin_reject_slip_${interaction.channelId}`)
                    .setLabel('❌ ซองไม่ถูกต้อง / ซองหมดอายุ')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('❌')
            );

            return interaction.editReply({
                content: `🔔 แจ้งเตือนแอดมิน: มีการส่งซองของขวัญ TrueMoney ครับ!`,
                embeds: [angpaoEmbed],
                components: [adminActionRow]
            });
        }

        if (interaction.customId.startsWith('modal_admin_deliver_')) {
            await interaction.deferReply({ ephemeral: true });
            const channelId = interaction.customId.replace('modal_admin_deliver_', '');
            const deliverContent = interaction.fields.getTextInputValue('deliver_content');
            const deliverGuide = interaction.fields.getTextInputValue('deliver_guide');

            const ticket = db.getOrderTicket(channelId);
            if (!ticket) {
                return interaction.editReply('❌ ไม่พบข้อมูลตั๋วคำสั่งซื้อนี้');
            }

            const deliveryEmbed = docominShop.createDeliveryEmbed(ticket, deliverContent, deliverGuide, interaction.user);
            const vouchRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`btn_customer_vouch_${channelId}`)
                    .setLabel('⭐ ให้คะแนนและรีวิวร้านค้า (Vouch)')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('⭐')
            );

            // ส่งข้อมูลในห้องตั๋ว
            const targetChannel = interaction.guild.channels.cache.get(channelId);
            if (targetChannel) {
                await targetChannel.send({
                    content: `🎉 <@${ticket.userId}> สินค้าของคุณได้รับการจัดส่งแล้วครับ!`,
                    embeds: [deliveryEmbed],
                    components: [vouchRow]
                });
            }

            // ส่งข้อมูลเข้า DM ของลูกค้า
            let buyer = null;
            try {
                buyer = await interaction.client.users.fetch(ticket.userId);
                if (buyer) {
                    await buyer.send({
                        content: `🎉 สินค้าที่คุณสั่งซื้อจาก **Docomin Shop** ได้รับการจัดส่งแล้ว!`,
                        embeds: [deliveryEmbed],
                        components: [vouchRow]
                    });
                }
            } catch (dmErr) {
                console.log('DM to customer failed (DMs closed):', dmErr.message);
            }

            // ตัดสต็อกสินค้าอัตโนมัติ (Auto Stock Deduction)
            const products = db.getProducts(interaction.guildId);
            const itemQuery = (ticket.itemName || '').trim().toLowerCase();
            const foundProduct = products.find(p => 
                p.id.toLowerCase() === itemQuery ||
                p.name.toLowerCase().includes(itemQuery) ||
                itemQuery.includes(p.name.toLowerCase()) ||
                (itemQuery.includes('ไก่ตัน') && p.name.includes('ไก่ตัน')) ||
                (itemQuery.includes('kitsune') && p.name.toLowerCase().includes('kitsune')) ||
                (itemQuery.includes('dragon') && p.name.toLowerCase().includes('dragon')) ||
                (itemQuery.includes('dough') && p.name.toLowerCase().includes('dough'))
            );

            const qty = parseInt(ticket.quantity) || 1;
            let finalStock = null;
            if (foundProduct) {
                finalStock = Math.max(0, (foundProduct.stock || 0) - qty);
                db.updateProductStock(interaction.guildId, foundProduct.id, finalStock);
                if (finalStock === 0 && targetChannel) {
                    await targetChannel.send(`⚠️ **แจ้งเตือนสต็อกสินค้า:** สินค้า **${foundProduct.name}** (\`${foundProduct.id}\`) สต็อกหมดแล้ว! ทีมงานสามารถใช้ \`/product-stock\` หรือ \`/restock-alert\` เพื่อเติมสต็อก`).catch(() => {});
                }
            }

            // บันทึกยอดขายลงในระบบบัญชีและการวิเคราะห์ (Sales Analytics Recording)
            const originalAmount = ticket.originalAmount || (foundProduct ? foundProduct.price * qty : 150);
            const finalAmount = ticket.netAmount !== undefined ? ticket.netAmount : originalAmount;
            db.recordSale(interaction.guildId, {
                orderId: channelId,
                customerId: ticket.userId,
                customerTag: buyer ? buyer.tag : 'Customer',
                productId: foundProduct ? foundProduct.id : null,
                productName: ticket.itemName || 'สินค้า',
                quantity: qty,
                originalAmount,
                amount: finalAmount,
                discount: ticket.discount || 0,
                couponCode: ticket.couponCode || null,
                adminId: interaction.user.id,
                adminTag: interaction.user.tag
            });

            // ปรับสถานะตั๋วเป็นสำเร็จ
            ticket.status = 'completed';
            ticket.completedAt = Date.now();
            ticket.deliveredBy = interaction.user.id;
            ticket.finalAmount = finalAmount;
            db.setOrderTicket(channelId, ticket);

            // มอบยศลูกค้าประจำอัตโนมัติ (Verified Customer Role)
            const custRoleId = db.getCustomerRole(interaction.guildId);
            if (custRoleId && targetChannel) {
                try {
                    const member = await interaction.guild.members.fetch(ticket.userId).catch(() => null);
                    if (member && !member.roles.cache.has(custRoleId)) {
                        await member.roles.add(custRoleId);
                        await targetChannel.send(`🎖️ ยินดีด้วย <@${ticket.userId}>! คุณได้รับยศลูกค้า <@&${custRoleId}> ประจำเซิร์ฟเวอร์เรียบร้อยแล้ว ✨`).catch(() => {});
                    }
                } catch (rErr) {
                    // ignore role assign error
                }
            }

            // ส่งไฟล์สำรองฐานข้อมูลอัตโนมัติไปยังห้อง Log (Auto Cloud Backup Snapshot)
            const logChannelId = db.getSetting('logs_' + interaction.guildId);
            if (logChannelId) {
                const logCh = interaction.guild.channels.cache.get(logChannelId);
                if (logCh && logCh.isTextBased()) {
                    const bBuffer = Buffer.from(db.backupDB(), 'utf-8');
                    await logCh.send({
                        content: `💾 **Cloud Database Snapshot Auto-Backup** (บันทึกอัตโนมัติเมื่อจัดส่งออเดอร์ #${channelId} สำเร็จ)`,
                        files: [{ attachment: bBuffer, name: `database-backup-${Date.now()}.json` }]
                    }).catch(() => {});
                }
            }

            return interaction.editReply('✅ ส่งมอบสินค้าให้ลูกค้าเรียบร้อยแล้ว ทั้งในตั๋วและ DM พร้อมตัดสต็อก, มอบยศลูกค้า และสำรองฐานข้อมูลอัตโนมัติ!');
        }

        if (interaction.customId.startsWith('modal_apply_coupon_')) {
            await interaction.deferReply();
            const channelId = interaction.customId.replace('modal_apply_coupon_', '');
            const code = interaction.fields.getTextInputValue('coupon_code').trim().toUpperCase();

            const ticket = db.getOrderTicket(channelId);
            if (!ticket) {
                return interaction.editReply('❌ ไม่พบข้อมูลตั๋วคำสั่งซื้อนี้');
            }

            const coupon = db.getCoupon(interaction.guildId, code);
            if (!coupon) {
                return interaction.editReply(`❌ ไม่พบโค้ดคูปอง **"${code}"** ในระบบ หรือโค้ดหมดอายุแล้ว`);
            }

            if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
                return interaction.editReply(`❌ โค้ดคูปอง **"${code}"** ถูกใช้งานจนครบสิทธิ์แล้ว`);
            }

            if (coupon.users && coupon.users.includes(interaction.user.id)) {
                return interaction.editReply(`❌ คุณเคยใช้โค้ดคูปอง **"${code}"** ไปแล้ว`);
            }

            // คำนวณราคาเริ่มต้น
            const products = db.getProducts(interaction.guildId);
            const itemQuery = (ticket.itemName || '').trim().toLowerCase();
            const foundProduct = products.find(p => 
                p.id.toLowerCase() === itemQuery ||
                p.name.toLowerCase().includes(itemQuery) ||
                itemQuery.includes(p.name.toLowerCase()) ||
                (itemQuery.includes('ไก่ตัน') && p.name.includes('ไก่ตัน')) ||
                (itemQuery.includes('kitsune') && p.name.toLowerCase().includes('kitsune')) ||
                (itemQuery.includes('dragon') && p.name.toLowerCase().includes('dragon')) ||
                (itemQuery.includes('dough') && p.name.toLowerCase().includes('dough'))
            );

            const qty = parseInt(ticket.quantity) || 1;
            const originalPrice = foundProduct && foundProduct.price ? foundProduct.price * qty : 150;

            if (coupon.minSpend > 0 && originalPrice < coupon.minSpend) {
                return interaction.editReply(`❌ คูปองนี้ใช้ได้เมื่อมียอดสั่งซื้อขั้นต่ำ **฿${coupon.minSpend.toLocaleString()} บาท** (ยอดปัจจุบัน: ฿${originalPrice.toLocaleString()} บาท)`);
            }

            let discount = 0;
            if (coupon.type === 'percent') {
                discount = Math.round((originalPrice * coupon.discount) / 100);
            } else {
                discount = Math.min(originalPrice, coupon.discount);
            }

            const netAmount = Math.max(0, originalPrice - discount);

            ticket.originalAmount = originalPrice;
            ticket.discount = discount;
            ticket.netAmount = netAmount;
            ticket.couponCode = coupon.code;
            db.setOrderTicket(channelId, ticket);
            db.useCoupon(interaction.guildId, coupon.code, interaction.user.id);

            const newPaymentEmbed = docominShop.createPaymentEmbed(
                interaction.guildId,
                netAmount,
                `คำสั่งซื้อ: ${ticket.itemName} (x${qty})\n🎟️ ใช้คูปองส่วนลด: \`${coupon.code}\` (-฿${discount.toLocaleString()} บาท)`
            );
            const row = docominShop.createPaymentActionRow(channelId);

            await interaction.channel.send({
                content: `🎉 <@${interaction.user.id}> ใช้งานคูปอง **${coupon.code}** สำเร็จ! ได้รับส่วนลด **฿${discount.toLocaleString()}** บาท ยอดชำระสุทธิใหม่: **฿${netAmount.toLocaleString()}** บาท`,
                embeds: [newPaymentEmbed],
                components: [row]
            });

            return interaction.editReply(`✅ ใช้งานคูปอง **${coupon.code}** เรียบร้อยแล้ว! ปรับยอดยอดชำระสุทธิเป็น **฿${netAmount.toLocaleString()}** บาท`);
        }

        if (interaction.customId.startsWith('modal_vouch_submit_')) {
            await interaction.deferReply({ ephemeral: true });
            const sellerId = interaction.customId.replace('modal_vouch_submit_', '') || interaction.client.user.id;
            const stars = parseInt(interaction.fields.getTextInputValue('vouch_stars')) || 5;
            const comment = interaction.fields.getTextInputValue('vouch_comment');
            const item = interaction.fields.getTextInputValue('vouch_item');

            const newVouch = db.addVouch({
                sellerId,
                buyerId: interaction.user.id,
                buyerTag: interaction.user.tag,
                guildId: interaction.guildId,
                stars,
                comment,
                item
            });

            // ส่งไปยังห้องรีวิวเครดิตหากตั้งค่าไว้
            const reviewChId = db.getReviewChannel(interaction.guildId);
            const reviewChannel = reviewChId ? interaction.guild.channels.cache.get(reviewChId) : null;
            const vouchEmbed = docominShop.createVouchEmbed(newVouch, interaction.user, null);

            if (reviewChannel) {
                await reviewChannel.send({ embeds: [vouchEmbed] }).catch(() => {});
            } else {
                await interaction.channel.send({ embeds: [vouchEmbed] }).catch(() => {});
            }

            return interaction.editReply('⭐ ขอบคุณสำหรับคะแนนรีวิวและความไว้วางใจครับ! เครดิตของคุณถูกบันทึกเรียบร้อยแล้ว ❤️');
        }
    }

    // 2. จัดการ StringSelectMenu (เมื่อเลือกเพลงจากรายการค้นหา)
    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'menu_select_music') {
            return music.handleSelectMenu(interaction);
        }
        if (interaction.customId === 'select_vm_kick') {
            return voicemaster.handleVoiceSelect(interaction);
        }

        // เมนูเลือกผลปีศาจที่ต้องการรับแจ้งเตือน
        if (interaction.customId === 'bloxfruits_select_alert') {
            const selectedFruitIds = interaction.values;
            db.setUserBloxFruitsAlerts(interaction.user.id, selectedFruitIds);

            const selectedFruits = FRUITS.filter(f => selectedFruitIds.includes(f.id));
            const listText = selectedFruits.length > 0
                ? selectedFruits.map((f, i) => `${i + 1}. **${f.name}** (${f.thName}) - \`${f.rarity}\``).join('\n')
                : '*ไม่มีผลที่เลือกไว้ (ปิดการแจ้งเตือนทั้งหมด)*';

            const embed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle('✅ บันทึกรายการแจ้งเตือนผลปีศาจสำเร็จ!')
                .setDescription(`เมื่อผลปีศาจตามรายการด้านล่างนี้เข้ามาในร้านค้า **Blox Fruit Dealer** ระบบจะส่งข้อความแจ้งเตือนพร้อมรูปภาพของผลนั้นให้คุณทันที!\n\n${listText}`)
                .setFooter({ text: 'คุณสามารถพิมพ์คำสั่ง /bloxfruits-alert เพื่อเปลี่ยนแปลงรายการได้ตลอดเวลา' })
                .setTimestamp();

            return interaction.update({ embeds: [embed], components: [] });
        }

        // เมนูเลือกหมวดหมู่สินค้า Docomin Shop
        if (interaction.customId === 'select_shop_category') {
            const selected = interaction.values[0].replace('cat_', '');
            const products = db.getProducts(interaction.guildId, selected);
            const embed = docominShop.createCatalogEmbed(products, selected);
            const menu = docominShop.createCatalogSelectMenu(products);
            return interaction.update({ embeds: [embed], components: [menu] });
        }

        // เมนูเลือกหมวดหมู่ใน Panel
        if (interaction.customId === 'panel_select_section') {
            const section = interaction.values[0];
            if (section === 'section_shop') {
                const products = db.getProducts(interaction.guildId);
                const desc = products.length > 0
                    ? products.slice(0, 15).map((p, i) => `${i + 1}. **${p.name}** (\`${p.id}\`) — ราคา: **${p.price}** บาท | สต็อก: **${p.stock}** ชิ้น`).join('\n')
                    : '*ยังไม่มีสินค้าในร้านค้า*';

                const shopEmbed = new EmbedBuilder()
                    .setColor(0x5865F2)
                    .setTitle('🛒 จัดการร้านค้า — Docomin Shop Manager')
                    .setDescription(`**รายการสินค้าปัจจุบัน (${products.length} รายการ):**\n\n${desc}\n\n` +
                        `💡 **คำสั่งลัดเพิ่มเติม:**\n` +
                        `• \`/product-add\`: เพิ่มสินค้าใหม่พร้อมรูปภาพ\n` +
                        `• \`/product-stock\`: ปรับแก้จำนวนสต็อกสินค้า\n` +
                        `• \`/product-remove\`: ลบสินค้าออกจากร้าน\n` +
                        `• \`/set-payment\`: ตั้งค่าพร้อมเพย์และธนาคาร\n` +
                        `• \`/setup-docomin-shop\`: สร้างหมวดหมู่และห้องร้านค้า (ไม่ซ้ำ 100%)`)
                    .setFooter({ text: 'Docomin Shop Management' });

                return interaction.reply({ embeds: [shopEmbed], ephemeral: true });
            }

            if (section === 'section_sales') {
                const stats = db.getSalesAnalytics(interaction.guildId);
                const vouchStats = db.getVouchStats(client.user.id);
                const embed = docominShop.createSalesSummaryEmbed(stats, vouchStats);
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            if (section === 'section_moderation') {
                const modEmbed = new EmbedBuilder()
                    .setColor(0xED4245)
                    .setTitle('🛡️ จัดการความปลอดภัย & ข้อความ — Moderation Tools')
                    .setDescription(`**เครื่องมือดูแลความสงบเรียบร้อย:**\n\n` +
                        `• 🧹 **ลบข้อความด่วน:** กดปุ่ม **"ลบข้อความด่วน"** ในแผงควบคุม หรือใช้ \`/purge count:จำนวน\`\n` +
                        `• 🔒 **ล็อก/ปลดล็อกห้อง:** กดปุ่ม **"สลับล็อกห้องนี้"** ในแผงควบคุม หรือใช้ \`/lock\` และ \`/unlock\`\n` +
                        `• ⏱️ **หน่วงเวลา:** ใช้คำสั่ง \`/slowmode seconds:วินาที\`\n` +
                        `• 🚫 **ปิดการสนทนา/เตะ/แบน:** ใช้คำสั่ง \`/timeout\`, \`/kick\`, \`/ban\``)
                    .setFooter({ text: 'Moderation System' });

                return interaction.reply({ embeds: [modEmbed], ephemeral: true });
            }

            if (section === 'section_ai') {
                return interaction.showModal(panel.createAiPromptModal());
            }

            if (section === 'section_setup') {
                const setupEmbed = new EmbedBuilder()
                    .setColor(0x57F287)
                    .setTitle('⚙️ ติดตั้งระบบอัตโนมัติ (Smart Setup with Zero Duplicates)')
                    .setDescription(`เลือกติดตั้งระบบที่คุณต้องการ โดยระบบมีระบบป้องกันห้องซ้ำซ้อน 100%:\n\n` +
                        `1. **ติดตั้งร้านค้า Docomin Shop:** พิมพ์คำสั่ง \`/setup-docomin-shop\`\n` +
                        `2. **จัดระเบียบหมวดหมู่เซิร์ฟเวอร์:** พิมพ์คำสั่ง \`/auto-setup\`\n` +
                        `3. **ติดตั้งห้องเสียงส่วนตัว:** พิมพ์คำสั่ง \`/setup-voicemaster\`\n` +
                        `4. **ติดตั้งโต๊ะเปิดตั๋วบริการ:** พิมพ์คำสั่ง \`/setup-order-ticket\``)
                    .setFooter({ text: 'Smart Setup Assistant' });

                return interaction.reply({ embeds: [setupEmbed], ephemeral: true });
            }

            if (section === 'section_sync') {
                await interaction.deferReply({ ephemeral: true });
                const rest = new REST({ version: '10' }).setToken(TOKEN);
                try {
                    const cmdData = commands.map(c => c.toJSON());
                    await rest.put(
                        Routes.applicationGuildCommands(client.user.id, interaction.guildId),
                        { body: cmdData }
                    );
                    return interaction.editReply(`⚡ **ซิงค์คำสั่งสำเร็จทั้งหมด ${cmdData.length} คำสั่ง!**\n` +
                        `✅ พร้อมใช้งานในเซิร์ฟเวอร์ **${interaction.guild.name}** ทันที\n` +
                        `💡 หากยังไม่เห็นคำสั่งใหม่บน Discord ให้กด **Ctrl + R** บนคอมพิวเตอร์ หรือเลื่อนปิดเปิดแอป Discord ในมือถือใหม่อีกครั้งครับ!`);
                } catch (e) {
                    return interaction.editReply(`❌ ซิงค์คำสั่งไม่สำเร็จ: ${e.message}`);
                }
            }
        }
    }

    // 3. จัดการคำสั่ง Slash Commands
    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        // --- แผงควบคุมระบบ (Master Control Panel) ---
        if (commandName === 'panel' || commandName === 'admin-panel') {
            const panelData = panel.createPanelEmbedAndRows(interaction.guild, client);
            return interaction.reply(panelData);
        }

        // --- ซิงค์คำสั่งทั้งหมดทันที (Force Sync) ---
        if (commandName === 'sync') {
            await interaction.deferReply({ ephemeral: true });
            const rest = new REST({ version: '10' }).setToken(TOKEN);
            try {
                const cmdData = commands.map(cmd => cmd.toJSON());
                await rest.put(
                    Routes.applicationGuildCommands(client.user.id, interaction.guildId),
                    { body: cmdData }
                );
                return interaction.editReply(`⚡ **ซิงค์คำสั่ง Slash เรียบร้อยแล้ว! ทั้งหมด ${cmdData.length} คำสั่ง**\n` +
                    `✅ พร้อมใช้งานในเซิร์ฟเวอร์ **${interaction.guild.name}** ทันที\n` +
                    `💡 หากยังไม่เห็นคำสั่งใหม่บน Discord ให้กด **Ctrl + R** บนคอมพิวเตอร์ หรือเลื่อนปิดเปิดแอป Discord ในมือถือใหม่อีกครั้งครับ!`);
            } catch (err) {
                return interaction.editReply(`❌ ซิงค์คำสั่งไม่สำเร็จ: ${err.message}`);
            }
        }

        // --- ผู้ช่วย Gemini AI จัดการเซิร์ฟเวอร์ (AI Admin Assistant) ---
        if (commandName === 'ai-admin') {
            const prompt = interaction.options.getString('prompt');
            await interaction.deferReply();

            try {
                const aiResult = await executeAiServerManagement(client, interaction.guild, interaction.member, interaction.channel, prompt);
                const aiEmbed = new EmbedBuilder()
                    .setColor(aiResult.success ? 0x5865F2 : 0xED4245)
                    .setTitle('🤖 ผลการสั่งการ Gemini AI Admin')
                    .setDescription(`🧠 **วิเคราะห์:** ${aiResult.thought}\n⚡ **การกระทำ:** \`${aiResult.action}\`\n\n${aiResult.summary}`)
                    .setFooter({ text: 'Docomin AI Server Manager • Zero Demo' })
                    .setTimestamp();

                return interaction.editReply({ embeds: [aiEmbed] });
            } catch (err) {
                return interaction.editReply(`❌ เกิดข้อผิดพลาดจาก AI: ${err.message}`);
            }
        }

        // --- ระบบถามตอบ Gemini AI ---
        if (commandName === 'ask') {
            const prompt = interaction.options.getString('prompt');
            await interaction.deferReply();

            try {
                const answer = await askGemini(prompt);
                
                const embed = new EmbedBuilder()
                    .setColor(0x4285F4)
                    .setTitle('✨ คำตอบจาก Gemini AI')
                    .setDescription(answer.length > 4000 ? answer.substring(0, 3995) + '...' : answer)
                    .addFields(
                        { name: '❓ คำถาม', value: `\`\`\`${prompt}\`\`\`` }
                    )
                    .setFooter({ text: 'Powered by Google Gemini 3.8 Flash • ถามต่อได้เรื่อยๆ' })
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });
            } catch (err) {
                return interaction.editReply(`❌ เกิดข้อผิดพลาดจาก AI: ${err.message}`);
            }
        }

        // --- ระบบ Web Uptime Monitor ---
        if (commandName === 'uptime-add') {
            const url = interaction.options.getString('url');
            await interaction.deferReply({ ephemeral: true });

            const res = await uptime.add(url, interaction.user.id);
            if (!res.success) {
                return interaction.editReply('⚠️ URL นี้มีอยู่ในระบบมอนิเตอร์แล้ว!');
            }

            const embed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle('🌐 เพิ่มเว็บไซต์ในระบบ Uptime Monitor สำเร็จ!')
                .setDescription(`ระบบจะทำการยิงสัญญาณปิงไปที่เว็บไซต์นี้ทุกๆ **2 นาที** เพื่อให้เซิร์ฟเวอร์ออนตลอด 24 ชั่วโมง`)
                .addFields(
                    { name: '🔗 URL', value: res.data.url },
                    { name: '📡 สถานะเริ่มต้น', value: res.testPing.success ? `🟢 ออนไลน์ (HTTP ${res.testPing.statusCode})` : `🔴 ออฟไลน์ (${res.testPing.error || res.testPing.statusCode})`, inline: true },
                    { name: '⚡ เวลาตอบสนอง', value: `${res.testPing.responseTime} ms`, inline: true }
                )
                .setFooter({ text: 'Uptime 24/7 Keeper' });

            return interaction.editReply({ embeds: [embed] });
        }

        if (commandName === 'uptime-remove') {
            const url = interaction.options.getString('url');
            const removed = uptime.remove(url);
            return interaction.reply({
                content: removed ? `✅ ลบเว็บไซต์ **${url}** ออกจากระบบมอนิเตอร์เรียบร้อยแล้ว` : `❌ ไม่พบ URL ดังกล่าวในระบบ`,
                ephemeral: true
            });
        }

        if (commandName === 'uptime-list') {
            const list = uptime.list();
            if (!list || list.length === 0) {
                return interaction.reply({ content: '🌐 ยังไม่มีเว็บไซต์ใดในระบบมอนิเตอร์ สามารถใช้คำสั่ง `/uptime-add` เพื่อเพิ่มเว็บได้เลย', ephemeral: true });
            }

            const desc = list.map((item, idx) => {
                const statusDot = item.status === 'online' ? '🟢' : '🔴';
                const timeAgo = item.lastPing ? `<t:${Math.floor(item.lastPing / 1000)}:R>` : 'ยังไม่ได้ปิง';
                return `**${idx + 1}.** ${statusDot} [${item.url}](${item.url})\n↳ สถานะ: **${item.status}** (${item.statusCode || 0}) | ⚡ **${item.responseTime || 0}ms** | ล่าสุด: ${timeAgo} | รวม: **${item.totalPings || 0}** ครั้ง`;
            }).join('\n\n');

            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle(`🌐 รายการเว็บไซต์ที่มอนิเตอร์อยู่ (${list.length} เว็บ)`)
                .setDescription(desc)
                .setFooter({ text: 'ปิงอัตโนมัติทุกๆ 2 นาทีเพื่อให้ออนตลอดเวลา' });

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // --- ระบบ Auto-Setup Server ---
        if (commandName === 'auto-setup') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ คุณต้องมีสิทธิ์ Administrator จึงจะใช้คำสั่งนี้ได้', ephemeral: true });
            }
            await interaction.deferReply();
            return runAutoSetup(interaction.guild, interaction);
        }

        // --- ระบบ Moderation สไตล์ Carl-bot ---
        if (commandName === 'kick') {
            const target = interaction.options.getMember('user');
            const reason = interaction.options.getString('reason') || 'ไม่ได้ระบุเหตุผล';

            if (!target) return interaction.reply({ content: '❌ ไม่พบสมาชิกดังกล่าวในเซิร์ฟเวอร์', ephemeral: true });
            if (!target.kickable) return interaction.reply({ content: '❌ บอทไม่สามารถเตะสมาชิกคนนี้ได้ (ยศของบอทต้องอยู่สูงกว่า)', ephemeral: true });

            await target.kick(reason);
            const embed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle('👢 เตะสมาชิกเรียบร้อย')
                .setDescription(`เตะ **${target.user.tag}** ออกจากเซิร์ฟเวอร์\n📝 **เหตุผล:** ${reason}\n👮 **ดำเนินการโดย:** <@${interaction.user.id}>`);
            return interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'ban') {
            const target = interaction.options.getMember('user');
            const reason = interaction.options.getString('reason') || 'ไม่ได้ระบุเหตุผล';

            if (!target) return interaction.reply({ content: '❌ ไม่พบสมาชิกดังกล่าว', ephemeral: true });
            if (!target.bannable) return interaction.reply({ content: '❌ บอทไม่สามารถแบนสมาชิกคนนี้ได้', ephemeral: true });

            await target.ban({ reason });
            const embed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle('🔨 แบนสมาชิกเรียบร้อย')
                .setDescription(`แบน **${target.user.tag}** ถาวร\n📝 **เหตุผล:** ${reason}\n👮 **ดำเนินการโดย:** <@${interaction.user.id}>`);
            return interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'unban') {
            const userId = interaction.options.getString('userid');
            try {
                await interaction.guild.bans.remove(userId);
                return interaction.reply(`✅ ปลดแบนผู้ใช้ ID: \`${userId}\` สำเร็จเรียบร้อย`);
            } catch (e) {
                return interaction.reply({ content: `❌ ไม่สามารถปลดแบนได้: ${e.message}`, ephemeral: true });
            }
        }

        if (commandName === 'timeout') {
            const target = interaction.options.getMember('user');
            const mins = interaction.options.getInteger('minutes');
            const reason = interaction.options.getString('reason') || 'ไม่ได้ระบุเหตุผล';

            if (!target) return interaction.reply({ content: '❌ ไม่พบสมาชิก', ephemeral: true });
            if (!target.moderatable) return interaction.reply({ content: '❌ บอทไม่สามารถปิดเสียงสมาชิกคนนี้ได้', ephemeral: true });

            await target.timeout(mins * 60 * 1000, reason);
            const embed = new EmbedBuilder()
                .setColor(0xFEE75C)
                .setTitle('🔇 ปิดการสนทนาชั่วคราว (Timeout)')
                .setDescription(`ปิดเสียง <@${target.id}> เป็นเวลา **${mins}** นาที\n📝 **เหตุผล:** ${reason}\n👮 **ดำเนินการโดย:** <@${interaction.user.id}>`);
            return interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'warn') {
            const target = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason');

            const warnObj = db.addWarning(target.id, interaction.user.id, reason);
            const allWarns = db.getWarnings(target.id);

            const embed = new EmbedBuilder()
                .setColor(0xFEE75C)
                .setTitle('⚠️ ตักเตือนสมาชิก (Warn)')
                .setDescription(`ตักเตือน <@${target.id}>\n📝 **เหตุผล:** ${reason}\n🔢 **เตือนสะสมทั้งหมด:** ${allWarns.length} ครั้ง\n👮 **ผู้ตักเตือน:** <@${interaction.user.id}>`)
                .setFooter({ text: `Warn ID: ${warnObj.id}` })
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'warnings') {
            const target = interaction.options.getUser('user');
            const warns = db.getWarnings(target.id);

            if (warns.length === 0) {
                return interaction.reply({ content: `ℹ️ <@${target.id}> ไม่มีประวัติการถูกตักเตือน`, ephemeral: true });
            }

            const desc = warns.map((w, idx) => `**${idx + 1}.** \`${w.reason}\` (โดย <@${w.moderatorId}> <t:${Math.floor(w.timestamp / 1000)}:R>) [ID: ${w.id}]`).join('\n');
            const embed = new EmbedBuilder()
                .setColor(0xFEE75C)
                .setTitle(`📋 ประวัติการตักเตือนของ ${target.username} (${warns.length} ครั้ง)`)
                .setDescription(desc);

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (commandName === 'clear-warnings') {
            const target = interaction.options.getUser('user');
            const count = db.clearWarnings(target.id);
            return interaction.reply(`✅ ล้างประวัติการตักเตือนของ <@${target.id}> เรียบร้อยแล้ว (ทั้งหมด **${count}** รายการ)`);
        }

        if (commandName === 'slowmode') {
            const seconds = interaction.options.getInteger('seconds');
            await interaction.channel.setRateLimitPerUser(seconds);
            return interaction.reply(`⏱️ ตั้งค่า Slowmode สำหรับห้องนี้เป็น **${seconds}** วินาทีเรียบร้อยแล้ว`);
        }

        if (commandName === 'lock') {
            await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
                SendMessages: false
            });
            const embed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle('🔒 ห้องนี้ถูกล็อกแล้ว')
                .setDescription('สมาชิกทั่วไปไม่สามารถส่งข้อความในห้องนี้ได้ชั่วคราว')
                .setFooter({ text: `ล็อกโดย ${interaction.user.tag}` });
            return interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'unlock') {
            await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
                SendMessages: null
            });
            const embed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle('🔓 ปลดล็อกห้องเรียบร้อย')
                .setDescription('สมาชิกทั่วไปสามารถส่งข้อความได้ตามปกติแล้ว')
                .setFooter({ text: `ปลดล็อกโดย ${interaction.user.tag}` });
            return interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'embed') {
            const title = interaction.options.getString('title');
            const desc = interaction.options.getString('description');
            const colorInput = interaction.options.getString('color') || '#5865F2';

            let color = 0x5865F2;
            try {
                color = parseInt(colorInput.replace('#', ''), 16);
            } catch {}

            const embed = new EmbedBuilder()
                .setColor(color)
                .setTitle(title)
                .setDescription(desc)
                .setFooter({ text: `ประกาศโดย ${interaction.user.tag}` })
                .setTimestamp();

            await interaction.channel.send({ embeds: [embed] });
            return interaction.reply({ content: '✅ ส่งการ์ด Embed เรียบร้อยแล้ว!', ephemeral: true });
        }

        // --- ระบบเปิดเพลง (Music Commands) ---
        if (commandName === 'play') {
            const query = interaction.options.getString('query');
            return music.executePlay(interaction, query);
        }

        if (commandName === 'search') {
            const query = interaction.options.getString('query');
            return music.searchAndSelect(interaction, query);
        }

        if (commandName === 'music-panel') {
            await music.sendMusicPanel(interaction.channel);
            return interaction.reply({ content: '✅ ส่งแผงควบคุมเพลงเรียบร้อยแล้ว!', ephemeral: true });
        }

        if (commandName === 'skip') {
            const ok = music.skip(interaction.guildId);
            return interaction.reply({
                content: ok ? '⏭️ ข้ามไปยังเพลงถัดไปเรียบร้อยแล้ว!' : '❌ ไม่มีเพลงที่กำลังเล่นอยู่',
                ephemeral: !ok
            });
        }

        if (commandName === 'stop') {
            const ok = music.stop(interaction.guildId);
            return interaction.reply({
                content: ok ? '⏹️ หยุดเล่นเพลง ล้างคิว และออกจากห้องเสียงเรียบร้อยแล้ว' : '❌ บอทไม่ได้กำลังเล่นเพลงอยู่',
                ephemeral: !ok
            });
        }

        if (commandName === 'pause' || commandName === 'resume') {
            const state = music.pauseOrResume(interaction.guildId);
            if (!state) {
                return interaction.reply({ content: '❌ ไม่มีเพลงที่กำลังเล่นอยู่', ephemeral: true });
            }
            return interaction.reply(state === 'paused' ? '⏸️ หยุดเพลงชั่วคราวแล้ว' : '▶️ เล่นเพลงต่อแล้ว');
        }

        if (commandName === 'queue') {
            const q = music.getQueue(interaction.guildId);
            if (!q || q.songs.length === 0) {
                return interaction.reply({ content: '📜 ขณะนี้ไม่มีคิวเพลงในระบบ', ephemeral: true });
            }

            const current = q.songs[0];
            const upcoming = q.songs.slice(1, 11).map((s, idx) => `${idx + 1}. [${s.title}](${s.url}) (${s.durationRaw}) - <@${s.requestedBy.id}>`).join('\n');

            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle('📜 รายการคิวเพลง')
                .addFields(
                    { name: '🎶 กำลังเล่นอยู่', value: `[${current.title}](${current.url}) (${current.durationRaw})` },
                    { name: `📑 คิวถัดไป (${q.songs.length - 1} เพลง)`, value: upcoming || '*ไม่มีคิวถัดไป*' }
                )
                .setFooter({ text: `ทั้งหมด ${q.songs.length} เพลง` });

            return interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'nowplaying') {
            const q = music.getQueue(interaction.guildId);
            if (!q || !q.playing || q.songs.length === 0) {
                return interaction.reply({ content: '❌ ขณะนี้ไม่มีเพลงที่กำลังเล่นอยู่', ephemeral: true });
            }

            const current = q.songs[0];
            const embed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle('🎶 เพลงที่กำลังเล่นอยู่ขณะนี้')
                .setDescription(`[**${current.title}**](${current.url})`)
                .addFields(
                    { name: '⏱️ ความยาว', value: current.durationRaw || 'ไม่ระบุ', inline: true },
                    { name: '👤 ขอโดย', value: `<@${current.requestedBy.id}>`, inline: true },
                    { name: '📊 เพลงในคิว', value: `${q.songs.length} เพลง`, inline: true }
                );

            if (current.thumbnail) {
                embed.setThumbnail(current.thumbnail);
            }

            return interaction.reply({ embeds: [embed] });
        }

        // --- Roblox User ---
        if (commandName === 'roblox-user') {
            await interaction.deferReply();
            const username = interaction.options.getString('username');
            const data = await getRobloxUser(username);

            if (!data) {
                return interaction.editReply(`❌ ไม่พบข้อมูลผู้ใช้ Roblox ที่ชื่อ **${username}**`);
            }

            const embed = new EmbedBuilder()
                .setColor(0x00A2FF)
                .setTitle(`👤 ข้อมูลโปรไฟล์ Roblox: ${data.displayName} (@${data.username})`)
                .setURL(data.profileUrl)
                .addFields(
                    { name: '🆔 User ID', value: `\`${data.id}\``, inline: true },
                    { name: '📅 วันที่สมัคร', value: `<t:${Math.floor(new Date(data.created).getTime() / 1000)}:D>`, inline: true },
                    { name: '🛡️ สถานะแบน', value: data.isBanned ? '🔴 ถูกระงับบัญชี' : '🟢 ปกติ', inline: true },
                    { name: '👥 เพื่อน', value: `${data.friendCount.toLocaleString()} คน`, inline: true },
                    { name: '⭐ ผู้ติดตาม', value: `${data.followerCount.toLocaleString()} คน`, inline: true },
                    { name: '✅ ตรา Verified', value: data.hasVerifiedBadge ? 'มี' : 'ไม่มี', inline: true },
                    { name: '📝 คำอธิบาย (About)', value: data.description.length > 250 ? data.description.substring(0, 250) + '...' : data.description }
                )
                .setFooter({ text: 'Roblox Profile Lookup' })
                .setTimestamp();

            if (data.avatarUrl) {
                embed.setThumbnail(data.avatarUrl);
            }

            return interaction.editReply({ embeds: [embed] });
        }

        // --- Roblox Game ---
        if (commandName === 'roblox-game') {
            await interaction.deferReply();
            let placeInput = interaction.options.getString('placeid');
            const urlMatch = placeInput.match(/games\/(\d+)/);
            const placeId = urlMatch ? urlMatch[1] : placeInput.replace(/\D/g, '');

            if (!placeId) {
                return interaction.editReply('❌ กรุณาระบุ Place ID หรือลิงก์แมพที่ถูกต้อง เช่น: `189707` หรือ `https://www.roblox.com/games/189707/...`');
            }

            const data = await getRobloxGame(placeId);
            if (!data) {
                return interaction.editReply(`❌ ไม่พบข้อมูลแมพสำหรับ Place ID: **${placeId}**`);
            }

            const embed = new EmbedBuilder()
                .setColor(0x00D26A)
                .setTitle(`🎮 ข้อมูลแมพ Roblox: ${data.name}`)
                .setURL(data.gameUrl)
                .addFields(
                    { name: '🟢 กำลังเล่นอยู่ขณะนี้', value: `**${data.playing.toLocaleString()}** คน`, inline: true },
                    { name: '👁️ ยอดเข้าชมทั้งหมด', value: `**${data.visits.toLocaleString()}** ครั้ง`, inline: true },
                    { name: '⭐ ชื่นชอบ (Favorites)', value: `**${data.favorites.toLocaleString()}**`, inline: true },
                    { name: '👑 ผู้สร้าง', value: `${data.creatorName} (${data.creatorType})`, inline: true },
                    { name: '👥 ผู้เล่นสูงสุด/เซิร์ฟ', value: `${data.maxPlayers} คน`, inline: true },
                    { name: '🆔 Place ID', value: `\`${data.placeId}\``, inline: true }
                )
                .setDescription(data.description.length > 300 ? data.description.substring(0, 300) + '...' : data.description)
                .setFooter({ text: 'Roblox Experience Tracker' })
                .setTimestamp();

            if (data.iconUrl) {
                embed.setThumbnail(data.iconUrl);
            }

            return interaction.editReply({ embeds: [embed] });
        }

        // --- Roblox Group ---
        if (commandName === 'roblox-group') {
            await interaction.deferReply();
            let groupInput = interaction.options.getString('groupid').replace(/\D/g, '');
            const data = await getRobloxGroup(groupInput);

            if (!data) {
                return interaction.editReply(`❌ ไม่พบข้อมูลกลุ่ม Roblox ID: **${groupInput}**`);
            }

            const embed = new EmbedBuilder()
                .setColor(0xFEE75C)
                .setTitle(`👥 กลุ่ม Roblox: ${data.name}`)
                .setURL(data.groupUrl)
                .addFields(
                    { name: '👑 เจ้าของกลุ่ม', value: data.owner, inline: true },
                    { name: '👥 จำนวนสมาชิก', value: `${data.memberCount.toLocaleString()} คน`, inline: true },
                    { name: '🔒 สถานะล็อกกลุ่ม', value: data.isLocked ? '🔒 ล็อกอยู่' : '🔓 เปิดสาธารณะ', inline: true },
                    { name: '🆔 Group ID', value: `\`${data.id}\``, inline: true }
                )
                .setDescription(data.description.length > 300 ? data.description.substring(0, 300) + '...' : data.description)
                .setFooter({ text: 'Roblox Group Lookup' })
                .setTimestamp();

            if (data.iconUrl) {
                embed.setThumbnail(data.iconUrl);
            }

            return interaction.editReply({ embeds: [embed] });
        }

        // --- Roblox Bind ---
        if (commandName === 'roblox-bind') {
            await interaction.deferReply({ ephemeral: true });
            const username = interaction.options.getString('username');
            const data = await getRobloxUser(username);

            if (!data) {
                return interaction.editReply(`❌ ไม่พบชื่อผู้ใช้ **${username}** ใน Roblox`);
            }

            db.updateUser(interaction.user.id, {
                robloxUsername: data.username,
                robloxId: data.id
            });

            let nickChanged = false;
            try {
                if (interaction.member.manageable && interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageNicknames)) {
                    await interaction.member.setNickname(data.displayName || data.username);
                    nickChanged = true;
                }
            } catch {}

            return interaction.editReply({
                content: `✅ ผูกบัญชี Roblox เรียบร้อยแล้ว!\n👤 **Roblox Username:** ${data.username} (ID: ${data.id})${nickChanged ? '\n🏷️ ได้อัปเดตชื่อเล่นในดิสคอร์ดให้ตรงกันเรียบร้อยแล้ว' : ''}`
            });
        }

        // --- Setup Ticket ---
        if (commandName === 'setup-ticket') {
            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle('🎫 ศูนย์บริการติดต่อ / แจ้งปัญหา / ซื้อสินค้า')
                .setDescription('หากต้องการติดต่อทีมงาน ซื้อยศ หรือแจ้งปัญหา\nกรุณากดที่ปุ่ม **"เปิดตั๋ว (Open Ticket)"** ด้านล่างนี้เพื่อสร้างห้องส่วนตัว')
                .setFooter({ text: 'Ticket Support System' });

            const btn = new ButtonBuilder()
                .setCustomId('btn_open_ticket')
                .setLabel('🎫 เปิดตั๋ว (Open Ticket)')
                .setStyle(ButtonStyle.Primary);

            const row = new ActionRowBuilder().addComponents(btn);
            await interaction.channel.send({ embeds: [embed], components: [row] });
            return interaction.reply({ content: '✅ สร้างแผงเปิดตั๋วเรียบร้อยแล้ว!', ephemeral: true });
        }


        // --- Giveaway ---
        if (commandName === 'giveaway') {
            const prize = interaction.options.getString('prize');
            const durationMins = interaction.options.getInteger('duration_mins');
            const winnersCount = interaction.options.getInteger('winners') || 1;

            const endTimestamp = Math.floor((Date.now() + durationMins * 60 * 1000) / 1000);

            const embed = new EmbedBuilder()
                .setColor(0xEB459E)
                .setTitle(`🎉 กิจกรรมแจกของรางวัล: ${prize}`)
                .setDescription(`กดปุ่ม 🎉 ด้านล่างเพื่อเข้าร่วมกิจกรรม!\n\n👑 จำนวนผู้ชนะ: **${winnersCount}** คน\n⏳ สิ้นสุดใน: <t:${endTimestamp}:R> (<t:${endTimestamp}:f>)\n👤 จัดกิจกรรมโดย: <@${interaction.user.id}>`)
                .setFooter({ text: 'Giveaway System' })
                .setTimestamp(new Date(endTimestamp * 1000));

            const joinBtn = new ButtonBuilder()
                .setCustomId('btn_giveaway_join')
                .setLabel('🎉 เข้าร่วม (0)')
                .setStyle(ButtonStyle.Primary);

            const row = new ActionRowBuilder().addComponents(joinBtn);
            const gMsg = await interaction.channel.send({ embeds: [embed], components: [row] });

            db.saveGiveaway(gMsg.id, {
                channelId: interaction.channel.id,
                messageId: gMsg.id,
                prize,
                endTimestamp,
                winnersCount,
                hostId: interaction.user.id,
                entries: []
            });

            setTimeout(async () => {
                const g = db.getGiveaway(gMsg.id);
                if (!g) return;

                const ch = client.channels.cache.get(g.channelId);
                if (!ch) return;

                const finalMsg = await ch.messages.fetch(g.messageId).catch(() => null);
                const entries = g.entries || [];

                let winnersText = 'ไม่มีผู้เข้าร่วม';
                if (entries.length > 0) {
                    const shuffled = entries.sort(() => 0.5 - Math.random());
                    const winners = shuffled.slice(0, g.winnersCount);
                    winnersText = winners.map(wId => `<@${wId}>`).join(', ');
                }

                const endEmbed = new EmbedBuilder()
                    .setColor(0x5865F2)
                    .setTitle(`🎉 กิจกรรมแจก ${g.prize} สิ้นสุดแล้ว!`)
                    .setDescription(`👑 **ผู้โชคดี:** ${winnersText}\n👤 จัดกิจกรรมโดย: <@${g.hostId}>`)
                    .setFooter({ text: 'Giveaway Ended' })
                    .setTimestamp();

                if (finalMsg) {
                    await finalMsg.edit({ embeds: [endEmbed], components: [] }).catch(() => {});
                }

                if (entries.length > 0) {
                    await ch.send(`🎊 ขอแสดงความยินดีกับ ${winnersText} ที่ได้รับรางวัล **${g.prize}**! 🎁`);
                }
                db.deleteGiveaway(gMsg.id);
            }, durationMins * 60 * 1000);

            return interaction.reply({ content: `✅ เริ่มกิจกรรมแจก **${prize}** เป็นเวลา ${durationMins} นาทีเรียบร้อย!`, ephemeral: true });
        }

        // --- Daily Economy ---
        if (commandName === 'daily') {
            const user = db.getUser(interaction.user.id);
            const now = Date.now();
            const oneDay = 24 * 60 * 60 * 1000;

            if (user.lastDaily && (now - user.lastDaily) < oneDay) {
                const nextClaim = Math.floor((user.lastDaily + oneDay) / 1000);
                return interaction.reply({
                    content: `⏳ คุณได้รับเหรียญประจำวันไปแล้ว! สามารถรับได้อีกครั้ง <t:${nextClaim}:R>`,
                    ephemeral: true
                });
            }

            const reward = Math.floor(Math.random() * 401) + 100;
            user.coins = (user.coins || 0) + reward;
            user.lastDaily = now;
            db.updateUser(interaction.user.id, { coins: user.coins, lastDaily: now });

            const embed = new EmbedBuilder()
                .setColor(0xFEE75C)
                .setTitle('💰 เช็กอินรับเหรียญประจำวัน!')
                .setDescription(`คุณได้รับ **+${reward.toLocaleString()}** 🪙 เหรียญ!\nยอดเหรียญคงเหลือทั้งหมด: **${user.coins.toLocaleString()}** 🪙`);

            return interaction.reply({ embeds: [embed] });
        }

        // --- Balance ---
        if (commandName === 'balance') {
            const targetUser = interaction.options.getUser('user') || interaction.user;
            const data = db.getUser(targetUser.id);

            const embed = new EmbedBuilder()
                .setColor(0xFEE75C)
                .setTitle(`👛 กระเป๋าเงินของ ${targetUser.username}`)
                .addFields(
                    { name: '🪙 เหรียญคงเหลือ', value: `**${(data.coins || 0).toLocaleString()}** เหรียญ`, inline: true },
                    { name: '🎮 บัญชี Roblox ที่ผูก', value: data.robloxUsername ? `\`${data.robloxUsername}\`` : '*ยังไม่ได้ผูก*', inline: true }
                )
                .setThumbnail(targetUser.displayAvatarURL());

            return interaction.reply({ embeds: [embed] });
        }

        // --- Leaderboard ---
        if (commandName === 'leaderboard') {
            const topList = db.getLeaderboard(10);
            if (topList.length === 0) {
                return interaction.reply('ยังไม่มีข้อมูลเหรียญในระบบ');
            }

            const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
            const desc = topList.map((entry, idx) => {
                const medal = medals[idx] || `${idx + 1}.`;
                const rbx = entry.robloxUsername ? ` (${entry.robloxUsername})` : '';
                return `${medal} <@${entry.id}>${rbx} — **${entry.coins.toLocaleString()}** 🪙`;
            }).join('\n');

            const embed = new EmbedBuilder()
                .setColor(0xFEE75C)
                .setTitle('🏆 อันดับคนรวยที่สุดในเซิร์ฟเวอร์')
                .setDescription(desc)
                .setFooter({ text: 'Economy Leaderboard' });

            return interaction.reply({ embeds: [embed] });
        }

        // --- Pay ---
        if (commandName === 'pay') {
            const receiver = interaction.options.getUser('user');
            const amount = interaction.options.getInteger('amount');

            if (receiver.id === interaction.user.id) {
                return interaction.reply({ content: '❌ คุณไม่สามารถโอนเหรียญให้ตัวเองได้', ephemeral: true });
            }
            if (receiver.bot) {
                return interaction.reply({ content: '❌ ไม่สามารถโอนเหรียญให้บอทได้', ephemeral: true });
            }

            const senderData = db.getUser(interaction.user.id);
            if ((senderData.coins || 0) < amount) {
                return interaction.reply({ content: `❌ เหรียญของคุณไม่เพียงพอ (คุณมี **${(senderData.coins || 0).toLocaleString()}** 🪙)`, ephemeral: true });
            }

            db.addCoins(interaction.user.id, -amount);
            db.addCoins(receiver.id, amount);

            return interaction.reply(`💸 <@${interaction.user.id}> ได้โอนเงิน **${amount.toLocaleString()}** 🪙 ให้แก่ <@${receiver.id}> เรียบร้อยแล้ว!`);
        }

        // --- Clear Messages ---
        if (commandName === 'clear') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
                return interaction.reply({ content: '❌ คุณไม่มีสิทธิ์ (Manage Messages) ในการลบข้อความ', ephemeral: true });
            }

            const amount = interaction.options.getInteger('amount');
            const targetUser = interaction.options.getUser('user');

            await interaction.deferReply({ ephemeral: true });

            let lastUpdate = Date.now();
            const { totalDeleted, hitOldMessages } = await massDeleteMessages(
                interaction.channel,
                amount,
                targetUser,
                async (current, total) => {
                    if (Date.now() - lastUpdate > 2500) {
                        lastUpdate = Date.now();
                        await interaction.editReply({
                            content: `⏳ กำลังลบข้อความ... **${current}** / **${total}** ข้อความ`
                        }).catch(() => {});
                    }
                }
            );

            let resultMsg = `🧹 ลบข้อความเรียบร้อยแล้วทั้งหมด **${totalDeleted}** ข้อความ!`;
            if (targetUser) resultMsg += ` (เฉพาะของ <@${targetUser.id}>)`;
            if (hitOldMessages) {
                resultMsg += `\n⚠️ *(หยุดเนื่องจากพบข้อความที่อายุเกิน 14 วัน)*\n💡 *หากต้องการล้างทั้งห้อง ให้ใช้คำสั่ง \`/nuke\`*`;
            }

            return interaction.editReply({ content: resultMsg });
        }

        // --- Delete Channel ---
        if (commandName === 'delete-channel') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
                return interaction.reply({ content: '❌ คุณไม่มีสิทธิ์ (Manage Channels)', ephemeral: true });
            }
            const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

            const confirmBtn = new ButtonBuilder().setCustomId(`confirm_del_${targetChannel.id}`).setLabel('ยืนยันการลบห้อง').setStyle(ButtonStyle.Danger);
            const cancelBtn = new ButtonBuilder().setCustomId(`cancel_del_${targetChannel.id}`).setLabel('ยกเลิก').setStyle(ButtonStyle.Secondary);
            const row = new ActionRowBuilder().addComponents(confirmBtn, cancelBtn);

            const embed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle('⚠️ ยืนยันการลบห้องแชท')
                .setDescription(`คุณแน่ใจหรือไม่ว่าต้องการลบห้อง **${targetChannel.name}**?`);

            return interaction.reply({ embeds: [embed], components: [row] });
        }

        // --- Delete Category ---
        if (commandName === 'delete-category') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
                return interaction.reply({ content: '❌ คุณไม่มีสิทธิ์ (Manage Channels)', ephemeral: true });
            }
            const category = interaction.options.getChannel('category');
            const childChannels = interaction.guild.channels.cache.filter(c => c.parentId === category.id);

            const confirmBtn = new ButtonBuilder().setCustomId(`confirm_cat_${category.id}`).setLabel(`ยืนยันลบทั้งหมวด (${childChannels.size} ห้อง)`).setStyle(ButtonStyle.Danger);
            const cancelBtn = new ButtonBuilder().setCustomId(`cancel_cat_${category.id}`).setLabel('ยกเลิก').setStyle(ButtonStyle.Secondary);
            const row = new ActionRowBuilder().addComponents(confirmBtn, cancelBtn);

            const embed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle('⚠️ ยืนยันการลบห้องทั้งหมวดหมู่')
                .setDescription(`หมวดหมู่ **${category.name}** มีทั้งหมด **${childChannels.size}** ห้อง ยืนยันจะลบทั้งหมดใช่หรือไม่?`);

            return interaction.reply({ embeds: [embed], components: [row] });
        }

        // --- Nuke ---
        if (commandName === 'nuke') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
                return interaction.reply({ content: '❌ คุณไม่มีสิทธิ์ (Manage Channels)', ephemeral: true });
            }

            const confirmBtn = new ButtonBuilder().setCustomId(`confirm_nuke_${interaction.channel.id}`).setLabel('ยืนยันการล้างห้อง (Nuke)').setStyle(ButtonStyle.Danger);
            const cancelBtn = new ButtonBuilder().setCustomId(`cancel_nuke_${interaction.channel.id}`).setLabel('ยกเลิก').setStyle(ButtonStyle.Secondary);
            const row = new ActionRowBuilder().addComponents(confirmBtn, cancelBtn);

            const embed = new EmbedBuilder()
                .setColor(0xFF8800)
                .setTitle('💥 ยืนยันการล้างห้อง (Nuke)')
                .setDescription(`ระบบจะลบห้อง **${interaction.channel.name}** นี้ทิ้ง และโคลนห้องใหม่ขึ้นมาทันที สะอาดหมดจดทุกข้อความ!`);

            return interaction.reply({ embeds: [embed], components: [row] });
        }

        // --- ระบบ Blox Fruits Real-Time Stock & Alert ---
        if (commandName === 'bloxfruits-stock') {
            const dealerType = interaction.options.getString('dealer') || 'normal';
            const isMirage = dealerType === 'mirage';
            const { embed } = await createStockEmbed(isMirage);

            const refreshBtn = new ButtonBuilder()
                .setCustomId(`btn_bloxfruits_refresh_${isMirage ? 'mirage' : 'normal'}`)
                .setLabel('🔄 รีเฟรชสต็อก')
                .setStyle(ButtonStyle.Primary);

            const alertBtn = new ButtonBuilder()
                .setCustomId('btn_bloxfruits_open_alert')
                .setLabel('🔔 ตั้งค่าแจ้งเตือนผล')
                .setStyle(ButtonStyle.Success);

            const row = new ActionRowBuilder().addComponents(refreshBtn, alertBtn);
            return interaction.reply({ embeds: [embed], components: [row] });
        }

        if (commandName === 'bloxfruits-alert') {
            const userAlerts = db.getUserBloxFruitsAlerts(interaction.user.id);
            const selectMenuRow = createFruitSelectMenu(userAlerts);

            const embed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle('🔔 เลือกระบบแจ้งเตือนผลปีศาจ Blox Fruits')
                .setDescription('เลือกผลปีศาจที่คุณต้องการรับการแจ้งเตือนจากเมนูด้านล่าง\nเมื่อผลที่คุณเลือกเข้ามาในสต็อกของ **Blox Fruit Dealer** ระบบจะส่งข้อความแจ้งเตือนพร้อมรูปภาพของผลนั้นให้คุณทันที!')
                .addFields({
                    name: '📌 ผลที่คุณกำลังติดตามขณะนี้',
                    value: userAlerts.length > 0 
                        ? userAlerts.map(id => {
                            const f = FRUITS.find(item => item.id === id);
                            return f ? `• **${f.name}** (${f.thName})` : `• ${id}`;
                        }).join('\n')
                        : '*ยังไม่ได้เลือกผลใดๆ*'
                })
                .setFooter({ text: 'คุณสามารถเลือกผลได้สูงสุด 25 ผล และแก้ไขได้ตลอดเวลา' });

            return interaction.reply({ embeds: [embed], components: [selectMenuRow], ephemeral: true });
        }

        if (commandName === 'bloxfruits-channel') {
            const targetChannel = interaction.options.getChannel('channel');
            if (!targetChannel.isTextBased()) {
                return interaction.reply({ content: '❌ กรุณาเลือกห้องที่เป็นห้องข้อความ (Text Channel)', ephemeral: true });
            }

            db.setBloxFruitsChannel(interaction.guildId, targetChannel.id);

            const embed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle('✅ ตั้งค่าห้องประกาศสต็อก Blox Fruits สำเร็จ')
                .setDescription(`ระบบจะส่งการ์ดประกาศสต็อกผลปีศาจเรียลไทม์พร้อมรูปภาพไปที่ห้อง <#${targetChannel.id}> อัตโนมัติทุกๆ 4 ชั่วโมงเมื่อมีการรีเซ็ตสต็อก`)
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        // --- ระบบเลเวลและแรงค์ (Leveling & Rank) ---
        if (commandName === 'rank') {
            const targetUser = interaction.options.getUser('user') || interaction.user;
            const data = db.getUserLevel(interaction.guildId, targetUser.id);

            const curLvl = data.level || 0;
            const curXp = data.xp || 0;
            const currentLevelMinXp = Math.floor(Math.pow(curLvl / 0.1, 2));
            const nextLevelXp = Math.floor(Math.pow((curLvl + 1) / 0.1, 2));
            const xpInLevel = Math.max(0, curXp - currentLevelMinXp);
            const xpNeededForLevel = Math.max(1, nextLevelXp - currentLevelMinXp);

            const percentage = Math.min(100, Math.max(0, Math.floor((xpInLevel / xpNeededForLevel) * 100)));
            const barLength = 10;
            const filledBlocks = Math.round((percentage / 100) * barLength);
            const progressBar = '█'.repeat(filledBlocks) + '░'.repeat(barLength - filledBlocks);

            const allRanks = db.getLevelLeaderboard(interaction.guildId, 1000);
            const rankPos = allRanks.findIndex(r => r.userId === targetUser.id) + 1 || allRanks.length + 1;

            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setAuthor({ name: `ระดับเลเวลของ ${targetUser.username}`, iconURL: targetUser.displayAvatarURL() })
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { name: '🏆 อันดับ (Rank)', value: `#${rankPos}`, inline: true },
                    { name: '⭐ เลเวล (Level)', value: `**Lv. ${curLvl}**`, inline: true },
                    { name: '✨ ค่าประสบการณ์ (EXP)', value: `\`${curXp.toLocaleString()}\` XP`, inline: true },
                    { name: `📊 ความคืบหน้าสู่ Lv. ${curLvl + 1} (${percentage}%)`, value: `\`[${progressBar}]\` \`${xpInLevel.toLocaleString()} / ${xpNeededForLevel.toLocaleString()} XP\``, inline: false }
                )
                .setFooter({ text: 'พิมพ์แชทในเซิร์ฟเวอร์เพื่อสะสม EXP เพิ่มเติม!' })
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'rank-leaderboard') {
            const leaderboard = db.getLevelLeaderboard(interaction.guildId, 10);
            if (leaderboard.length === 0) {
                return interaction.reply('📊 ยังไม่มีข้อมูลการแชทสะสมเลเวลในเซิร์ฟเวอร์นี้ เริ่มพิมพ์คุยกันได้เลย!');
            }

            const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
            const description = leaderboard.map((entry, index) => {
                const medal = medals[index] || `#${index + 1}`;
                return `${medal} <@${entry.userId}> • **Lv. ${entry.level}** (\`${entry.xp.toLocaleString()}\` XP)`;
            }).join('\n');

            const embed = new EmbedBuilder()
                .setColor(0xFFD700)
                .setTitle('🏆 ตารางอันดับผู้ใช้เลเวลสูงสุด (Level Leaderboard)')
                .setDescription(description)
                .setFooter({ text: `${interaction.guild.name} • อัปเดตแบบเรียลไทม์`, iconURL: interaction.guild.iconURL() })
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        // --- ระบบ AFK ---
        if (commandName === 'afk') {
            const reason = interaction.options.getString('reason') || 'ไม่อยู่ชั่วคราว (AFK)';
            db.setAfk(interaction.user.id, reason);

            const embed = new EmbedBuilder()
                .setColor(0xFAA61A)
                .setTitle('💤 ตั้งสถานะ AFK เรียบร้อย')
                .setDescription(`<@${interaction.user.id}> เข้าสู่โหมด AFK แล้ว!\n📝 **เหตุผล:** *${reason}*`)
                .setFooter({ text: 'เมื่อคุณส่งข้อความใดๆ ในเซิร์ฟเวอร์ บอทจะปลดสถานะให้อัตโนมัติ' });

            return interaction.reply({ embeds: [embed] });
        }

        // --- มินิเกมสล็อต (Slots) ---
        if (commandName === 'slots') {
            const bet = interaction.options.getInteger('bet');
            const user = db.getUser(interaction.user.id);

            if ((user.coins || 0) < bet) {
                return interaction.reply({ content: `❌ คุณมีเหรียญไม่พอสำหรับเดิมพัน! (มีอยู่: **${(user.coins || 0).toLocaleString()}** 🪙)`, ephemeral: true });
            }

            const symbols = ['🍒', '🍋', '🍇', '🔔', '💎', '7️⃣'];
            const s1 = symbols[Math.floor(Math.random() * symbols.length)];
            const s2 = symbols[Math.floor(Math.random() * symbols.length)];
            const s3 = symbols[Math.floor(Math.random() * symbols.length)];

            let multiplier = 0;
            let winText = '';

            if (s1 === '7️⃣' && s2 === '7️⃣' && s3 === '7️⃣') {
                multiplier = 10;
                winText = '💥 **JACKPOT สุดยอดแจ็คพอต 777! รับเงินรางวัล 10 เท่า!**';
            } else if (s1 === '💎' && s2 === '💎' && s3 === '💎') {
                multiplier = 5;
                winText = '💎 **เพชร 3 ชิ้นแตก! รับเงินรางวัล 5 เท่า!**';
            } else if (s1 === '🔔' && s2 === '🔔' && s3 === '🔔') {
                multiplier = 4;
                winText = '🔔 **กระดิ่งทองคำ 3 ชิ้น! รับเงินรางวัล 4 เท่า!**';
            } else if (s1 === s2 && s2 === s3) {
                multiplier = 3;
                winText = '🎉 **ผลไม้เรียง 3 ช่อง! รับเงินรางวัล 3 เท่า!**';
            } else if (s1 === s2 || s2 === s3 || s1 === s3) {
                multiplier = 1.5;
                winText = '✨ **ตรงกัน 2 ช่อง! รับเงินรางวัล 1.5 เท่า!**';
            } else {
                multiplier = 0;
                winText = '😢 **เสียใจด้วย คุณไม่ถูกรางวัลในรอบนี้!**';
            }

            let profit = 0;
            if (multiplier > 0) {
                profit = Math.floor(bet * multiplier) - bet;
                user.coins += profit;
            } else {
                profit = -bet;
                user.coins -= bet;
            }

            db.updateUser(interaction.user.id, { coins: user.coins });

            const slotEmbed = new EmbedBuilder()
                .setColor(multiplier > 0 ? 0x57F287 : 0xED4245)
                .setTitle('🎰 ตู้สล็อตแมชชีน (Slots)')
                .setDescription(`\`\`\`\n[ ${s1} | ${s2} | ${s3} ]\n\`\`\`\n${winText}`)
                .addFields(
                    { name: '💵 เงินเดิมพัน', value: `\`${bet.toLocaleString()}\` 🪙`, inline: true },
                    { name: multiplier > 0 ? '📈 กำไรที่ได้รับ' : '📉 ยอดที่เสีย', value: `\`${Math.abs(profit).toLocaleString()}\` 🪙`, inline: true },
                    { name: '👛 เหรียญคงเหลือ', value: `\`${user.coins.toLocaleString()}\` 🪙`, inline: true }
                )
                .setFooter({ text: 'ขอให้โชคดีในตาถัดไป!' });

            return interaction.reply({ embeds: [slotEmbed] });
        }

        // --- มินิเกมโยนเหรียญ (Coinflip) ---
        if (commandName === 'coinflip') {
            const choice = interaction.options.getString('choice');
            const bet = interaction.options.getInteger('bet');
            const user = db.getUser(interaction.user.id);

            if ((user.coins || 0) < bet) {
                return interaction.reply({ content: `❌ คุณมีเหรียญไม่พอสำหรับเดิมพัน! (มีอยู่: **${(user.coins || 0).toLocaleString()}** 🪙)`, ephemeral: true });
            }

            const outcome = Math.random() < 0.5 ? 'heads' : 'tails';
            const won = choice === outcome;

            if (won) {
                user.coins += bet;
            } else {
                user.coins -= bet;
            }
            db.updateUser(interaction.user.id, { coins: user.coins });

            const embed = new EmbedBuilder()
                .setColor(won ? 0x57F287 : 0xED4245)
                .setTitle(`🪙 ผลการโยนเหรียญ: ${outcome === 'heads' ? '🪙 หัว (Heads)' : '🦅 ก้อย (Tails)'}`)
                .setDescription(won ? `🎉 **ยินดีด้วย คุณทายถูก!** ได้รับรางวัล **+${bet.toLocaleString()}** 🪙` : `❌ **คุณทายผิด!** เสียเหรียญ **-${bet.toLocaleString()}** 🪙`)
                .addFields(
                    { name: 'ที่คุณทาย', value: choice === 'heads' ? '🪙 หัว' : '🦅 ก้อย', inline: true },
                    { name: 'ผลที่ออก', value: outcome === 'heads' ? '🪙 หัว' : '🦅 ก้อย', inline: true },
                    { name: '👛 เหรียญคงเหลือ', value: `\`${user.coins.toLocaleString()}\` 🪙`, inline: true }
                );

            return interaction.reply({ embeds: [embed] });
        }

        // --- มินิเกมเป่ายิ้งฉุบ (RPS) ---
        if (commandName === 'rps') {
            const playerChoice = interaction.options.getString('choice');
            const bet = interaction.options.getInteger('bet');
            const user = db.getUser(interaction.user.id);

            if ((user.coins || 0) < bet) {
                return interaction.reply({ content: `❌ คุณมีเหรียญไม่พอสำหรับเดิมพัน! (มีอยู่: **${(user.coins || 0).toLocaleString()}** 🪙)`, ephemeral: true });
            }

            const choices = ['rock', 'paper', 'scissors'];
            const botChoice = choices[Math.floor(Math.random() * choices.length)];

            const emojis = { 'rock': '✊ ค้อน', 'paper': '🖐️ กระดาษ', 'scissors': '✌️ กรรไกร' };

            let result = 'draw';
            if (playerChoice === botChoice) {
                result = 'draw';
            } else if (
                (playerChoice === 'rock' && botChoice === 'scissors') ||
                (playerChoice === 'paper' && botChoice === 'rock') ||
                (playerChoice === 'scissors' && botChoice === 'paper')
            ) {
                result = 'win';
            } else {
                result = 'lose';
            }

            if (result === 'win') {
                user.coins += bet;
            } else if (result === 'lose') {
                user.coins -= bet;
            }
            db.updateUser(interaction.user.id, { coins: user.coins });

            const embed = new EmbedBuilder()
                .setColor(result === 'win' ? 0x57F287 : (result === 'draw' ? 0xFEE75C : 0xED4245))
                .setTitle(`🎮 ผลการเป่ายิ้งฉุบ (Rock Paper Scissors)`)
                .setDescription(
                    result === 'win'
                        ? `🎉 **คุณชนะ!** ได้รับรางวัล **+${bet.toLocaleString()}** 🪙`
                        : (result === 'draw' ? `🤝 **เสมอ!** คืนเงินเดิมพัน **${bet.toLocaleString()}** 🪙` : `❌ **คุณแพ้!** เสียเหรียญ **-${bet.toLocaleString()}** 🪙`)
                )
                .addFields(
                    { name: 'คุณออก', value: emojis[playerChoice], inline: true },
                    { name: 'บอทออก', value: emojis[botChoice], inline: true },
                    { name: '👛 เหรียญคงเหลือ', value: `\`${user.coins.toLocaleString()}\` 🪙`, inline: true }
                );

            return interaction.reply({ embeds: [embed] });
        }

        // --- มินิเกมทอยลูกเต๋า (Dice) ---
        if (commandName === 'dice') {
            const guess = interaction.options.getInteger('guess');
            const bet = interaction.options.getInteger('bet');
            const user = db.getUser(interaction.user.id);

            if ((user.coins || 0) < bet) {
                return interaction.reply({ content: `❌ คุณมีเหรียญไม่พอสำหรับเดิมพัน! (มีอยู่: **${(user.coins || 0).toLocaleString()}** 🪙)`, ephemeral: true });
            }

            const roll = Math.floor(Math.random() * 6) + 1;
            const diceEmojis = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
            const won = guess === roll;

            let profit = 0;
            if (won) {
                profit = bet * 4;
                user.coins += profit;
            } else {
                profit = -bet;
                user.coins -= bet;
            }
            db.updateUser(interaction.user.id, { coins: user.coins });

            const embed = new EmbedBuilder()
                .setColor(won ? 0x57F287 : 0xED4245)
                .setTitle(`🎲 ผลการทอยลูกเต๋า: ${diceEmojis[roll]} [ แต้ม ${roll} ]`)
                .setDescription(won ? `🎉 **ยินดีด้วย คุณทายแต้มถูกเป๊ะ!** รับรางวัล 5 เท่า **+${profit.toLocaleString()}** 🪙` : `❌ **คุณทายแต้มผิด!** เสียเหรียญ **-${bet.toLocaleString()}** 🪙`)
                .addFields(
                    { name: 'แต้มที่คุณทาย', value: `\`${guess}\``, inline: true },
                    { name: 'แต้มที่ออก', value: `\`${roll}\``, inline: true },
                    { name: '👛 เหรียญคงเหลือ', value: `\`${user.coins.toLocaleString()}\` 🪙`, inline: true }
                );

            return interaction.reply({ embeds: [embed] });
        }

        // --- ระบบ Carl-bot Server Setup ---
        if (commandName === 'set-welcome') {
            const channel = interaction.options.getChannel('channel');
            db.setSetting('welcome_' + interaction.guildId, channel.id);
            return interaction.reply({
                content: `✅ ตั้งค่าห้องต้อนรับและแจ้งคนออกเป็นห้อง <#${channel.id}> เรียบร้อยแล้ว!`,
                ephemeral: true
            });
        }

        if (commandName === 'set-autorole') {
            const role = interaction.options.getRole('role');
            db.setSetting('autorole_' + interaction.guildId, role.id);
            return interaction.reply({
                content: `✅ ตั้งค่ายศอัตโนมัติสำหรับสมาชิกใหม่เป็นยศ **@${role.name}** เรียบร้อยแล้ว!`,
                ephemeral: true
            });
        }

        if (commandName === 'set-logs') {
            const channel = interaction.options.getChannel('channel');
            db.setSetting('logs_' + interaction.guildId, channel.id);
            return interaction.reply({
                content: `✅ ตั้งค่าห้องบันทึกประวัติ (Mod / Audit Logs) เป็นห้อง <#${channel.id}> เรียบร้อยแล้ว!`,
                ephemeral: true
            });
        }

        if (commandName === 'setup-stats') {
            await interaction.deferReply({ ephemeral: true });
            try {
                const guild = interaction.guild;
                const category = await guild.channels.create({
                    name: '📊 ข้อมูลเซิร์ฟเวอร์',
                    type: ChannelType.GuildCategory
                });

                const total = guild.memberCount;
                const bots = guild.members.cache.filter(m => m.user.bot).size;
                const humans = total - bots;

                const totalCh = await guild.channels.create({
                    name: `📊 สมาชิก: ${total}`,
                    type: ChannelType.GuildVoice,
                    parent: category.id,
                    permissionOverwrites: [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.Connect] }]
                });

                const humansCh = await guild.channels.create({
                    name: `👤 ผู้ใช้: ${humans}`,
                    type: ChannelType.GuildVoice,
                    parent: category.id,
                    permissionOverwrites: [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.Connect] }]
                });

                const botsCh = await guild.channels.create({
                    name: `🤖 บอท: ${bots}`,
                    type: ChannelType.GuildVoice,
                    parent: category.id,
                    permissionOverwrites: [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.Connect] }]
                });

                db.setSetting('stats_' + guild.id, {
                    categoryId: category.id,
                    totalId: totalCh.id,
                    humansId: humansCh.id,
                    botsId: botsCh.id
                });

                return interaction.editReply(`✅ สร้างห้องสถิติจำนวนสมาชิกสดเรียบร้อยแล้ว ในหมวดหมู่ **${category.name}**!`);
            } catch (err) {
                return interaction.editReply(`❌ สร้างห้องสถิติไม่สำเร็จ: ${err.message}`);
            }
        }

        if (commandName === 'automod') {
            const anti_invite = interaction.options.getBoolean('anti_invite');
            const anti_spam = interaction.options.getBoolean('anti_spam');

            db.setAutoMod(interaction.guildId, { antiInvite: anti_invite, antiSpam: anti_spam });

            const embed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle('🛡️ ตั้งค่า Auto-Mod เรียบร้อย')
                .addFields(
                    { name: '🔗 ป้องกันลิงก์เชิญ (Anti-Invite)', value: anti_invite ? '🟢 เปิดใช้งาน' : '🔴 ปิดใช้งาน', inline: true },
                    { name: '⚡ ป้องกันสแปมข้อความ (Anti-Spam)', value: anti_spam ? '🟢 เปิดใช้งาน' : '🔴 ปิดใช้งาน', inline: true }
                );

            return interaction.reply({ embeds: [embed] });
        }

        // --- ระบบ Blox Fruits Trading & Value Calculator ---
        if (commandName === 'bf-value') {
            const query = interaction.options.getString('fruit');
            const fruit = bftrade.findFruit(query);
            if (!fruit) {
                return interaction.reply({
                    content: `❌ ไม่พบผลปีศาจชื่อ **"${query}"** ในฐานข้อมูล\n💡 ตัวอย่างผลที่มี: Kitsune, Dragon, Dough, Leopard, Buddha, Portal, Control, Sound, Venom, Blizzard...`,
                    ephemeral: true
                });
            }
            const embed = bftrade.createFruitValueEmbed(fruit);
            return interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'bf-trade') {
            const yourInput = interaction.options.getString('your_fruits');
            const theirInput = interaction.options.getString('their_fruits');

            const yourList = yourInput.split(/[,+]/).map(s => s.trim()).filter(Boolean);
            const theirList = theirInput.split(/[,+]/).map(s => s.trim()).filter(Boolean);

            if (yourList.length === 0 || theirList.length === 0) {
                return interaction.reply({ content: '❌ กรุณาระบุชื่อผลปีศาจอย่างน้อยฝั่งละ 1 ชนิด เช่น `/bf-trade your_fruits:Dough, Buddha their_fruits:Tiger`', ephemeral: true });
            }

            const tradeResult = bftrade.calculateTrade(yourList, theirList);
            const embed = bftrade.createTradeEmbed(tradeResult);
            return interaction.reply({ embeds: [embed] });
        }

        // --- ระบบ Voice Master Setup ---
        if (commandName === 'setup-voicemaster') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ คุณต้องมีสิทธิ์ Administrator จึงจะตั้งค่าระบบนี้ได้', ephemeral: true });
            }
            await interaction.deferReply();

            const category = await interaction.guild.channels.create({
                name: '🔊 ห้องเสียงส่วนตัว (Voice Master)',
                type: ChannelType.GuildCategory
            });

            const masterChannel = await interaction.guild.channels.create({
                name: '➕ คลิกเพื่อสร้างห้อง',
                type: ChannelType.GuildVoice,
                parent: category.id,
                userLimit: 1
            });

            db.setVoiceMaster(interaction.guildId, {
                categoryId: category.id,
                channelId: masterChannel.id
            });

            const embed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle('🎙️ ติดตั้งระบบ Voice Master สำเร็จ!')
                .setDescription(`สร้างห้องแม่ **${masterChannel.name}** เรียบร้อยแล้ว!\n\n📌 **วิธีใช้งานสำหรับสมาชิก:**\n1. เพียงกดเข้าห้อง <#${masterChannel.id}>\n2. บอทจะสร้างห้องเสียงชั่วคราวให้คุณอัตโนมัติทันที\n3. เจ้าของห้องสามารถกดปุ่มควบคุม (ล็อกห้อง, ซ่อนห้อง, จำกัดคน, เตะสมาชิก) ได้อิสระ\n4. เมื่อทุกคนออกจากห้อง ห้องจะถูกลบอัตโนมัติ ไม่รกเซิร์ฟเวอร์!`)
                .setFooter({ text: 'Voice Master 24/7' });

            return interaction.editReply({ embeds: [embed] });
        }

        // --- ระบบ Verification Gate Setup ---
        if (commandName === 'setup-verify') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ คุณต้องมีสิทธิ์ Administrator จึงจะตั้งค่าระบบนี้ได้', ephemeral: true });
            }

            const role = interaction.options.getRole('role');
            const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

            if (!targetChannel.isTextBased()) {
                return interaction.reply({ content: '❌ กรุณาเลือกห้องข้อความ (Text Channel)', ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle(`🛡️ ยืนยันตัวตนเข้าสู่ ${interaction.guild.name}`)
                .setDescription(`ยินดีต้อนรับสู่เซิร์ฟเวอร์ **${interaction.guild.name}**!\n\nกรุณากดปุ่ม **"✅ ยืนยันตัวตน"** ด้านล่าง เพื่อยืนยันว่าคุณไม่ใช่บอทสแปมและรับยศ <@&${role.id}> เพื่อเข้าถึงห้องแชททั้งหมดในเซิร์ฟเวอร์`)
                .setFooter({ text: 'ระบบรักษาความปลอดภัยเซิร์ฟเวอร์อัตโนมัติ (Anti-Raid Verification)' })
                .setTimestamp();

            const btn = new ButtonBuilder()
                .setCustomId('btn_verify_member')
                .setLabel('✅ ยืนยันตัวตน (คลิกที่นี่)')
                .setStyle(ButtonStyle.Success);

            const row = new ActionRowBuilder().addComponents(btn);

            await targetChannel.send({ embeds: [embed], components: [row] });

            db.setSetting('verifyRoleId', role.id);
            db.setVerification(interaction.guildId, {
                roleId: role.id,
                channelId: targetChannel.id
            });

            return interaction.reply({ content: `✅ ติดตั้งระบบยืนยันตัวตนในห้อง <#${targetChannel.id}> โดยมอบยศ <@&${role.id}> เรียบร้อยแล้ว!`, ephemeral: true });
        }

        // --- ระบบธนาคารและเศรษฐกิจ (Bank & Economy 2.0) ---
        if (commandName === 'bank') {
            const target = interaction.options.getUser('user') || interaction.user;
            const user = db.getUser(target.id);

            const wallet = user.coins || 0;
            const bank = user.bank || 0;
            const netWorth = wallet + bank;

            const embed = new EmbedBuilder()
                .setColor(0xFEE75C)
                .setTitle(`🏦 บัญชีธนาคารและทรัพย์สินของ ${target.username}`)
                .setDescription('ข้อมูลทางการเงินและการปกป้องทรัพย์สินจากระบบเศรษฐกิจ')
                .setThumbnail(target.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: '💵 เงินสดในกระเป๋า (Wallet)', value: `💰 **${wallet.toLocaleString()}** เหรียญ *(เสี่ยงต่อการโดนปล้น)*`, inline: true },
                    { name: '🏦 เงินในธนาคาร (Bank)', value: `🔒 **${bank.toLocaleString()}** เหรียญ *(ปลอดภัย 100%)*`, inline: true },
                    { name: '💎 ทรัพย์สินรวมสุทธิ (Net Worth)', value: `✨ **${netWorth.toLocaleString()}** เหรียญ`, inline: false }
                )
                .setFooter({ text: 'ใช้ /deposit เพื่อฝากเงิน | /withdraw เพื่อถอนเงิน' });

            return interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'deposit') {
            const amount = interaction.options.getString('amount');
            const res = db.deposit(interaction.user.id, amount);
            if (!res.success) {
                return interaction.reply({ content: `❌ ${res.error}`, ephemeral: true });
            }
            const embed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle('📥 ฝากเงินเข้าธนาคารสำเร็จ!')
                .setDescription(`ฝากเงินจำนวน **${res.deposited.toLocaleString()}** เหรียญ เข้าตู้นิรภัยเรียบร้อย`)
                .addFields(
                    { name: '💵 เงินสดคงเหลือ', value: `${res.wallet.toLocaleString()} เหรียญ`, inline: true },
                    { name: '🏦 ยอดรวมในธนาคาร', value: `${res.bank.toLocaleString()} เหรียญ`, inline: true }
                );
            return interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'withdraw') {
            const amount = interaction.options.getString('amount');
            const res = db.withdraw(interaction.user.id, amount);
            if (!res.success) {
                return interaction.reply({ content: `❌ ${res.error}`, ephemeral: true });
            }
            const embed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle('📤 ถอนเงินจากธนาคารสำเร็จ!')
                .setDescription(`ถอนเงินจำนวน **${res.withdrawn.toLocaleString()}** เหรียญ ออกมาเป็นเงินสด`)
                .addFields(
                    { name: '💵 เงินสดในกระเป๋า', value: `${res.wallet.toLocaleString()} เหรียญ`, inline: true },
                    { name: '🏦 ยอดคงเหลือในธนาคาร', value: `${res.bank.toLocaleString()} เหรียญ`, inline: true }
                );
            return interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'work') {
            const res = db.doWork(interaction.user.id);
            if (!res.success) {
                const mins = Math.ceil(res.timeLeft / (60 * 1000));
                return interaction.reply({ content: `⏳ คุณเพิ่งทำงานไป พักผ่อนก่อนนะ! สามารถทำงานได้อีกครั้งใน **${mins}** นาที`, ephemeral: true });
            }
            const embed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle('💼 ทำงานสำเร็จ!')
                .setDescription(`คุณได้ทำงานเป็น **${res.jobName}**\n💰 ได้รับค่าจ้าง: **+${res.earned.toLocaleString()}** เหรียญ\n💵 ยอดเงินสดรวม: **${res.totalCoins.toLocaleString()}** เหรียญ`)
                .setFooter({ text: 'ทำงานได้ทุกๆ 30 นาที' });
            return interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'rob') {
            const target = interaction.options.getUser('user');
            if (target.bot) {
                return interaction.reply({ content: '❌ คุณไม่สามารถปล้นบอทได้!', ephemeral: true });
            }
            const res = db.doRob(interaction.user.id, target.id);
            if (!res.success) {
                if (res.onCooldown) {
                    const mins = Math.ceil(res.timeLeft / (60 * 1000));
                    return interaction.reply({ content: `⏳ ตำรวจกำลังเฝ้าระวังตัวคุณอยู่! ปล้นได้อีกครั้งใน **${mins}** นาที`, ephemeral: true });
                }
                if (res.caught) {
                    const embed = new EmbedBuilder()
                        .setColor(0xED4245)
                        .setTitle('🚨 ปล้นล้มเหลว! โดนตำรวจจับกุม!')
                        .setDescription(`คุณพยายามปล้น <@${target.id}> แต่สัญญาณเตือนภัยดังขึ้น!\n👮 คุณถูกปรับเงิน **${res.fine}** เหรียญ จ่ายค่าทำขวัญให้ <@${target.id}> โดยตรง!`)
                        .setFooter({ text: 'การปล้นมีความเสี่ยง ควบคุมสติก่อนลงมือ' });
                    return interaction.reply({ embeds: [embed] });
                }
                return interaction.reply({ content: `❌ ${res.error}`, ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle('🥷 ปล้นสำเร็จอย่างแนบเนียน!')
                .setDescription(`คุณแอบย่องไปปล้นเงินสดจากกระเป๋าของ <@${target.id}> ได้สำเร็จ!\n💰 ได้รับเงิน: **+${res.stolen.toLocaleString()}** เหรียญ`)
                .setFooter({ text: 'รีบนำเงินไปฝากธนาคารด้วย /deposit ก่อนโดนปล้นคืน!' });
            return interaction.reply({ embeds: [embed] });
        }

        // --- ระบบร้านค้าเซิร์ฟเวอร์ (Server Shop) ---
        if (commandName === 'shop') {
            const items = db.getShopItems(interaction.guildId);
            if (items.length === 0) {
                return interaction.reply({
                    content: '🛒 ร้านค้าของเซิร์ฟเวอร์นี้ยังไม่มีสินค้าวางจำหน่าย (แอดมินสามารถใช้คำสั่ง `/shop-add` เพื่อเพิ่มยศหรือไอเทมได้)',
                    ephemeral: true
                });
            }

            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle(`🛒 ร้านค้าเซิร์ฟเวอร์ ${interaction.guild.name}`)
                .setDescription(`ใช้เหรียญที่คุณสะสมมาซื้อยศพิเศษหรือสิทธิ์ประโยชน์ในเซิร์ฟเวอร์\nพิมพ์คำสั่ง \`/buy <item_id>\` เพื่อสั่งซื้อ\n\n**รายการสินค้าที่มีจำหน่าย (${items.length} รายการ):**`)
                .setFooter({ text: 'สะสมเหรียญได้จากการคุยในแชท, มินิเกม และการทำงาน /work' });

            items.forEach((item, idx) => {
                const roleMention = item.roleId ? `<@&${item.roleId}>` : 'ไม่มี';
                embed.addFields({
                    name: `${idx + 1}. ${item.name} • 💰 ${item.price.toLocaleString()} เหรียญ`,
                    value: `ยศที่ได้รับ: ${roleMention}\nคำอธิบาย: ${item.description || 'ไม่มีรายละเอียด'}\nรหัสสั่งซื้อ: \`${item.id}\``,
                    inline: false
                });
            });

            return interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'buy') {
            const itemId = interaction.options.getString('item_id');
            const res = db.buyShopItem(interaction.guildId, interaction.user.id, itemId);

            if (!res.success) {
                return interaction.reply({ content: `❌ ${res.error}`, ephemeral: true });
            }

            if (res.item.roleId) {
                const role = interaction.guild.roles.cache.get(res.item.roleId);
                if (role) {
                    await interaction.member.roles.add(role).catch(() => null);
                }
            }

            const embed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle('🎉 ซื้อสินค้าสำเร็จ!')
                .setDescription(`คุณได้ทำการซื้อ **${res.item.name}** เรียบร้อยแล้ว!\n💰 จ่ายไป: **${res.item.price.toLocaleString()}** เหรียญ\n💵 เหรียญคงเหลือ: **${res.remainingCoins.toLocaleString()}** เหรียญ`)
                .setFooter({ text: 'ขอบคุณที่อุดหนุนร้านค้าเซิร์ฟเวอร์!' });

            return interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'shop-add') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ คุณต้องมีสิทธิ์ Administrator จึงจะเพิ่มสินค้าได้', ephemeral: true });
            }

            const name = interaction.options.getString('name');
            const price = interaction.options.getInteger('price');
            const role = interaction.options.getRole('role');
            const description = interaction.options.getString('description') || '';

            const item = db.addShopItem(interaction.guildId, {
                name,
                price,
                roleId: role.id,
                description
            });

            return interaction.reply(`✅ เพิ่มสินค้า **${name}** (ยศ <@&${role.id}>) ราคา **${price.toLocaleString()}** เหรียญ ลงในร้านค้าสำเร็จ! (รหัส: \`${item.id}\`)`);
        }

        if (commandName === 'shop-remove') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ คุณต้องมีสิทธิ์ Administrator จึงจะลบสินค้าได้', ephemeral: true });
            }

            const itemId = interaction.options.getString('item_id');
            const ok = db.removeShopItem(interaction.guildId, itemId);
            return interaction.reply(ok ? `✅ ลบสินค้ารหัส \`${itemId}\` ออกจากร้านค้าเรียบร้อยแล้ว` : '❌ ไม่พบรหัสสินค้าดังกล่าว');
        }

        // ==========================================
        // DOCOMIN SHOP COMMAND HANDLERS
        // ==========================================

        // --- Vouch & Reputation (รีวิวและเครดิตร้านค้า) ---
        if (commandName === 'vouch') {
            const seller = interaction.options.getUser('seller');
            const stars = interaction.options.getInteger('stars');
            const comment = interaction.options.getString('comment');
            const item = interaction.options.getString('item');
            const proof = interaction.options.getString('proof');

            if (seller.id === interaction.user.id) {
                return interaction.reply({ content: '❌ คุณไม่สามารถรีวิวให้ตัวเองได้!', ephemeral: true });
            }

            const newVouch = db.addVouch({
                sellerId: seller.id,
                buyerId: interaction.user.id,
                buyerTag: interaction.user.tag,
                guildId: interaction.guildId,
                stars,
                comment,
                item,
                proofUrl: proof
            });

            const embed = docominShop.createVouchEmbed(newVouch, interaction.user, seller);
            const reviewChId = db.getReviewChannel(interaction.guildId);
            let sentInReviewCh = false;

            if (reviewChId) {
                const ch = interaction.guild.channels.cache.get(reviewChId);
                if (ch && ch.isTextBased()) {
                    await ch.send({ embeds: [embed] }).catch(() => {});
                    sentInReviewCh = true;
                }
            }

            if (sentInReviewCh && interaction.channelId !== reviewChId) {
                await interaction.reply({
                    content: `🎉 บันทึกเครดิตเรียบร้อยแล้ว! ส่งการ์ดรีวิวไปที่ห้อง <#${reviewChId}>`,
                    embeds: [embed],
                    ephemeral: true
                });
            } else {
                await interaction.reply({ embeds: [embed] });
            }
            return;
        }

        if (commandName === 'reputation') {
            const target = interaction.options.getUser('user') || interaction.user;
            const stats = db.getVouchStats(target.id);
            const embed = docominShop.createReputationEmbed(target, stats);
            return interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'set-review-channel') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ คุณต้องมีสิทธิ์ Administrator จึงจะตั้งค่าห้องรีวิวได้', ephemeral: true });
            }
            const channel = interaction.options.getChannel('channel');
            if (!channel.isTextBased()) {
                return interaction.reply({ content: '❌ กรุณาเลือกห้องข้อความ (Text Channel)', ephemeral: true });
            }
            db.setReviewChannel(interaction.guildId, channel.id);
            return interaction.reply(`✅ ตั้งค่าห้องส่งการ์ดรีวิวและเครดิตเป็น <#${channel.id}> เรียบร้อยแล้ว!`);
        }

        // --- Payment & QR System ---
        if (commandName === 'payment') {
            const embed = docominShop.createPaymentEmbed(interaction.guildId);
            const row = docominShop.createPaymentActionRow(interaction.channelId);
            return interaction.reply({ embeds: [embed], components: [row] });
        }

        if (commandName === 'pay-qr') {
            const amount = interaction.options.getNumber('amount');
            const note = interaction.options.getString('note');
            const embed = docominShop.createPaymentEmbed(interaction.guildId, amount, note);
            const row = docominShop.createPaymentActionRow(interaction.channelId);
            return interaction.reply({ embeds: [embed], components: [row] });
        }

        if (commandName === 'set-payment') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ คุณต้องมีสิทธิ์ Administrator จึงจะตั้งค่าช่องทางชำระเงินได้', ephemeral: true });
            }
            const promptpay = interaction.options.getString('promptpay');
            const bankName = interaction.options.getString('bank_name');
            const bankAccount = interaction.options.getString('bank_account');
            const accountName = interaction.options.getString('account_name');
            const truemoney = interaction.options.getString('truemoney');

            if (!promptpay && !bankName && !bankAccount && !accountName && !truemoney) {
                const currentConfig = db.getPaymentConfig(interaction.guildId) || {};
                return interaction.showModal(docominShop.createSetPaymentModal(currentConfig));
            }

            const current = db.getPaymentConfig(interaction.guildId) || {};
            db.setPaymentConfig(interaction.guildId, {
                promptpay: promptpay || current.promptpay,
                bankName: bankName || current.bankName,
                bankAccount: bankAccount || current.bankAccount,
                accountName: accountName || current.accountName,
                truemoney: truemoney !== null ? truemoney : current.truemoney
            });

            return interaction.reply({
                content: `✅ บันทึกช่องทางการชำระเงินของร้านค้าเรียบร้อยแล้ว!\n• **พร้อมเพย์:** \`${promptpay || current.promptpay}\`\n• **ธนาคาร:** \`${bankName || current.bankName} (${bankAccount || current.bankAccount})\`\n• **ชื่อบัญชี:** \`${accountName || current.accountName}\`${(truemoney || current.truemoney) ? `\n• **TrueMoney:** \`${truemoney || current.truemoney}\`` : ''}`,
                ephemeral: true
            });
        }

        // --- Product Catalog Management ---
        if (commandName === 'products') {
            const cat = interaction.options.getString('category') || 'all';
            const products = db.getProducts(interaction.guildId, cat);
            const embed = docominShop.createCatalogEmbed(products, cat);
            const menu = docominShop.createCatalogSelectMenu(products);
            return interaction.reply({ embeds: [embed], components: [menu] });
        }

        if (commandName === 'product-add') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ คุณต้องมีสิทธิ์ Administrator จึงจะเพิ่มสินค้าได้', ephemeral: true });
            }
            const id = interaction.options.getString('id');
            const name = interaction.options.getString('name');
            const price = interaction.options.getNumber('price');
            const stock = interaction.options.getInteger('stock');
            const category = interaction.options.getString('category');
            const description = interaction.options.getString('description');
            const imageUrl = interaction.options.getString('image_url');

            const item = db.addProduct(interaction.guildId, {
                id,
                name,
                price,
                stock,
                category,
                description,
                imageUrl
            });

            return interaction.reply(`✅ เพิ่ม/อัปเดตสินค้า **${item.name}** (รหัส: \`${item.id}\`) ราคา **฿${item.price.toLocaleString()}** บาท (สต็อก: ${item.stock} ชิ้น) เรียบร้อยแล้ว!`);
        }

        if (commandName === 'product-remove') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ คุณต้องมีสิทธิ์ Administrator จึงจะลบสินค้าได้', ephemeral: true });
            }
            const id = interaction.options.getString('id');
            const ok = db.removeProduct(interaction.guildId, id);
            return interaction.reply(ok ? `✅ ลบสินค้ารหัส \`${id.toUpperCase()}\` ออกจากร้านค้าเรียบร้อยแล้ว` : `❌ ไม่พบสินค้ารหัส \`${id.toUpperCase()}\` ในระบบ`);
        }

        if (commandName === 'product-stock') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ คุณต้องมีสิทธิ์ Administrator จึงจะแก้ไขสต็อกสินค้าได้', ephemeral: true });
            }
            const id = interaction.options.getString('id');
            const stock = interaction.options.getInteger('stock');
            const updated = db.updateProductStock(interaction.guildId, id, stock);
            return interaction.reply(updated ? `✅ อัปเดตสต็อกสินค้า **${updated.name}** (รหัส: \`${updated.id}\`) เป็น **${updated.stock}** ชิ้นเรียบร้อย!` : `❌ ไม่พบสินค้ารหัส \`${id.toUpperCase()}\` ในระบบ`);
        }

        // --- Order & Support Desk Setup ---
        if (commandName === 'setup-order-ticket') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ คุณต้องมีสิทธิ์ Administrator จึงจะตั้งค่าได้', ephemeral: true });
            }
            const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
            if (!targetChannel.isTextBased()) {
                return interaction.reply({ content: '❌ กรุณาเลือกห้องข้อความ (Text Channel)', ephemeral: true });
            }
            const embed = docominShop.createOrderDeskEmbed(interaction.guild.name);
            const btns = docominShop.createOrderDeskButtons();
            await targetChannel.send({ embeds: [embed], components: [btns] });
            return interaction.reply({ content: `✅ ติดตั้งแผงบริการสั่งซื้อและติดต่อ Docomin Service Desk ในห้อง <#${targetChannel.id}> เรียบร้อยแล้ว!`, ephemeral: true });
        }

        if (commandName === 'setup-docomin-shop') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ คุณต้องมีสิทธิ์ Administrator จึงจะใช้คำสั่งนี้ได้', ephemeral: true });
            }
            await interaction.deferReply();
            try {
                const res = await docominShop.runSetupDocominShop(interaction.guild, interaction);
                return interaction.editReply(`✅ ติดตั้งระบบร้านค้า Docomin Shop ครบวงจรสำเร็จเรียบร้อย!\n• หมวดหมู่: **${res.catShop.name}**\n• ห้องแคตตาล็อก: <#${res.chCatalog.id}>\n• ห้องช่องทางชำระเงิน: <#${res.chPayment.id}>\n• ห้องรีวิวเครดิต: <#${res.chReviews.id}>\n• ห้องเปิดตั๋วสั่งซื้อ: <#${res.chOrder.id}>\n• ห้องแจ้งเตือนสต็อก: <#${res.chRestock.id}>`);
            } catch (err) {
                console.error(err);
                return interaction.editReply(`❌ เกิดข้อผิดพลาดในการติดตั้ง: ${err.message}`);
            }
        }

        // --- Coupons ---
        if (commandName === 'coupon-create') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ คุณต้องมีสิทธิ์ Administrator จึงจะสร้างคูปองได้', ephemeral: true });
            }
            const code = interaction.options.getString('code');
            const discount = interaction.options.getNumber('discount');
            const type = interaction.options.getString('type');
            const minSpend = interaction.options.getNumber('min_spend') || 0;
            const maxUses = interaction.options.getInteger('max_uses') || 0;

            const c = db.createCoupon(interaction.guildId, {
                code,
                discount,
                type,
                minSpend,
                maxUses
            });

            const discountDisplay = c.type === 'percent' ? `${c.discount}%` : `฿${c.discount} บาท`;
            return interaction.reply(`✅ สร้างโค้ดคูปองส่วนลด **${c.code}** สำเร็จ!\n• ส่วนลด: **${discountDisplay}**\n• ยอดซื้อขั้นต่ำ: **฿${c.minSpend}** บาท\n• สิทธิ์การใช้งาน: **${c.maxUses === 0 ? 'ไม่จำกัด' : `${c.maxUses} สิทธิ์`}**`);
        }

        if (commandName === 'coupon-check') {
            const code = interaction.options.getString('code');
            const c = db.getCoupon(interaction.guildId, code);
            if (!c) {
                return interaction.reply({ content: `❌ ไม่พบโค้ดคูปอง \`${code.toUpperCase()}\` ในระบบ หรือโค้ดหมดอายุแล้ว`, ephemeral: true });
            }
            const discountDisplay = c.type === 'percent' ? `${c.discount}%` : `฿${c.discount} บาท`;
            const remainingUses = c.maxUses === 0 ? 'ไม่จำกัด' : `${Math.max(0, c.maxUses - c.usedCount)} สิทธิ์คงเหลือ`;

            const embed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle(`🎟️ ข้อมูลคูปองส่วนลด: ${c.code}`)
                .addFields(
                    { name: '💰 มูลค่าส่วนลด', value: `\`${discountDisplay}\``, inline: true },
                    { name: '🛒 ยอดซื้อขั้นต่ำ', value: `\`฿${c.minSpend.toLocaleString()} บาท\``, inline: true },
                    { name: '🔢 สิทธิ์คงเหลือ', value: `\`${remainingUses}\``, inline: true }
                )
                .setFooter({ text: 'พิมพ์โค้ดนี้ลงในช่องหมายเหตุเมื่อเปิดตั๋วสั่งซื้อเพื่อรับส่วนลด' });

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (commandName === 'coupon-list') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ คุณต้องมีสิทธิ์ Administrator จึงจะดูรายการคูปองได้', ephemeral: true });
            }
            const coupons = db.getCoupons(interaction.guildId);
            if (coupons.length === 0) {
                return interaction.reply({ content: 'ℹ️ ยังไม่มีการสร้างโค้ดคูปองส่วนลดในระบบ (ใช้คำสั่ง `/coupon-create` เพื่อสร้าง)', ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle(`🎟️ รายการคูปองส่วนลดทั้งหมด — Docomin Shop (${coupons.length} รายการ)`)
                .setDescription('รายชื่อโค้ดคูปองส่วนลดที่ใช้งานได้ในเซิร์ฟเวอร์')
                .setTimestamp();

            coupons.forEach((c, idx) => {
                const discountDisplay = c.type === 'percent' ? `${c.discount}%` : `฿${c.discount} บาท`;
                const maxUsesDisplay = c.maxUses === 0 ? 'ไม่จำกัด' : `${c.usedCount || 0}/${c.maxUses} สิทธิ์`;
                embed.addFields({
                    name: `${idx + 1}. โค้ด: \`${c.code}\``,
                    value: `• **ส่วนลด:** \`${discountDisplay}\`\n• **ขั้นต่ำ:** \`฿${(c.minSpend || 0).toLocaleString()} บาท\`\n• **สิทธิ์:** \`${maxUsesDisplay}\``,
                    inline: true
                });
            });

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (commandName === 'coupon-delete') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ คุณต้องมีสิทธิ์ Administrator จึงจะลบคูปองได้', ephemeral: true });
            }
            const code = interaction.options.getString('code');
            const ok = db.deleteCoupon(interaction.guildId, code);
            return interaction.reply(ok ? `✅ ลบโค้ดคูปองส่วนลด **${code.toUpperCase()}** ออกจากระบบเรียบร้อยแล้ว!` : `❌ ไม่พบโค้ดคูปอง **${code.toUpperCase()}** ในระบบ`);
        }

        if (commandName === 'sales-summary') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ คุณต้องมีสิทธิ์ Administrator จึงจะดูรายงานยอดขายได้', ephemeral: true });
            }
            const stats = db.getSalesAnalytics(interaction.guildId);
            const vouchStats = db.getVouchStats(interaction.client.user.id);
            const embed = docominShop.createSalesSummaryEmbed(stats, vouchStats);
            return interaction.reply({ embeds: [embed] });
        }

        // --- Restock Alert Broadcast (พร้อมแจ้งเตือนสมาชิกที่จองคิวไว้) ---
        if (commandName === 'restock-alert') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ คุณต้องมีสิทธิ์ Administrator จึงจะประกาศสต็อกได้', ephemeral: true });
            }
            const pid = interaction.options.getString('product_id').trim();
            const stock = interaction.options.getInteger('stock');
            const customMsg = interaction.options.getString('message');

            const updated = db.updateProductStock(interaction.guildId, pid, stock);
            if (!updated) {
                return interaction.reply({ content: `❌ ไม่พบสินค้ารหัส \`${pid.toUpperCase()}\` ในระบบ`, ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle(`🚨 [RESTOCK] สินค้าเติมสต็อกใหม่แล้ว! — ${updated.name}`)
                .setDescription(customMsg || `สินค้า **${updated.name}** เติมสต็อกพร้อมส่งเรียบร้อยแล้ว!\nใครที่รออยู่สามารถเปิดตั๋วสั่งซื้อได้ทันที สินค้ามีจำนวนจำกัด`)
                .addFields(
                    { name: '📦 สินค้า', value: `**${updated.name}** (\`${updated.id}\`)`, inline: true },
                    { name: '💰 ราคา', value: `**฿${updated.price.toLocaleString()}** บาท`, inline: true },
                    { name: '🟢 จำนวนที่พร้อมส่ง', value: `**${updated.stock}** ชิ้น`, inline: true }
                )
                .setFooter({ text: 'Docomin Shop Official Restock Alert' })
                .setTimestamp();

            if (updated.imageUrl) {
                embed.setImage(updated.imageUrl);
            }

            const buyBtn = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('btn_order_buy')
                    .setLabel('🛒 สั่งซื้อทันทีก่อนของหมด')
                    .setStyle(ButtonStyle.Success)
            );

            // แจ้งเตือนลูกค้าที่กดรับแจ้งเตือนไว้ (Waiting List Auto-Ping)
            const subscribers = db.getRestockSubscribers(updated.id);
            let pingContent = '@everyone 🚨 สต็อกสินค้าเข้าใหม่แล้ว!';
            if (subscribers.length > 0) {
                const mentions = subscribers.map(id => `<@${id}>`).join(' ');
                pingContent += `\n🔔 **แจ้งเตือนสมาชิกที่ลงชื่อรอรับสินค้า:** ${mentions}`;
                db.clearRestockSubscribers(updated.id);
            }

            await interaction.channel.send({ content: pingContent, embeds: [embed], components: [buyBtn] });
            return interaction.reply({ content: `✅ ส่งการ์ดประกาศสต็อกเข้าเรียบร้อยแล้ว!${subscribers.length > 0 ? ` (แท็กแจ้งเตือนผู้รอสินค้า ${subscribers.length} คน)` : ''}`, ephemeral: true });
        }

        // --- VIP Loyalty Tier System ---
        if (commandName === 'vip') {
            const stats = db.getCustomerStats(interaction.guildId, interaction.user.id);
            const embed = docominShop.createVipEmbed(interaction.user, stats);
            return interaction.reply({ embeds: [embed] });
        }

        // --- Customer Order History ---
        if (commandName === 'my-orders') {
            const stats = db.getCustomerStats(interaction.guildId, interaction.user.id);
            const embed = docominShop.createMyOrdersEmbed(interaction.user, stats, stats.orders || []);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // --- Restock Wishlist Subscription ---
        if (commandName === 'notify-restock') {
            const pidInput = interaction.options.getString('product_id').trim();
            const products = db.getProducts(interaction.guildId);
            const itemQuery = pidInput.toLowerCase();
            const found = products.find(p => p.id.toLowerCase() === itemQuery || p.name.toLowerCase().includes(itemQuery));
            const targetId = found ? found.id : pidInput.toUpperCase();
            const targetName = found ? found.name : targetId;

            const res = db.subscribeRestock(targetId, interaction.user.id);
            if (!res.success) {
                return interaction.reply({
                    content: `ℹ️ คุณได้ลงทะเบียนแจ้งเตือนสินค้า **${targetName}** (\`${targetId}\`) ไว้อยู่แล้ว! เมื่อมีของเข้าบอทจะแท็กคุณทันทีครับ ✨`,
                    ephemeral: true
                });
            }

            const embed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle('🔔 ลงทะเบียนแจ้งเตือนเติมสต็อกสำเร็จ!')
                .setDescription(`ระบบจะแท็กคุณ <@${interaction.user.id}> ทันทีเมื่อสินค้า **${targetName}** มีการเติมสต็อกใหม่เข้าเซิร์ฟเวอร์!`)
                .addFields(
                    { name: '📦 สินค้าที่ติดตาม', value: `\`${targetName}\` (${targetId})`, inline: true },
                    { name: '👥 คิวรอแจ้งเตือนขณะนี้', value: `${res.totalWaiting} คน`, inline: true }
                )
                .setFooter({ text: 'Docomin Shop Restock Watcher' })
                .setTimestamp();

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // --- Order Tracking System ---
        if (commandName === 'order-status') {
            const orderId = interaction.options.getString('order_id').trim();
            const activeTicket = db.getOrderTicket(orderId);
            const allSales = db.getSales(interaction.guildId, 200);
            const completedSale = allSales.find(s => s.orderId === orderId || s.id === orderId);

            if (!activeTicket && !completedSale) {
                return interaction.reply({
                    content: `❌ ไม่พบข้อมูลคำสั่งซื้อรหัส \`${orderId}\` ในระบบ กรุณาตรวจสอบรหัสออเดอร์อีกครั้งครับ`,
                    ephemeral: true
                });
            }

            const embed = new EmbedBuilder().setTimestamp();

            if (activeTicket) {
                const isCompleted = activeTicket.status === 'completed';
                embed.setColor(isCompleted ? 0x57F287 : 0xFEE75C)
                    .setTitle(`📦 สถานะคำสั่งซื้อ: #${orderId}`)
                    .addFields(
                        { name: '👤 ลูกค้า', value: `<@${activeTicket.userId}>`, inline: true },
                        { name: '📦 รายการสินค้า', value: `\`${activeTicket.itemName || 'สินค้า'}\` (x${activeTicket.quantity || 1})`, inline: true },
                        { name: '💳 สถานะ', value: isCompleted ? '✅ **จัดส่งสำเร็จแล้ว**' : '⏳ **กำลังดำเนินการ / รอส่งมอบ**', inline: true },
                        { name: '💰 ยอดชำระ', value: `฿${(activeTicket.netAmount || activeTicket.originalAmount || 150).toLocaleString()} บาท`, inline: true },
                        { name: '💳 ช่องทาง', value: activeTicket.paymentMethod || 'ไม่ระบุ', inline: true },
                        { name: '🎟️ ส่วนลด/คูปอง', value: activeTicket.couponCode ? `\`${activeTicket.couponCode}\` (-฿${(activeTicket.discount || 0).toLocaleString()})` : (activeTicket.discount ? `VIP Discount (-฿${activeTicket.discount.toLocaleString()})` : 'ไม่มี'), inline: true }
                    );
            } else if (completedSale) {
                embed.setColor(0x57F287)
                    .setTitle(`📦 ข้อมูลคำสั่งซื้อที่เสร็จสิ้น: #${completedSale.orderId || completedSale.id}`)
                    .addFields(
                        { name: '👤 ลูกค้า', value: `<@${completedSale.customerId}> (\`${completedSale.customerTag}\`)`, inline: true },
                        { name: '📦 สินค้า', value: `\`${completedSale.productName}\` (x${completedSale.quantity || 1})`, inline: true },
                        { name: '💳 สถานะ', value: '✅ **จัดส่งสำเร็จเรียบร้อย (Delivered)**', inline: true },
                        { name: '💰 ยอดสุทธิ', value: `฿${(completedSale.amount || 0).toLocaleString()} บาท`, inline: true },
                        { name: '👮 แอดมินผู้ส่งมอบ', value: `<@${completedSale.adminId}>`, inline: true },
                        { name: '📅 วันที่จัดส่ง', value: `<t:${Math.floor((completedSale.timestamp || Date.now()) / 1000)}:R>`, inline: true }
                    );
            }

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // --- Blacklist Management ---
        // --- Blacklist Management ---
        if (commandName === 'blacklist' || commandName === 'blacklist-check' || commandName === 'blacklist-add' || commandName === 'blacklist-remove') {
            const action = interaction.options.getString('action') || (commandName === 'blacklist-add' ? 'add' : (commandName === 'blacklist-remove' ? 'remove' : 'check'));
            const targetUser = interaction.options.getUser('user');

            if (action === 'check') {
                const info = db.getBlacklist(targetUser.id);
                if (!info) {
                    const cleanEmbed = new EmbedBuilder()
                        .setColor(0x57F287)
                        .setTitle(`✅ สมาชิกปลอดภัย: ${targetUser.tag}`)
                        .setDescription(`ผู้ใช้ <@${targetUser.id}> ไม่อยู่ในรายชื่อบัญชีดำ (Blacklist) มีประวัติขาวสะอาด สามารถทำธุรกรรมได้ตามปกติ ✨`)
                        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                        .setTimestamp();
                    return interaction.reply({ embeds: [cleanEmbed] });
                }

                const blEmbed = docominShop.createBlacklistEmbed(targetUser, info);
                return interaction.reply({ embeds: [blEmbed] });
            }

            if (action === 'add') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: '❌ คุณต้องมีสิทธิ์ Administrator จึงจะจัดการบัญชีดำได้', ephemeral: true });
                }
                const reason = interaction.options.getString('reason') || 'ไม่มีการระบุสาเหตุ';

                if (targetUser.id === interaction.user.id) {
                    return interaction.reply({ content: '❌ ไม่สามารถขึ้นบัญชีดำตัวเองได้', ephemeral: true });
                }
                if (targetUser.bot) {
                    return interaction.reply({ content: '❌ ไม่สามารถขึ้นบัญชีดำบอทได้', ephemeral: true });
                }

                const info = db.addBlacklist(targetUser.id, reason, interaction.user.id);
                const blEmbed = docominShop.createBlacklistEmbed(targetUser, info);

                return interaction.reply({
                    content: `🚨 **ขึ้นบัญชีดำเรียบร้อยแล้ว:** <@${targetUser.id}> จะถูกตรวจจับความปลอดภัยและมีสัญญาณเตือนแดงเมื่อเปิดตั๋ว`,
                    embeds: [blEmbed]
                });
            }

            if (action === 'remove') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: '❌ คุณต้องมีสิทธิ์ Administrator จึงจะปลดบัญชีดำได้', ephemeral: true });
                }
                const removed = db.removeBlacklist(targetUser.id);

                if (!removed) {
                    return interaction.reply({ content: `ℹ️ ผู้ใช้ <@${targetUser.id}> ไม่อยู่ในบัญชีดำอยู่แล้ว`, ephemeral: true });
                }

                const unblEmbed = new EmbedBuilder()
                    .setColor(0x57F287)
                    .setTitle('🟢 ปลดออกจากบัญชีดำสำเร็จ (Blacklist Removed)')
                    .setDescription(`ผู้ใช้ <@${targetUser.id}> ได้รับการปลดออกจากบัญชีดำโดย <@${interaction.user.id}> เรียบร้อยแล้ว`)
                    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                    .setTimestamp();

                return interaction.reply({ embeds: [unblEmbed] });
            }
        }

        // --- Shop Promotion & Broadcast System ---
        if (commandName === 'shop-broadcast') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ คุณต้องมีสิทธิ์ Administrator จึงจะบรอดแคสต์ได้', ephemeral: true });
            }
            const title = interaction.options.getString('title');
            const description = interaction.options.getString('description');
            const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
            const couponCode = interaction.options.getString('coupon_code');
            const imageUrl = interaction.options.getString('image_url');
            const ping = interaction.options.getString('ping') || 'none';

            if (!targetChannel.isTextBased()) {
                return interaction.reply({ content: '❌ กรุณาเลือกห้องข้อความ (Text Channel)', ephemeral: true });
            }

            const embed = docominShop.createBroadcastEmbed({
                title,
                description,
                couponCode,
                imageUrl,
                author: interaction.user
            });
            const row = docominShop.createBroadcastActionRow();

            let pingContent = null;
            if (ping === 'everyone') pingContent = '@everyone';
            else if (ping === 'here') pingContent = '@here';

            await targetChannel.send({
                content: pingContent,
                embeds: [embed],
                components: [row]
            });

            return interaction.reply({
                content: `📢 บรอดแคสต์โปรโมชั่นไปยังห้อง <#${targetChannel.id}> สำเร็จเรียบร้อยแล้ว!`,
                ephemeral: true
            });
        }

        // --- Verified Customer Role System ---
        if (commandName === 'set-customer-role') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ คุณต้องมีสิทธิ์ Administrator จึงจะตั้งค่ายศได้', ephemeral: true });
            }
            const role = interaction.options.getRole('role');
            db.setCustomerRole(interaction.guildId, role.id);
            return interaction.reply({
                content: `✅ ตั้งค่ายศลูกค้าพิเศษเป็น **@${role.name}** เรียบร้อยแล้ว! เมื่อลูกค้าซื้อสินค้าสำเร็จ บอทจะมอบยศนี้ให้อัตโนมัติทันที ✨`,
                ephemeral: true
            });
        }

        // --- Digital Key Stock Vault ---
        if (commandName === 'stock-add-keys') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ คุณต้องมีสิทธิ์ Administrator จึงจะเพิ่มสต็อกคีย์ได้', ephemeral: true });
            }
            const pid = interaction.options.getString('product_id').trim().toUpperCase();
            const keysInput = interaction.options.getString('keys');
            const keys = keysInput.split(/[\n,]/).map(k => k.trim()).filter(Boolean);

            if (keys.length === 0) {
                return interaction.reply({ content: '❌ ไม่พบข้อมูลรหัสคีย์ที่ระบุ', ephemeral: true });
            }

            const result = db.addProductKeys(pid, keys);
            const products = db.getProducts(interaction.guildId);
            const foundProduct = products.find(p => p.id.toUpperCase() === pid);
            if (foundProduct) {
                db.updateProductStock(interaction.guildId, foundProduct.id, result.total);
            }

            return interaction.reply({
                content: `✅ เพิ่มรหัสเข้าคลังสต็อกดิจิทัลของสินค้า \`${pid}\` สำเร็จ!\n• เพิ่มใหม่: **+${result.added}** ชุด\n• ยอดคีย์คงเหลือทั้งหมดในคลัง: **${result.total}** ชุด`,
                ephemeral: true
            });
        }

        // --- Cloud Database Backup & Restore ---
        // --- Cloud Database Backup & Restore ---
        if (commandName === 'db' || commandName === 'db-backup' || commandName === 'db-restore') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ คุณต้องมีสิทธิ์ Administrator จึงจะจัดการฐานข้อมูลได้', ephemeral: true });
            }
            const action = interaction.options.getString('action') || (commandName === 'db-restore' ? 'restore' : 'backup');

            if (action === 'backup') {
                await interaction.deferReply({ ephemeral: true });
                const jsonStr = db.backupDB();
                const buffer = Buffer.from(jsonStr, 'utf-8');
                const fileName = `database-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

                const stats = db.getSalesAnalytics(interaction.guildId);
                const embed = new EmbedBuilder()
                    .setColor(0x57F287)
                    .setTitle('💾 สำรองฐานข้อมูลร้านค้าสำเร็จ (Database Backup)')
                    .setDescription('ไฟล์ฐานข้อมูลนี้บรรจุข้อมูลสินค้า, ประวัติยอดขาย, ลูกค้า VIP, คูปอง, และการตั้งค่าทั้งหมดของเซิร์ฟเวอร์\nคุณสามารถเก็บไฟล์นี้ไว้ และใช้คำสั่ง `/db action:กู้คืนฐานข้อมูล` เพื่อกู้คืนได้ตลอดเวลา')
                    .addFields(
                        { name: '📊 ยอดขายสะสม', value: `฿${(stats.totalRevenue || 0).toLocaleString()} บาท`, inline: true },
                        { name: '📦 ออเดอร์ทั้งหมด', value: `${(stats.totalOrders || 0).toLocaleString()} บิล`, inline: true },
                        { name: '📁 ขนาดไฟล์', value: `${(buffer.length / 1024).toFixed(2)} KB`, inline: true }
                    )
                    .setTimestamp();

                return interaction.editReply({
                    embeds: [embed],
                    files: [{ attachment: buffer, name: fileName }]
                });
            }

            if (action === 'restore') {
                const file = interaction.options.getAttachment('file');
                if (!file || !file.name.endsWith('.json')) {
                    return interaction.reply({ content: '❌ กรุณาแนบไฟล์ JSON สำหรับกู้คืนข้อมูล (เช่น database-backup-xxx.json)', ephemeral: true });
                }

                await interaction.deferReply({ ephemeral: true });
                try {
                    const response = await fetch(file.url);
                    const text = await response.text();
                    const res = db.restoreDB(text);
                    if (!res.success) {
                        return interaction.editReply(`❌ กู้คืนข้อมูลไม่สำเร็จ: ${res.error}`);
                    }
                    return interaction.editReply('🎉 **กู้คืนฐานข้อมูลสำเร็จเรียบร้อยแล้ว! 100%** ข้อมูลทั้งหมดถูกนำกลับมาใช้งานทันที');
                } catch (err) {
                    return interaction.editReply(`❌ เกิดข้อผิดพลาดในการดาวน์โหลดไฟล์: ${err.message}`);
                }
            }
        }

        // --- Help ---
        if (commandName === 'help') {
            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle('📖 คู่มือและระบบทั้งหมดของบอท (All-in-One Dashboard)')
                .addFields(
                    { name: '🎛️ ศูนย์ควบคุม & AI จัดการเซิร์ฟเวอร์ (Master Panel & AI Admin)', value: '`/panel` หรือ `/admin-panel` เปิดแผงควบคุมร้านค้าและความปลอดภัยครบวงจร\n`/sync` บังคับซิงค์และอัปเดตคำสั่งใหม่เข้าเซิร์ฟเวอร์ทันที\n`/ai-admin <คำสั่ง>` ให้ Gemini AI ช่วยจัดการเซิร์ฟเวอร์อัตโนมัติ (หรือแท็ก @Bot)' },
                    { name: '🛒 Docomin Shop (ระบบร้านค้า, ลูกค้า & สถิติ)', value: '`/setup-docomin-shop` ติดตั้งระบบร้านค้าครบวงจรใน 1 วินาที (ป้องกันห้องซ้ำ 100%)\n`/vip` เช็กระดับ VIP และส่วนลดพิเศษของคุณ\n`/my-orders` ดูประวัติการสั่งซื้อของคุณ\n`/order-status <id>` เช็กสถานะคำสั่งซื้อ\n`/notify-restock <id>` ลงชื่อรอรับการแจ้งเตือนเมื่อของเติมสต็อก\n`/vouch` ส่งรีวิวและบันทึกเครดิต\n`/reputation` ดูคะแนนเครดิตร้านค้า\n`/products` ดูแคตตาล็อกสินค้า\n`/payment`, `/pay-qr` ชำระเงิน/สร้าง QR พร้อมเพย์\n`/setup-order-ticket` ติดตั้งแผงตั๋วสั่งซื้อ\n`/coupon-create`, `/coupon-check`, `/coupon-list`, `/coupon-delete` จัดการคูปอง\n`/sales-summary` รายงานสรุปยอดขายและสินค้าขายดี\n`/shop-broadcast` บรอดแคสต์โปรโมชั่น Flash Sale พร้อมปุ่มซื้อ\n`/set-customer-role` กำหนดยศลูกค้าอัตโนมัติเมื่อซื้อสำเร็จ\n`/stock-add-keys` เพิ่มรหัส/คีย์เข้าสต็อกดิจิทัลอัตโนมัติ\n`/db-backup`, `/db-restore` สำรองและกู้คืนฐานข้อมูลบน Cloud\n`/blacklist-check`, `/blacklist-add`, `/blacklist-remove` ระบบบัญชีดำป้องกันมิจฉาชีพ\n`/product-add`, `/product-stock`, `/restock-alert` จัดการสต็อก' },
                    { name: '🍎 Blox Fruits Real-Time Stock & Alert', value: '`/bloxfruits-stock` ดูสต็อกผลปีศาจแบบเรียลไทม์พร้อมรูปของแท้\n`/bloxfruits-alert` เลือกผลที่ต้องการให้แจ้งเตือน\n`/bloxfruits-channel` ตั้งห้องส่งสต็อกอัตโนมัติ' },
                    { name: '⚖️ Blox Fruits Trade & Value Calculator', value: '`/bf-value <ผล>` ดูมูลค่าตลาดจริง Demand (1-10) และแนวโน้มราคา\n`/bf-trade <ผลคุณ> <ผลเขา>` วิเคราะห์การเทรด คำนวณกำไร/ขาดทุนเป็น %' },
                    { name: '🎙️ Voice Master (ห้องเสียงส่วนตัว)', value: '`/setup-voicemaster` ติดตั้งระบบห้องเสียงส่วนตัวอัตโนมัติพร้อมแผงควบคุม (ล็อก, ซ่อน, จำกัดคน, เตะสมาชิก)' },
                    { name: '💰 เศรษฐกิจ 2.0 & ร้านค้า (Economy & Shop)', value: '`/bank` ดูทรัพย์สิน\n`/deposit`, `/withdraw` ฝาก/ถอนเงิน\n`/work` ทำงานหาเงิน (ทุก 30 นาที)\n`/rob <สมาชิก>` ปล้นเงินสด\n`/shop`, `/buy <id>`, `/shop-add`, `/shop-remove`' },
                    { name: '🛡️ ยืนยันตัวตน & ความปลอดภัย (Security)', value: '`/setup-verify <ยศ>` ติดตั้งปุ่มกดยืนยันตัวตนสำหรับสมาชิกใหม่\n`/automod` ป้องกันลิงก์เชิญ & ป้องกันสแปม' },
                    { name: '✨ ปัญญาประดิษฐ์ (AI)', value: '`/ask <คำถาม>` หรือแท็กบอท ถามตอบกับ Gemini 3.8 Flash ตอบฉลาดและรวดเร็ว' },
                    { name: '🌐 Uptime Monitor (ให้ออนตลอด 24 ชม.)', value: '`/uptime-add <URL>` เพิ่มเว็บให้ออน 24 ชม.\n`/uptime-list` ดูเว็บที่มอนิเตอร์\n`/uptime-remove <URL>` ลบเว็บ' },
                    { name: '⭐ เลเวล & การจัดอันดับ (Leveling)', value: '`/rank` ดูเลเวลและ EXP ของคุณหรือเพื่อน\n`/rank-leaderboard` ดูตารางอันดับคนแชทเยอะสุด' },
                    { name: '🎰 มินิเกม & การเดิมพัน (Games)', value: '`/slots` สล็อตแมชชีน\n`/coinflip` โยนเหรียญหัวก้อย\n`/rps` เป่ายิ้งฉุบ\n`/dice` ทอยลูกเต๋า' },
                    { name: '💤 ระบบไม่อยู่ (AFK)', value: '`/afk [เหตุผล]` บอทจะแจ้งเตือนเมื่อมีคนแท็กคุณ' },
                    { name: '⚙️ จัดระเบียบ & สถิติเซิร์ฟเวอร์', value: '`/auto-setup` จัดห้องและหมวดหมู่อัตโนมัติใน 1 วินาที\n`/setup-stats` สร้างห้องสถิติจำนวนสมาชิกสด\n`/set-welcome`, `/set-autorole`, `/set-logs`' },
                    { name: '🛡️ จัดการเซิร์ฟเวอร์ (Moderation)', value: '`/kick`, `/ban`, `/unban`, `/timeout`, `/warn`, `/warnings`, `/slowmode`, `/lock`, `/unlock`, `/embed`' },
                    { name: '🎵 ระบบเปิดเพลง (Music)', value: '`/play <เพลง>`, `/search`, `/music-panel`, `/skip`, `/stop`, `/queue`' },
                    { name: '🎮 ระบบ Roblox', value: '`/roblox-user`, `/roblox-game`, `/roblox-group`, `/roblox-bind`' },
                    { name: '🎫 ตั๋ว & แจกของรางวัล', value: '`/setup-ticket`, `/giveaway`' },
                    { name: '🧹 ลบข้อความ & ห้อง', value: '`/clear 1-1000`, `/delete-channel`, `/delete-category`, `/nuke`' }
                )
                .setFooter({ text: 'All-in-One Discord Bot • พร้อมใช้งาน 100%' });

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }

    // 4. จัดการการกดปุ่ม (Buttons)
    if (interaction.isButton()) {
        const customId = interaction.customId;

        // --- ปุ่มระบบ Voice Master ---
        if (customId.startsWith('vm_')) {
            return voicemaster.handleVoiceButton(interaction);
        }

        // --- ปุ่มแผงควบคุมระบบ (Master Control Panel Buttons) ---
        if (customId === 'btn_panel_refresh') {
            const panelData = panel.createPanelEmbedAndRows(interaction.guild, client);
            return interaction.update(panelData);
        }

        if (customId === 'btn_panel_view_products') {
            const products = db.getProducts(interaction.guildId);
            const embed = docominShop.createCatalogEmbed(products, 'all');
            const menu = docominShop.createCatalogSelectMenu(products);
            return interaction.reply({ embeds: [embed], components: [menu], ephemeral: true });
        }

        if (customId === 'btn_panel_add_product') {
            return interaction.showModal(panel.createAddProductModal());
        }

        if (customId === 'btn_panel_view_payment' || customId === 'btn_panel_set_payment' || customId === 'btn_pay_admin_setup') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ คุณต้องมีสิทธิ์ Administrator จึงจะตั้งค่าช่องทางชำระเงินได้', ephemeral: true });
            }
            const currentConfig = db.getPaymentConfig(interaction.guildId) || {};
            return interaction.showModal(docominShop.createSetPaymentModal(currentConfig));
        }

        if (customId === 'btn_panel_purge_modal') {
            return interaction.showModal(panel.createPurgeModal());
        }

        if (customId === 'btn_panel_toggle_lock') {
            const channel = interaction.channel;
            const everyone = interaction.guild.roles.everyone;
            const perms = channel.permissionsFor(everyone);
            const isCurrentlyLocked = perms && !perms.has(PermissionFlagsBits.SendMessages);

            if (isCurrentlyLocked) {
                await channel.permissionOverwrites.edit(everyone, {
                    [PermissionFlagsBits.SendMessages]: null
                });
                return interaction.reply({ content: `🔓 ปลดล็อกห้อง ${channel.toString()} ให้ทุกคนส่งข้อความได้ตามปกติแล้ว!`, ephemeral: true });
            } else {
                await channel.permissionOverwrites.edit(everyone, {
                    [PermissionFlagsBits.SendMessages]: false
                });
                return interaction.reply({ content: `🔒 ล็อกห้อง ${channel.toString()} ห้ามสมาชิกทั่วไปส่งข้อความเรียบร้อยแล้ว!`, ephemeral: true });
            }
        }

        if (customId === 'btn_panel_ai_prompt') {
            return interaction.showModal(panel.createAiPromptModal());
        }

        if (customId === 'btn_panel_force_sync') {
            await interaction.deferReply({ ephemeral: true });
            const rest = new REST({ version: '10' }).setToken(TOKEN);
            try {
                const cmdData = commands.map(c => c.toJSON());
                await rest.put(
                    Routes.applicationGuildCommands(client.user.id, interaction.guildId),
                    { body: cmdData }
                );
                return interaction.editReply(`⚡ **ซิงค์คำสั่งสำเร็จทั้งหมด ${cmdData.length} คำสั่ง!**\n` +
                    `✅ พร้อมใช้งานในเซิร์ฟเวอร์ **${interaction.guild.name}** ทันที\n` +
                    `💡 หากยังไม่เห็นคำสั่งใหม่บน Discord ให้กด **Ctrl + R** บนคอมพิวเตอร์ หรือเลื่อนปิดเปิดแอป Discord ในมือถือใหม่อีกครั้งครับ!`);
            } catch (e) {
                return interaction.editReply(`❌ ซิงค์คำสั่งไม่สำเร็จ: ${e.message}`);
            }
        }

        // --- ปุ่มกดยืนยันตัวตน (Verification Gate) ---
        if (customId === 'btn_verify_member') {
            const verifyData = db.getVerification(interaction.guildId);
            if (!verifyData || !verifyData.roleId) {
                return interaction.reply({ content: '❌ ยังไม่มีการตั้งค่ายศยืนยันตัวตนในเซิร์ฟเวอร์นี้', ephemeral: true });
            }
            const member = interaction.member;
            const role = interaction.guild.roles.cache.get(verifyData.roleId);
            if (!role) {
                return interaction.reply({ content: '❌ ไม่พบยศยืนยันตัวตนในระบบ (อาจถูกลบไปแล้ว)', ephemeral: true });
            }
            if (member.roles.cache.has(role.id)) {
                return interaction.reply({ content: 'ℹ️ คุณได้รับการยืนยันตัวตนเรียบร้อยแล้ว!', ephemeral: true });
            }
            try {
                await member.roles.add(role);
                return interaction.reply({ content: `🎉 **ยืนยันตัวตนสำเร็จ!** ยินดีต้อนรับเข้าสู่เซิร์ฟเวอร์ ได้รับยศ **${role.name}** เรียบร้อยแล้ว`, ephemeral: true });
            } catch (err) {
                return interaction.reply({ content: `❌ บอทไม่สามารถมอบยศได้: ${err.message} (โปรดย้ายยศของบอทให้อยู่สูงกว่ายศที่มอบ)`, ephemeral: true });
            }
        }

        // --- ปุ่มระบบสต็อก Blox Fruits ---
        if (customId.startsWith('btn_bloxfruits_refresh_')) {
            const isMirage = customId.includes('mirage');
            const { embed } = await createStockEmbed(isMirage);

            const refreshBtn = new ButtonBuilder()
                .setCustomId(`btn_bloxfruits_refresh_${isMirage ? 'mirage' : 'normal'}`)
                .setLabel('🔄 รีเฟรชสต็อก')
                .setStyle(ButtonStyle.Primary);

            const alertBtn = new ButtonBuilder()
                .setCustomId('btn_bloxfruits_open_alert')
                .setLabel('🔔 ตั้งค่าแจ้งเตือนผล')
                .setStyle(ButtonStyle.Success);

            const row = new ActionRowBuilder().addComponents(refreshBtn, alertBtn);
            return interaction.update({ embeds: [embed], components: [row] });
        }

        if (customId === 'btn_bloxfruits_open_alert') {
            const userAlerts = db.getUserBloxFruitsAlerts(interaction.user.id);
            const selectMenuRow = createFruitSelectMenu(userAlerts);

            const embed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle('🔔 เลือกระบบแจ้งเตือนผลปีศาจ Blox Fruits')
                .setDescription('เลือกผลปีศาจที่คุณต้องการรับการแจ้งเตือนจากเมนูด้านล่าง\nเมื่อผลที่คุณเลือกเข้ามาในสต็อกของ **Blox Fruit Dealer** ระบบจะส่งข้อความแจ้งเตือนพร้อมรูปภาพของผลนั้นให้คุณทันที!')
                .addFields({
                    name: '📌 ผลที่คุณกำลังติดตามขณะนี้',
                    value: userAlerts.length > 0 
                        ? userAlerts.map(id => {
                            const f = FRUITS.find(item => item.id === id);
                            return f ? `• **${f.name}** (${f.thName})` : `• ${id}`;
                        }).join('\n')
                        : '*ยังไม่ได้เลือกผลใดๆ*'
                })
                .setFooter({ text: 'คุณสามารถเลือกผลได้สูงสุด 25 ผล และแก้ไขได้ตลอดเวลา' });

            return interaction.reply({ embeds: [embed], components: [selectMenuRow], ephemeral: true });
        }

        // --- ปุ่มเปิดกล่องค้นหาเพลง (Modal) ---
        if (customId === 'btn_music_search_modal') {
            const modal = new ModalBuilder()
                .setCustomId('modal_music_search')
                .setTitle('🔍 ค้นหาเพลงจาก YouTube');

            const textInput = new TextInputBuilder()
                .setCustomId('input_music_query')
                .setLabel('พิมพ์ชื่อเพลง หรือ ลิงก์ YouTube:')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('เช่น lofi hip hop, เพลงฮิต...')
                .setRequired(true);

            const row = new ActionRowBuilder().addComponents(textInput);
            modal.addComponents(row);
            return interaction.showModal(modal);
        }

        // --- ปุ่มเลือกโหมดเพลง (เล่นทันที / เข้าคิว) ---
        if (customId.startsWith('btn_music_mode_playnow_')) {
            const choiceId = customId.replace('btn_music_mode_playnow_', '');
            return music.executeChosenMode(interaction, choiceId, 'playnow');
        }

        if (customId.startsWith('btn_music_mode_queue_')) {
            const choiceId = customId.replace('btn_music_mode_queue_', '');
            return music.executeChosenMode(interaction, choiceId, 'queue');
        }

        if (customId === 'btn_music_mode_cancel') {
            return interaction.update({ content: '🚫 ยกเลิกรายการเพลงเรียบร้อยแล้ว', embeds: [], components: [] });
        }

        // --- ปุ่มควบคุมเพลง (Music Buttons) ---
        if (customId === 'btn_music_pause_resume') {
            const state = music.pauseOrResume(interaction.guildId);
            if (!state) return interaction.reply({ content: '❌ ไม่มีเพลงที่กำลังเล่นอยู่', ephemeral: true });
            return interaction.reply({ content: state === 'paused' ? '⏸️ หยุดเพลงชั่วคราวแล้ว' : '▶️ เล่นเพลงต่อแล้ว', ephemeral: true });
        }

        if (customId === 'btn_music_skip') {
            const ok = music.skip(interaction.guildId);
            return interaction.reply({ content: ok ? '⏭️ ข้ามเพลงเรียบร้อยแล้ว!' : '❌ ไม่มีเพลงให้ข้าม', ephemeral: true });
        }

        if (customId === 'btn_music_stop') {
            const ok = music.stop(interaction.guildId);
            return interaction.reply({ content: ok ? '⏹️ หยุดเล่นเพลงและออกจากห้องเสียงเรียบร้อยแล้ว' : '❌ บอทไม่ได้กำลังเล่นเพลง', ephemeral: true });
        }

        if (customId === 'btn_music_queue') {
            const q = music.getQueue(interaction.guildId);
            if (!q || q.songs.length === 0) {
                return interaction.reply({ content: '📜 ขณะนี้ไม่มีคิวเพลงในระบบ', ephemeral: true });
            }
            const upcoming = q.songs.slice(0, 10).map((s, idx) => `${idx === 0 ? '▶️' : `${idx + 1}.`} ${s.title} (${s.durationRaw})`).join('\n');
            return interaction.reply({ content: `📜 **รายการคิวเพลง:**\n\`\`\`\n${upcoming}\n\`\`\``, ephemeral: true });
        }

        // --- ปุ่มเปิดตั๋ว ---
        if (customId === 'btn_open_ticket') {
            const existingChannel = interaction.guild.channels.cache.find(
                c => c.name === `ticket-${interaction.user.username.toLowerCase()}`
            );
            if (existingChannel) {
                return interaction.reply({
                    content: `⚠️ คุณมีตั๋วที่เปิดอยู่แล้ว: <#${existingChannel.id}>`,
                    ephemeral: true
                });
            }

            await interaction.reply({ content: '⏳ กำลังสร้างห้องตั๋วส่วนตัวให้คุณ...', ephemeral: true });

            try {
                const ticketChannel = await interaction.guild.channels.create({
                    name: `ticket-${interaction.user.username}`,
                    type: ChannelType.GuildText,
                    permissionOverwrites: [
                        {
                            id: interaction.guild.roles.everyone.id,
                            deny: [PermissionFlagsBits.ViewChannel]
                        },
                        {
                            id: interaction.user.id,
                            allow: [
                                PermissionFlagsBits.ViewChannel,
                                PermissionFlagsBits.SendMessages,
                                PermissionFlagsBits.AttachFiles,
                                PermissionFlagsBits.ReadMessageHistory
                            ]
                        },
                        {
                            id: client.user.id,
                            allow: [
                                PermissionFlagsBits.ViewChannel,
                                PermissionFlagsBits.SendMessages,
                                PermissionFlagsBits.ManageChannels
                            ]
                        }
                    ]
                });

                db.saveTicket(ticketChannel.id, {
                    userId: interaction.user.id,
                    createdAt: Date.now()
                });

                const ticketEmbed = new EmbedBuilder()
                    .setColor(0x5865F2)
                    .setTitle(`🎫 ตั๋วติดต่อของ ${interaction.user.username}`)
                    .setDescription(`สวัสดี <@${interaction.user.id}> ยินดีต้อนรับ!\nกรุณาพิมพ์รายละเอียดสิ่งที่ต้องการสอบถามหรือแจ้งปัญหาไว้ได้เลยครับ\nเมื่อเสร็จสิ้นการสนทนา สามารถกดปุ่ม **"ปิดตั๋ว"** ด้านล่างได้เลย`)
                    .setFooter({ text: 'Ticket Management' })
                    .setTimestamp();

                const closeBtn = new ButtonBuilder()
                    .setCustomId(`btn_close_ticket_${ticketChannel.id}`)
                    .setLabel('🔒 ปิดตั๋ว (Close Ticket)')
                    .setStyle(ButtonStyle.Danger);

                const row = new ActionRowBuilder().addComponents(closeBtn);
                await ticketChannel.send({ content: `<@${interaction.user.id}> ทีมงานจะมาตอบกลับเร็วที่สุดครับ`, embeds: [ticketEmbed], components: [row] });

                return interaction.editReply({ content: `✅ สร้างห้องตั๋วเรียบร้อยแล้ว: <#${ticketChannel.id}>` });
            } catch (err) {
                console.error(err);
                return interaction.editReply({ content: `❌ ไม่สามารถสร้างห้องตั๋วได้: ${err.message}` });
            }
        }

        // --- ปุ่มปิดตั๋ว ---
        if (customId.startsWith('btn_close_ticket_')) {
            const channelId = customId.replace('btn_close_ticket_', '');
            await interaction.reply('🔒 กำลังปิดตั๋วและจะลบห้องนี้ในอีก 5 วินาที...');
            setTimeout(async () => {
                const ch = interaction.guild.channels.cache.get(channelId);
                if (ch) {
                    db.deleteTicket(channelId);
                    await ch.delete('Ticket Closed').catch(() => {});
                }
            }, 5000);
            return;
        }

        // --- ปุ่มยืนยันตัวตน (Verify) ---
        if (customId === 'btn_verify_member') {
            const vConf = db.getVerification ? db.getVerification(interaction.guildId) : null;
            const roleId = (vConf && vConf.roleId) || db.getSetting('verifyRoleId');
            if (!roleId) {
                return interaction.reply({ content: '❌ ยังไม่ได้ตั้งค่ายศยืนยันตัวตนในระบบ (ให้แอดมินใช้คำสั่ง `/setup-verify`)', ephemeral: true });
            }

            const role = interaction.guild.roles.cache.get(roleId);
            if (!role) {
                return interaction.reply({ content: '❌ ไม่พบยศดังกล่าวในเซิร์ฟเวอร์', ephemeral: true });
            }

            try {
                if (interaction.member.roles.cache.has(roleId)) {
                    return interaction.reply({ content: 'ℹ️ คุณผ่านการยืนยันตัวตนและมียศนี้อยู่แล้ว!', ephemeral: true });
                }

                await interaction.member.roles.add(role);
                return interaction.reply({ content: `🎉 ยืนยันตัวตนสำเร็จ! คุณได้รับยศ **${role.name}** เรียบร้อยแล้ว`, ephemeral: true });
            } catch (err) {
                return interaction.reply({ content: `❌ ไม่สามารถให้ยศได้: ${err.message} (โปรดตรวจสอบว่ายศบอทอยู่สูงกว่ายศที่แจก)`, ephemeral: true });
            }
        }

        // --- ปุ่มเข้าร่วม Giveaway ---
        if (customId === 'btn_giveaway_join') {
            const g = db.getGiveaway(interaction.message.id);
            if (!g) {
                return interaction.reply({ content: '❌ กิจกรรมนี้สิ้นสุดลงแล้ว', ephemeral: true });
            }

            g.entries = g.entries || [];
            if (g.entries.includes(interaction.user.id)) {
                g.entries = g.entries.filter(id => id !== interaction.user.id);
                db.saveGiveaway(interaction.message.id, g);

                const btn = new ButtonBuilder()
                    .setCustomId('btn_giveaway_join')
                    .setLabel(`🎉 เข้าร่วม (${g.entries.length})`)
                    .setStyle(ButtonStyle.Primary);

                await interaction.update({ components: [new ActionRowBuilder().addComponents(btn)] });
                return interaction.followUp({ content: '❌ คุณได้ยกเลิกการเข้าร่วมกิจกรรมนี้แล้ว', ephemeral: true });
            } else {
                g.entries.push(interaction.user.id);
                db.saveGiveaway(interaction.message.id, g);

                const btn = new ButtonBuilder()
                    .setCustomId('btn_giveaway_join')
                    .setLabel(`🎉 เข้าร่วม (${g.entries.length})`)
                    .setStyle(ButtonStyle.Primary);

                await interaction.update({ components: [new ActionRowBuilder().addComponents(btn)] });
                return interaction.followUp({ content: '🎉 คุณได้เข้าร่วมกิจกรรมแจกของเรียบร้อยแล้ว ขอให้โชคดี!', ephemeral: true });
            }
        }

        // --- ปุ่มยืนยันการลบ / Nuke ---
        const [action, type, targetId] = customId.split('_');
        if (action === 'cancel') {
            return interaction.update({ content: '🚫 ยกเลิกการทำงานเรียบร้อยแล้ว', embeds: [], components: [] });
        }

        if (action === 'confirm') {
            if (type === 'del') {
                const targetChannel = interaction.guild.channels.cache.get(targetId);
                if (!targetChannel) return interaction.update({ content: '❌ ไม่พบห้องดังกล่าว', embeds: [], components: [] });
                await interaction.update({ content: '⏳ กำลังลบห้อง...', embeds: [], components: [] });
                try {
                    await targetChannel.delete(`ลบโดย ${interaction.user.tag}`);
                } catch (error) {
                    return interaction.followUp({ content: `❌ ลบไม่สำเร็จ: ${error.message}`, ephemeral: true });
                }
            } else if (type === 'cat') {
                const category = interaction.guild.channels.cache.get(targetId);
                if (!category) return interaction.update({ content: '❌ ไม่พบหมวดหมู่ดังกล่าว', embeds: [], components: [] });
                await interaction.update({ content: '⏳ กำลังลบทุกห้องในหมวดหมู่นี้...', embeds: [], components: [] });
                try {
                    const childChannels = interaction.guild.channels.cache.filter(c => c.parentId === category.id);
                    for (const [, ch] of childChannels) {
                        await ch.delete(`Mass delete by ${interaction.user.tag}`).catch(() => {});
                    }
                    await category.delete(`Mass delete by ${interaction.user.tag}`).catch(() => {});
                    return interaction.followUp({ content: `✅ ลบหมวดหมู่และห้องย่อยเรียบร้อยแล้ว!`, ephemeral: true });
                } catch (error) {
                    return interaction.followUp({ content: `❌ ลบหมวดหมู่ไม่สำเร็จ: ${error.message}`, ephemeral: true });
                }
            } else if (type === 'nuke') {
                const targetChannel = interaction.guild.channels.cache.get(targetId);
                if (!targetChannel) return interaction.update({ content: '❌ ไม่พบห้องดังกล่าว', embeds: [], components: [] });
                await interaction.update({ content: '💣 กำลังล้างห้อง (Nuking)...', embeds: [], components: [] });
                try {
                    const position = targetChannel.position;
                    const clonedChannel = await targetChannel.clone({ reason: `Nuked by ${interaction.user.tag}` });
                    await clonedChannel.setPosition(position);
                    await targetChannel.delete(`Nuked by ${interaction.user.tag}`);

                    const nukeEmbed = new EmbedBuilder()
                        .setColor(0x57F287)
                        .setTitle('💣 ล้างห้องสำเร็จเรียบร้อย!')
                        .setDescription(`ห้องนี้ถูกล้างโดย <@${interaction.user.id}>\n✨ ข้อความทั้งหมดถูกเคลียร์สะอาดแล้ว`)
                        .setImage('https://media.giphy.com/media/oe33xf3B50fsc/giphy.gif')
                        .setTimestamp();

                    await clonedChannel.send({ embeds: [nukeEmbed] });
                } catch (error) {
                    return interaction.followUp({ content: `❌ ล้างห้องไม่สำเร็จ: ${error.message}`, ephemeral: true });
                }
            }
        }

        // --- Docomin Shop Interactive Buttons ---
        if (customId === 'btn_order_buy') {
            return interaction.showModal(docominShop.createBuyOrderModal());
        }

        if (customId === 'btn_order_inquiry') {
            return interaction.showModal(docominShop.createInquiryModal());
        }

        if (customId === 'btn_order_claim') {
            return interaction.showModal(docominShop.createClaimModal());
        }

        if (customId === 'btn_shop_catalog_open') {
            const products = db.getProducts(interaction.guildId);
            const embed = docominShop.createCatalogEmbed(products, 'all');
            const menu = docominShop.createCatalogSelectMenu(products);
            return interaction.reply({ embeds: [embed], components: [menu], ephemeral: true });
        }

        if (customId.startsWith('btn_ticket_qr_')) {
            const ticket = db.getOrderTicket(interaction.channelId);
            let amount = null;
            let note = null;

            if (ticket) {
                const products = db.getProducts(interaction.guildId);
                const itemQuery = (ticket.itemName || '').trim().toLowerCase();
                const foundProduct = products.find(p => 
                    p.id.toLowerCase() === itemQuery ||
                    p.name.toLowerCase().includes(itemQuery) ||
                    itemQuery.includes(p.name.toLowerCase()) ||
                    (itemQuery.includes('ไก่ตัน') && p.name.includes('ไก่ตัน')) ||
                    (itemQuery.includes('kitsune') && p.name.toLowerCase().includes('kitsune')) ||
                    (itemQuery.includes('dragon') && p.name.toLowerCase().includes('dragon')) ||
                    (itemQuery.includes('dough') && p.name.toLowerCase().includes('dough'))
                );

                const qty = parseInt(ticket.quantity) || 1;
                if (foundProduct && foundProduct.price) {
                    amount = foundProduct.price * qty;
                }
                note = `คำสั่งซื้อ: ${ticket.itemName || 'สินค้า'} (x${qty})`;
            }

            const embed = docominShop.createPaymentEmbed(interaction.guildId, amount, note);
            const row = docominShop.createPaymentActionRow(interaction.channelId);
            return interaction.reply({ embeds: [embed], components: [row] });
        }

        if (customId.startsWith('btn_pay_upload_slip')) {
            return interaction.reply({
                content: `📤 **วิธีแจ้งโอนเงิน / แนบสลิป:**\n1. ลากรูปภาพสลิป หรือ กดปุ่ม **\`+\`** ในช่องแชทเพื่ออัปโหลดรูปภาพสลิปลงในห้องนี้ได้เลยครับ\n2. บอทจะตรวจจับรูปสลิปอัตโนมัติและแจ้งเตือนแอดมินให้ทันทีครับ ✨`,
                ephemeral: true
            });
        }

        if (customId.startsWith('btn_pay_coupon_') || customId === 'btn_pay_coupon') {
            const channelId = customId.replace('btn_pay_coupon_', '') || interaction.channelId;
            return interaction.showModal(docominShop.createApplyCouponModal(channelId));
        }

        if (customId.startsWith('btn_pay_truemoney_angpao')) {
            return interaction.showModal(docominShop.createAngpaoModal());
        }

        if (customId.startsWith('btn_pay_call_staff')) {
            return interaction.reply({
                content: `🔔 <@${interaction.user.id}> ได้เรียกทีมงานแอดมินแล้ว! ทีมงานจะรีบเข้ามาตรวจสอบและตอบกลับโดยเร็วที่สุดครับ`
            });
        }

        if (customId.startsWith('btn_admin_deliver_')) {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ ปุ่มนี้สำหรับทีมงานแอดมินเท่านั้น', ephemeral: true });
            }
            const channelId = customId.replace('btn_admin_deliver_', '');
            const ticket = db.getOrderTicket(channelId);
            return interaction.showModal(docominShop.createDeliverProductModal(channelId, ticket));
        }

        if (customId.startsWith('btn_admin_reject_slip_')) {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ ปุ่มนี้สำหรับทีมงานแอดมินเท่านั้น', ephemeral: true });
            }
            const channelId = customId.replace('btn_admin_reject_slip_', '');
            const ticket = db.getOrderTicket(channelId);
            const buyerMention = ticket ? `<@${ticket.userId}>` : 'คุณลูกค้า';
            return interaction.reply({
                content: `⚠️ ${buyerMention} แอดมินตรวจสอบแล้วพบว่า **สลิปการโอนเงินหรือยอดเงินยังไม่ถูกต้อง**\nกรุณาตรวจสอบยอดเงิน และแนบภาพสลิปใหม่อีกครั้ง หรือพิมพ์สอบถามแอดมินในห้องนี้ได้เลยครับ`
            });
        }

        if (customId.startsWith('btn_customer_vouch_')) {
            const channelId = customId.replace('btn_customer_vouch_', '');
            const ticket = db.getOrderTicket(channelId);
            return interaction.showModal(docominShop.createVouchModal(interaction.client.user.id, ticket?.itemName || ''));
        }

        if (customId.startsWith('btn_ticket_done_')) {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ ปุ่มนี้สำหรับทีมงานแอดมินเท่านั้น', ephemeral: true });
            }
            const channelId = customId.replace('btn_ticket_done_', '');
            const ticket = db.getOrderTicket(channelId);
            return interaction.showModal(docominShop.createDeliverProductModal(channelId, ticket));
        }

        if (customId.startsWith('btn_ticket_transcript_')) {
            await interaction.deferReply();
            try {
                const fetched = await interaction.channel.messages.fetch({ limit: 100 });
                const sorted = Array.from(fetched.values()).reverse();
                let transcript = `=====================================================\n`;
                transcript += `DOCOMIN SHOP TICKET TRANSCRIPT\n`;
                transcript += `Channel: #${interaction.channel.name} (${interaction.channel.id})\n`;
                transcript += `Date: ${new Date().toISOString()}\n`;
                transcript += `=====================================================\n\n`;

                for (const m of sorted) {
                    const time = new Date(m.createdTimestamp).toLocaleString('th-TH');
                    transcript += `[${time}] ${m.author.tag}: ${m.cleanContent || (m.embeds.length ? '[Embed]' : '')}\n`;
                }

                const buffer = Buffer.from(transcript, 'utf-8');
                return interaction.editReply({
                    content: '📄 บันทึก Transcript การสนทนาทั้งหมดเรียบร้อยแล้ว:',
                    files: [{ attachment: buffer, name: `transcript-${interaction.channel.name}.txt` }]
                });
            } catch (err) {
                return interaction.editReply(`❌ ไม่สามารถสร้าง Transcript ได้: ${err.message}`);
            }
        }

        if (customId.startsWith('btn_ticket_close_')) {
            const channelId = customId.replace('btn_ticket_close_', '') || interaction.channelId;
            const ticket = db.getOrderTicket(channelId);
            db.closeOrderTicket(channelId);

            await interaction.reply('🔒 กำลังปิดตั๋ว ส่ง Transcript สรุปการสั่งซื้อ และจะลบห้องนี้ในอีก 5 วินาที...');

            try {
                const fetched = await interaction.channel.messages.fetch({ limit: 100 });
                const sorted = Array.from(fetched.values()).reverse();
                let transcript = `=====================================================\n`;
                transcript += `DOCOMIN SHOP TICKET TRANSCRIPT & RECEIPT\n`;
                transcript += `Ticket Channel: #${interaction.channel.name} (${interaction.channel.id})\n`;
                transcript += `Customer ID: ${ticket ? ticket.userId : 'Unknown'}\n`;
                transcript += `Date: ${new Date().toISOString()}\n`;
                transcript += `=====================================================\n\n`;

                for (const m of sorted) {
                    const time = new Date(m.createdTimestamp).toLocaleString('th-TH');
                    transcript += `[${time}] ${m.author.tag}: ${m.cleanContent || (m.embeds.length ? '[Embed Card]' : '')}\n`;
                }

                const buffer = Buffer.from(transcript, 'utf-8');
                const fileName = `transcript-${interaction.channel.name}.txt`;

                // ส่งเข้า DM ของลูกค้า
                if (ticket && ticket.userId) {
                    try {
                        const customerUser = await interaction.client.users.fetch(ticket.userId);
                        if (customerUser) {
                            await customerUser.send({
                                content: `📄 **สรุปบันทึกการสั่งซื้อ (Transcript) จาก Docomin Shop**\nขอบคุณที่ใช้บริการกับเราครับ! คุณสามารถเปิดไฟล์นี้เพื่อดูประวัติการสนทนาและหลักฐานการสั่งซื้อได้ตลอดเวลา ❤️`,
                                files: [{ attachment: buffer, name: fileName }]
                            });
                        }
                    } catch (dmE) {
                        // ignore closed DMs
                    }
                }

                // ส่งสำเนาเข้าห้อง Log ของเซิร์ฟเวอร์ถ้ามี
                const logChannelId = db.getSetting('logs_' + interaction.guildId);
                if (logChannelId) {
                    const logCh = interaction.guild.channels.cache.get(logChannelId);
                    if (logCh && logCh.isTextBased()) {
                        await logCh.send({
                            content: `📁 **เก็บบันทึกประวัติตั๋วที่ปิดแล้ว:** \`#${interaction.channel.name}\``,
                            files: [{ attachment: buffer, name: fileName }]
                        }).catch(() => {});
                    }
                }
            } catch (trErr) {
                console.error('Transcript auto-send error:', trErr.message);
            }

            setTimeout(async () => {
                const ch = interaction.guild.channels.cache.get(channelId);
                if (ch) {
                    await ch.delete('Order Ticket Closed & Archived').catch(() => {});
                }
            }, 5000);
            return;
        }
    }
});

// ตัวแปรเก็บประวัติข้อความสำหรับตรวจจับสแปม (Anti-Spam)
const spamTracker = new Map();

// ฟังก์ชันอัปเดตสถิติจำนวนสมาชิกสดบนห้องเสียง (Live Server Stats)
async function updateServerStats(guild) {
    try {
        const stats = db.getSetting('stats_' + guild.id);
        if (!stats) return;

        const totalCh = guild.channels.cache.get(stats.totalId);
        const humansCh = guild.channels.cache.get(stats.humansId);
        const botsCh = guild.channels.cache.get(stats.botsId);

        const total = guild.memberCount;
        const bots = guild.members.cache.filter(m => m.user.bot).size;
        const humans = Math.max(0, total - bots);

        if (totalCh) await totalCh.setName(`📊 สมาชิก: ${total}`).catch(() => {});
        if (humansCh) await humansCh.setName(`👤 ผู้ใช้: ${humans}`).catch(() => {});
        if (botsCh) await botsCh.setName(`🤖 บอท: ${bots}`).catch(() => {});
    } catch (e) {
        // ignore errors
    }
}

// จัดการ Prefix Commands & Event Messages
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    // --- ระบบตรวจจับสลิปโอนเงินอัตโนมัติในห้องตั๋ว (Order Ticket Slip Auto-Detection) ---
    const orderTicket = db.getOrderTicket(message.channel.id);
    if (orderTicket && orderTicket.status === 'open' && message.attachments.size > 0) {
        const imageAtt = message.attachments.find(a =>
            a.contentType?.startsWith('image/') ||
            /\.(png|jpe?g|webp)$/i.test(a.name || '')
        );

        if (imageAtt) {
            const slipNoticeEmbed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle('📥 ได้รับหลักฐานการโอนเงิน (สลิป) เรียบร้อยแล้ว!')
                .setDescription(`ขอบคุณ <@${message.author.id}> สำหรับหลักฐานการโอนเงิน!\nทีมงานแอดมินได้รับแจ้งเตือนแล้ว และกำลังตรวจสอบยอดเงินในระบบ...`)
                .setImage(imageAtt.url)
                .addFields(
                    { name: '📦 รายการสั่งซื้อ', value: `\`${orderTicket.itemName || 'สินค้า'}\` (จำนวน: ${orderTicket.quantity || 1})`, inline: true },
                    { name: '💳 สถานะ', value: '⏳ **รอแอดมินตรวจสอบยอดเงิน**', inline: true }
                )
                .setFooter({ text: 'Docomin Shop Auto-Slip Detection • ส่งมอบไว 100%' })
                .setTimestamp();

            const adminActionRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`btn_admin_deliver_${message.channel.id}`)
                    .setLabel('✅ ยืนยันยอด & ส่งมอบสินค้า')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅'),
                new ButtonBuilder()
                    .setCustomId(`btn_admin_reject_slip_${message.channel.id}`)
                    .setLabel('❌ สลิปไม่ถูกต้อง')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('❌')
            );

            await message.channel.send({
                content: `🔔 แจ้งเตือนแอดมิน: มีการแนบสลิปชำระเงินใหม่ในห้องนี้ครับ!`,
                embeds: [slipNoticeEmbed],
                components: [adminActionRow]
            }).catch(console.error);
        }
    }

    // --- 1. ระบบ Auto-Mod (ตรวจจับลิงก์เชิญ & ป้องกันสแปม) ---
    const isModOrAdmin = message.member && (
        message.member.permissions.has(PermissionFlagsBits.ManageMessages) ||
        message.member.permissions.has(PermissionFlagsBits.Administrator)
    );

    if (!isModOrAdmin) {
        const autoModConfig = db.getAutoMod(message.guild.id);

        // Anti-Invite
        if (autoModConfig.antiInvite) {
            const inviteRegex = /(discord\.(gg|io|me|li)|discordapp\.com\/invite|discord\.com\/invite)\/[a-zA-Z0-9]+/i;
            if (inviteRegex.test(message.content)) {
                await message.delete().catch(() => {});
                const warnMsg = await message.channel.send(`⚠️ <@${message.author.id}> ไม่อนุญาตให้ส่งลิงก์เชิญ Discord ในเซิร์ฟเวอร์นี้! *(ระบบ Auto-Mod)*`).catch(() => null);
                if (warnMsg) setTimeout(() => warnMsg.delete().catch(() => {}), 5000);
                return;
            }
        }

        // Anti-Spam
        if (autoModConfig.antiSpam) {
            const now = Date.now();
            const userHistory = spamTracker.get(message.author.id) || [];
            const recentMsgs = userHistory.filter(t => now - t < 3000);
            recentMsgs.push(now);
            spamTracker.set(message.author.id, recentMsgs);

            if (recentMsgs.length >= 5) {
                spamTracker.delete(message.author.id);
                await message.delete().catch(() => {});
                if (message.member && message.member.moderatable) {
                    await message.member.timeout(60 * 1000, 'AutoMod: ส่งข้อความรัวเกินไป (Spam Flood)').catch(() => {});
                }
                const spamNotice = await message.channel.send(`⚡ <@${message.author.id}> คุณพิมพ์ข้อความรัวเกินไป! ถูกระงับการพิมพ์ชั่วคราว 1 นาที *(Anti-Spam)*`).catch(() => null);
                if (spamNotice) setTimeout(() => spamNotice.delete().catch(() => {}), 6000);
                return;
            }
        }
    }

    // --- 2. ระบบ AFK ---
    // ตรวจสอบว่าผู้พิมพ์กำลังอยู่ในสถานะ AFK หรือไม่ (ถ้าใช่ ให้ปลดสถานะ)
    const authorAfk = db.removeAfk(message.author.id);
    if (authorAfk) {
        const durationMs = Date.now() - authorAfk.timestamp;
        const mins = Math.floor(durationMs / 60000);
        const secs = Math.floor((durationMs % 60000) / 1000);
        const timeStr = mins > 0 ? `${mins} นาที ${secs} วินาที` : `${secs} วินาที`;
        message.reply(`👋 ยินดีต้อนรับกลับ <@${message.author.id}>! บอทได้ปลดสถานะ AFK ให้แล้ว *(คุณไม่อยู่ไป ${timeStr})*`).then(m => setTimeout(() => m.delete().catch(() => {}), 7000)).catch(() => {});
    }

    // ตรวจสอบว่าข้อความนี้มีการกล่าวถึง (Mention) สมาชิกที่กำลัง AFK หรือไม่
    if (message.mentions.users.size > 0) {
        for (const [userId, targetUser] of message.mentions.users) {
            if (userId === message.author.id || targetUser.bot) continue;
            const targetAfk = db.getAfk(userId);
            if (targetAfk) {
                const durationMs = Date.now() - targetAfk.timestamp;
                const mins = Math.floor(durationMs / 60000);
                const timeStr = mins > 60 ? `${Math.floor(mins / 60)} ชม. ${mins % 60} นาที` : `${mins} นาที`;
                message.reply(`💤 **${targetUser.username}** กำลังอยู่ในสถานะ AFK: *"${targetAfk.reason}"* *(ไม่อยู่มาแล้ว ${timeStr})*`).then(m => setTimeout(() => m.delete().catch(() => {}), 8000)).catch(() => {});
            }
        }
    }

    // --- 3. ระบบสะสม EXP และเลเวล (Leveling System) ---
    const xpCooldown = 60 * 1000;
    const userLevelData = db.getUserLevel(message.guild.id, message.author.id);
    const now = Date.now();
    if (!userLevelData.lastXpTime || (now - userLevelData.lastXpTime) >= xpCooldown) {
        const xpToAdd = Math.floor(Math.random() * 11) + 15; // 15 - 25 XP
        const result = db.addXp(message.guild.id, message.author.id, xpToAdd);
        if (result.leveledUp) {
            const levelUpEmbed = new EmbedBuilder()
                .setColor(0x57F287)
                .setAuthor({ name: `LEVEL UP! เลเวลอัปแล้ว 🎉`, iconURL: message.author.displayAvatarURL() })
                .setDescription(`ยินดีด้วย <@${message.author.id}>! คุณเลเวลอัปเป็น **Level ${result.newLevel}** แล้ว 🆙✨\nแชทต่อเพื่อปลดล็อกอันดับสูงสุด!`)
                .setTimestamp();
            message.channel.send({ embeds: [levelUpEmbed] }).then(m => setTimeout(() => m.delete().catch(() => {}), 10000)).catch(() => {});
        }
    }

    // เช็คกรณีคน Mention บอท เพื่อถามคำถามหรือสั่งงาน AI จัดการเซิร์ฟเวอร์
    if (message.mentions.has(client.user) && !message.mentions.everyone) {
        const cleanPrompt = message.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
        if (cleanPrompt) {
            const typingMsg = await message.reply('🤔 กำลังประมวลผลคำสั่งสักครู่...').catch(() => null);
            try {
                if (isModOrAdmin) {
                    const aiResult = await executeAiServerManagement(client, message.guild, message.member, message.channel, cleanPrompt);
                    const embed = new EmbedBuilder()
                        .setColor(aiResult.success ? 0x5865F2 : 0xED4245)
                        .setTitle('🤖 ผลการสั่งการ Gemini AI Admin')
                        .setDescription(`🧠 **วิเคราะห์:** ${aiResult.thought}\n⚡ **การกระทำ:** \`${aiResult.action}\`\n\n${aiResult.summary}`)
                        .setFooter({ text: 'Docomin AI Server Manager • Zero Demo' })
                        .setTimestamp();
                    return typingMsg ? typingMsg.edit({ content: null, embeds: [embed] }) : message.reply({ embeds: [embed] });
                } else {
                    const answer = await askGemini(cleanPrompt);
                    const embed = new EmbedBuilder()
                        .setColor(0x4285F4)
                        .setTitle('✨ Gemini AI')
                        .setDescription(answer.length > 4000 ? answer.substring(0, 3995) + '...' : answer)
                        .setFooter({ text: 'Google Gemini Assistant' });
                    return typingMsg ? typingMsg.edit({ content: null, embeds: [embed] }) : message.reply({ embeds: [embed] });
                }
            } catch (err) {
                if (typingMsg) return typingMsg.edit(`❌ เกิดข้อผิดพลาดจาก AI: ${err.message}`);
            }
        }
    }

    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // !ask <คำถาม>
    if (command === 'ask' || command === 'ai') {
        const prompt = args.join(' ');
        if (!prompt) return message.reply('⚠️ กรุณาระบุคำถามที่ต้องการถาม AI เช่น: `!ask สอนทำสเต๊กเนื้อหน่อย`');

        const waitMsg = await message.reply('🤔 กำลังปรึกษา Gemini AI...');
        try {
            const answer = await askGemini(prompt);
            const embed = new EmbedBuilder()
                .setColor(0x4285F4)
                .setTitle('✨ คำตอบจาก Gemini AI')
                .setDescription(answer.length > 4000 ? answer.substring(0, 3995) + '...' : answer)
                .setFooter({ text: 'Google Gemini 3.8 Flash' });
            return waitMsg.edit({ content: null, embeds: [embed] });
        } catch (err) {
            return waitMsg.edit(`❌ เกิดข้อผิดพลาด: ${err.message}`);
        }
    }

    // !play <เพลง> หรือ !p <เพลง>
    if (command === 'play' || command === 'p') {
        const query = args.join(' ');
        if (!query) {
            return message.reply(`⚠️ กรุณาระบุชื่อเพลงหรือลิงก์ เช่น: \`${PREFIX}play lofi girl\``);
        }

        const fakeInteraction = {
            member: message.member,
            user: message.author,
            guildId: message.guild.id,
            channel: message.channel,
            client: message.client,
            deferred: false,
            replied: false,
            deferReply: async () => {},
            editReply: async (data) => message.channel.send(data),
            reply: async (data) => message.reply(data)
        };
        return music.executePlay(fakeInteraction, query);
    }

    // !panel
    if (command === 'panel' || command === 'music') {
        return music.sendMusicPanel(message.channel);
    }

    // !skip หรือ !s
    if (command === 'skip' || command === 's') {
        const ok = music.skip(message.guild.id);
        return message.reply(ok ? '⏭️ ข้ามเพลงเรียบร้อยแล้ว!' : '❌ ไม่มีเพลงที่กำลังเล่นอยู่');
    }

    // !stop
    if (command === 'stop') {
        const ok = music.stop(message.guild.id);
        return message.reply(ok ? '⏹️ หยุดเล่นเพลง ล้างคิว และออกจากห้องเสียงเรียบร้อยแล้ว' : '❌ บอทไม่ได้กำลังเล่นเพลงอยู่');
    }

    // !pause / !resume
    if (command === 'pause' || command === 'resume') {
        const state = music.pauseOrResume(message.guild.id);
        if (!state) return message.reply('❌ ไม่มีเพลงที่กำลังเล่นอยู่');
        return message.reply(state === 'paused' ? '⏸️ หยุดเพลงชั่วคราวแล้ว' : '▶️ เล่นเพลงต่อแล้ว');
    }

    // !queue หรือ !q
    if (command === 'queue' || command === 'q') {
        const q = music.getQueue(message.guild.id);
        if (!q || q.songs.length === 0) return message.reply('📜 ขณะนี้ไม่มีคิวเพลงในระบบ');
        const upcoming = q.songs.slice(0, 10).map((s, idx) => `${idx === 0 ? '▶️' : `${idx + 1}.`} ${s.title} (${s.durationRaw})`).join('\n');
        return message.reply(`📜 **รายการคิวเพลง:**\n\`\`\`\n${upcoming}\n\`\`\``);
    }

    // !daily
    if (command === 'daily') {
        const user = db.getUser(message.author.id);
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;

        if (user.lastDaily && (now - user.lastDaily) < oneDay) {
            const nextClaim = Math.floor((user.lastDaily + oneDay) / 1000);
            return message.reply(`⏳ คุณได้รับเหรียญประจำวันไปแล้ว! มารับได้อีกครั้ง <t:${nextClaim}:R>`);
        }

        const reward = Math.floor(Math.random() * 401) + 100;
        user.coins = (user.coins || 0) + reward;
        user.lastDaily = now;
        db.updateUser(message.author.id, { coins: user.coins, lastDaily: now });

        return message.reply(`💰 เช็กอินสำเร็จ! คุณได้รับ **+${reward.toLocaleString()}** 🪙 (ยอดรวม: **${user.coins.toLocaleString()}** 🪙)`);
    }

    // !bal
    if (command === 'bal' || command === 'balance') {
        const target = message.mentions.users.first() || message.author;
        const data = db.getUser(target.id);
        return message.reply(`👛 **${target.username}** มีเหรียญคงเหลือ: **${(data.coins || 0).toLocaleString()}** 🪙`);
    }

    // !clear <amount>
    if (command === 'clear' || command === 'purge') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return message.reply('❌ คุณไม่มีสิทธิ์ (Manage Messages)');
        }

        const amount = parseInt(args[0]);
        if (isNaN(amount) || amount < 1 || amount > 1000) {
            return message.reply(`⚠️ กรุณาระบุจำนวนข้อความระหว่าง 1 ถึง 1,000 เช่น: \`${PREFIX}clear 200\``);
        }

        const targetUser = message.mentions.users.first() || null;
        await message.delete().catch(() => {});

        const statusMsg = await message.channel.send(`⏳ กำลังเริ่มลบข้อความ **${amount}** ข้อความ...`);
        try {
            const { totalDeleted, hitOldMessages } = await massDeleteMessages(
                message.channel,
                amount,
                targetUser,
                async (cur, tot) => {
                    await statusMsg.edit(`⏳ กำลังลบข้อความ... **${cur}** / **${tot}** ข้อความ`).catch(() => {});
                }
            );

            let reply = `🧹 ลบข้อความเรียบร้อยแล้ว **${totalDeleted}** ข้อความ!`;
            if (targetUser) reply += ` (เฉพาะของ <@${targetUser.id}>)`;
            if (hitOldMessages) reply += `\n⚠️ *(หยุดเนื่องจากพบข้อความที่อายุเกิน 14 วัน)*`;

            await statusMsg.edit(reply);
            setTimeout(() => statusMsg.delete().catch(() => {}), 6000);
        } catch (error) {
            return message.channel.send(`❌ ลบข้อความผิดพลาด: ${error.message}`);
        }
    }

    // !nuke
    if (command === 'nuke') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return message.reply('❌ คุณไม่มีสิทธิ์ (Manage Channels)');
        }
        const confirmBtn = new ButtonBuilder().setCustomId(`confirm_nuke_${message.channel.id}`).setLabel('ยืนยันการล้างห้อง (Nuke)').setStyle(ButtonStyle.Danger);
        const cancelBtn = new ButtonBuilder().setCustomId(`cancel_nuke_${message.channel.id}`).setLabel('ยกเลิก').setStyle(ButtonStyle.Secondary);
        const row = new ActionRowBuilder().addComponents(confirmBtn, cancelBtn);

        const embed = new EmbedBuilder()
            .setColor(0xFF8800)
            .setTitle('💥 ยืนยันการล้างห้อง (Nuke Channel)')
            .setDescription(`ระบบจะลบห้อง **${message.channel.name}** นี้ทิ้ง และโคลนห้องใหม่สะอาดหมดจดขึ้นมาทันที!`);

        return message.reply({ embeds: [embed], components: [row] });
    }

    // !help
    if (command === 'help') {
        return message.reply(`📖 พิมพ์ \`/help\` หรือพิมพ์คำสั่ง Slash \`/\` เพื่อดูและใช้คำสั่งทั้งหมดของบอทได้เลยครับ!`);
    }
});

// --- ระบบต้อนรับสมาชิกใหม่ และ Auto-Role (guildMemberAdd) ---
client.on('guildMemberAdd', async member => {
    try {
        const guild = member.guild;

        // 1. ให้ยศอัตโนมัติ (Auto-Role)
        const autoRoleId = db.getSetting('autorole_' + guild.id);
        if (autoRoleId) {
            const role = guild.roles.cache.get(autoRoleId);
            if (role) {
                await member.roles.add(role).catch(err => console.error('Failed to add autorole:', err.message));
            }
        }

        // 2. ส่งการ์ดต้อนรับ (Welcome Card)
        const welcomeChannelId = db.getSetting('welcome_' + guild.id);
        if (welcomeChannelId) {
            const channel = guild.channels.cache.get(welcomeChannelId);
            if (channel && channel.isTextBased()) {
                const welcomeEmbed = new EmbedBuilder()
                    .setColor(0x57F287)
                    .setTitle(`🎉 ยินดีต้อนรับสู่ ${guild.name}!`)
                    .setDescription(`สวัสดีคุณ <@${member.id}> ยินดีต้อนรับเข้าสู่เซิร์ฟเวอร์ของเรา!\nคุณเป็นสมาชิกคนที่ **#${guild.memberCount}** ของเซิร์ฟเวอร์`)
                    .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
                    .addFields(
                        { name: '👤 ชื่อผู้ใช้', value: member.user.tag, inline: true },
                        { name: '📅 วันที่สร้างบัญชี', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true }
                    )
                    .setFooter({ text: `ยินดีต้อนรับสมาชิกใหม่!`, iconURL: guild.iconURL() })
                    .setTimestamp();

                await channel.send({ content: `👋 ยินดีต้อนรับ <@${member.id}> มาร่วมสนุกไปด้วยกัน!`, embeds: [welcomeEmbed] }).catch(() => {});
            }
        }

        // 3. อัปเดตสถิติเซิร์ฟเวอร์สด
        updateServerStats(guild);
    } catch (err) {
        console.error('Error in guildMemberAdd:', err);
    }
});

// --- ระบบแจ้งเตือนเมื่อสมาชิกออกจากเซิร์ฟเวอร์ (guildMemberRemove) ---
client.on('guildMemberRemove', async member => {
    try {
        const guild = member.guild;
        const welcomeChannelId = db.getSetting('welcome_' + guild.id);
        if (welcomeChannelId) {
            const channel = guild.channels.cache.get(welcomeChannelId);
            if (channel && channel.isTextBased()) {
                const leaveEmbed = new EmbedBuilder()
                    .setColor(0xED4245)
                    .setTitle(`👋 สมาชิกออกจากเซิร์ฟเวอร์`)
                    .setDescription(`**${member.user.tag}** ได้ออกจากเซิร์ฟเวอร์ไปแล้ว\nขณะนี้เหลือสมาชิกทั้งหมด **${guild.memberCount}** คน`)
                    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                    .setTimestamp();

                await channel.send({ embeds: [leaveEmbed] }).catch(() => {});
            }
        }

        // อัปเดตสถิติเซิร์ฟเวอร์สด
        updateServerStats(guild);
    } catch (err) {
        console.error('Error in guildMemberRemove:', err);
    }
});

// --- ระบบบันทึกประวัติการกระทำ (Mod / Audit Logs) ---
client.on('messageDelete', async message => {
    try {
        if (!message.guild || message.author?.bot) return;
        const logChannelId = db.getSetting('logs_' + message.guild.id);
        if (!logChannelId) return;

        const logChannel = message.guild.channels.cache.get(logChannelId);
        if (!logChannel || !logChannel.isTextBased()) return;

        const embed = new EmbedBuilder()
            .setColor(0xED4245)
            .setAuthor({ name: `${message.author?.tag || 'ไม่ทราบผู้ใช้'} • ลบข้อความ`, iconURL: message.author?.displayAvatarURL() })
            .setDescription(`🗑️ **ข้อความถูกลบในห้อง <#${message.channel.id}>**\n\`\`\`\n${message.content || '*(ไม่มีเนื้อหาตัวอักษร เช่น รูปภาพ/Embed)*'}\`\`\``)
            .setFooter({ text: `User ID: ${message.author?.id || 'Unknown'}` })
            .setTimestamp();

        await logChannel.send({ embeds: [embed] }).catch(() => {});
    } catch (e) {
        // ignore
    }
});

client.on('messageUpdate', async (oldMessage, newMessage) => {
    try {
        if (!oldMessage.guild || oldMessage.author?.bot) return;
        if (oldMessage.content === newMessage.content) return;
        const logChannelId = db.getSetting('logs_' + oldMessage.guild.id);
        if (!logChannelId) return;

        const logChannel = oldMessage.guild.channels.cache.get(logChannelId);
        if (!logChannel || !logChannel.isTextBased()) return;

        const embed = new EmbedBuilder()
            .setColor(0xFEE75C)
            .setAuthor({ name: `${oldMessage.author.tag} • แก้ไขข้อความ`, iconURL: oldMessage.author.displayAvatarURL() })
            .setDescription(`✏️ **แก้ไขข้อความในห้อง <#${oldMessage.channel.id}>** ([ไปที่ข้อความ](${newMessage.url}))`)
            .addFields(
                { name: 'ข้อความเดิม', value: `\`\`\`\n${oldMessage.content ? oldMessage.content.slice(0, 1000) : '*(ว่าง)*'}\n\`\`\`` },
                { name: 'ข้อความใหม่', value: `\`\`\`\n${newMessage.content ? newMessage.content.slice(0, 1000) : '*(ว่าง)*'}\n\`\`\`` }
            )
            .setFooter({ text: `User ID: ${oldMessage.author.id}` })
            .setTimestamp();

        await logChannel.send({ embeds: [embed] }).catch(() => {});
    } catch (e) {
        // ignore
    }
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    try {
        await voicemaster.handleVoiceStateUpdate(oldState, newState, client);
        const guild = newState.guild || oldState.guild;
        const logChannelId = db.getSetting('logs_' + guild.id);
        if (!logChannelId) return;

        const logChannel = guild.channels.cache.get(logChannelId);
        if (!logChannel || !logChannel.isTextBased()) return;

        const member = newState.member || oldState.member;
        if (!member || member.user.bot) return;

        let desc = null;
        let color = 0x5865F2;

        if (!oldState.channelId && newState.channelId) {
            desc = `🔊 <@${member.id}> **เข้าห้องเสียง** <#${newState.channelId}>`;
            color = 0x57F287;
        } else if (oldState.channelId && !newState.channelId) {
            desc = `🔇 <@${member.id}> **ออกจากห้องเสียง** <#${oldState.channelId}>`;
            color = 0xED4245;
        } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
            desc = `🔄 <@${member.id}> **ย้ายห้องเสียง** จาก <#${oldState.channelId}> ➡️ <#${newState.channelId}>`;
            color = 0x3498DB;
        }

        if (desc) {
            const embed = new EmbedBuilder()
                .setColor(color)
                .setDescription(desc)
                .setTimestamp();
            await logChannel.send({ embeds: [embed] }).catch(() => {});
        }
    } catch (e) {
        // ignore
    }
});

client.on('error', error => console.error('❌ Client Error:', error));
process.on('unhandledRejection', error => console.error('❌ Unhandled Promise Rejection:', error));

console.log('🔄 กำลังเชื่อมต่อไปยัง Discord...');
client.login(TOKEN).then(() => {
    console.log('🔑 เข้าสู่ระบบสำเร็จ กำลังรอรับสถานะ Ready...');
}).catch(err => {
    console.error('❌ เข้าสู่ระบบไม่สำเร็จ:', err);
});
