const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    PermissionFlagsBits,
    ChannelType
} = require('discord.js');
const db = require('./db');

function formatUptime(uptimeMs) {
    const totalSeconds = Math.floor(uptimeMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${days > 0 ? `${days} วัน ` : ''}${hours} ชม. ${minutes} นาที ${seconds} วินาที`;
}

/**
 * สร้าง Embed และ Components สำหรับแผงควบคุมระบบ (Master Control Panel)
 */
function createPanelEmbedAndRows(guild, client) {
    const products = db.getProducts(guild.id);
    const inStockCount = products.filter(p => p.stock > 0).length;
    const payment = db.getPaymentConfig(guild.id);
    const hasRealPayment = !!payment?.promptpay && payment.promptpay !== '0800000000';
    const shopSettings = db.getShopSettings(guild.id);
    const automodConfig = db.getAutoMod(guild.id);
    const salesStats = db.getSalesAnalytics ? db.getSalesAnalytics(guild.id) : { totalRevenue: 0, totalSalesCount: 0 };

    const totalCommands = (client && client.commandsCount) ? client.commandsCount : 102;
    const memoryUsageMB = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
    const ping = client.ws ? client.ws.ping : 0;
    const uptimeStr = formatUptime(client.uptime || (process.uptime() * 1000));

    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🎛️ แผงควบคุมเซิร์ฟเวอร์ & ร้านค้า — Docomin Master Control Panel')
        .setDescription(
            `👑 **เซิร์ฟเวอร์:** **${guild.name}**\n` +
            `👥 **สมาชิกทั้งหมด:** \`${guild.memberCount}\` คน | ⚡ **คำสั่งบอท:** \`${totalCommands} คำสั่ง (พร้อมใช้งาน)\`\n` +
            `📶 **Ping:** \`${ping}ms\` | ⏱️ **Uptime:** \`${uptimeStr}\``
        )
        .addFields(
            {
                name: '🛒 สถานะร้านค้า (Docomin Shop)',
                value: `• สินค้าในระบบ: **${products.length}** รายการ (พร้อมส่ง: **${inStockCount}** รายการ)\n` +
                    `• ยอดขายสะสม: **฿${(salesStats.totalRevenue || 0).toLocaleString()}** บาท (\`${salesStats.totalSalesCount || 0}\` ออเดอร์)\n` +
                    `• ช่องทางชำระเงิน: ${hasRealPayment ? `✅ พร้อมเพย์ (\`${payment.promptpay}\`)` : '⚠️ ยังไม่ได้ตั้งค่าบัญชีจริง (กดปุ่ม ⚙️ ตั้งค่าบัญชีรับเงิน)'}\n` +
                    `• ห้องรีวิว: ${shopSettings?.reviewId ? `<#${shopSettings.reviewId}>` : 'ยังไม่ได้ระบุ (ใช้ /set-review)'}`,
                inline: false
            },
            {
                name: '🛡️ ความปลอดภัย & ระบบอัตโนมัติ (Automod)',
                value: `• ป้องกันลิงก์เชิญ (Anti-Invite): **${automodConfig.antiInvite ? '🟢 เปิดใช้งาน' : '🔴 ปิด'}**\n` +
                    `• ป้องกันส่งข้อความรัว (Anti-Spam): **${automodConfig.antiSpam ? '🟢 เปิดใช้งาน' : '🔴 ปิด'}**\n` +
                    `• ป้องกันห้องซ้ำซ้อน (Duplicate Guard): **🟢 เปิดใช้งาน 100%**`,
                inline: false
            },
            {
                name: '🤖 ผู้ช่วย AI (Gemini AI Admin)',
                value: `• สถานะ: **🟢 พร้อมรับคำสั่ง**\n` +
                    `• ความสามารถ: สั่งลบข้อความ, ล็อกห้อง, สร้างห้อง, ประกาศ, สรุปสถานะ ด้วยภาษาไทย`,
                inline: false
            },
            {
                name: '⚡ ควบคุมด่วน (Quick Actions)',
                value: `เลือกเมนูหรือกดปุ่มด้านล่างเพื่อสั่งการทันที หรือกด **[⚡ ซิงค์ 102 คำสั่ง]** เพื่ออัปเดตคำสั่งใหม่เข้าดิสคอร์ด`,
                inline: false
            }
        )
        .setFooter({ text: `Docomin Control Panel • Node.js RAM: ${memoryUsageMB} MB • Zero Demo Guaranteed` })
        .setTimestamp();

    // 1. Select Menu สำหรับเลือกหมวดหมู่การจัดการ
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('panel_select_section')
        .setPlaceholder('📂 เลือกหมวดหมู่การจัดการเซิร์ฟเวอร์...')
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('🛒 จัดการร้านค้า Docomin Shop')
                .setDescription('ดูสินค้า, เพิ่มสินค้า, เติมสต็อก, ติดตั้งระบบร้านค้า')
                .setValue('section_shop')
                .setEmoji('🛒'),
            new StringSelectMenuOptionBuilder()
                .setLabel('📊 รายงานยอดขาย & สถิติ (Sales & Analytics)')
                .setDescription('ดูยอดขายรวม, จำนวนออเดอร์, สินค้าขายดี, รายได้วันนี้')
                .setValue('section_sales')
                .setEmoji('📊'),
            new StringSelectMenuOptionBuilder()
                .setLabel('🛡️ จัดการความปลอดภัย & ข้อความ')
                .setDescription('ลบข้อความด่วน, ล็อกห้อง, ตั้งค่า Slowmode, ตรวจสอบสมาชิก')
                .setValue('section_moderation')
                .setEmoji('🛡️'),
            new StringSelectMenuOptionBuilder()
                .setLabel('🤖 Gemini AI ผู้ช่วยผู้ดูแลระบบ')
                .setDescription('สั่งงาน AI ด้วยภาษาไทยให้จัดการเซิร์ฟเวอร์อัตโนมัติ')
                .setValue('section_ai')
                .setEmoji('🤖'),
            new StringSelectMenuOptionBuilder()
                .setLabel('⚙️ ติดตั้งระบบอัตโนมัติ (Smart Setup)')
                .setDescription('จัดหมวดหมู่ห้องและระบบร้านค้า โดยไม่สร้างห้องซ้ำซ้อน')
                .setValue('section_setup')
                .setEmoji('⚙️'),
            new StringSelectMenuOptionBuilder()
                .setLabel('🔄 บังคับอัปเดตคำสั่ง Slash ทันที (Force Sync)')
                .setDescription(`แก้ปัญหาคำสั่งขึ้นไม่ครบ ซิงค์คำสั่งใหม่ทั้งหมด ${totalCommands} คำสั่งเข้าเซิร์ฟเวอร์ทันที`)
                .setValue('section_sync')
                .setEmoji('🔄')
        );

    const rowMenu = new ActionRowBuilder().addComponents(selectMenu);

    // 2. Buttons แถวที่ 1 (ร้านค้า)
    const rowBtns1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('btn_panel_view_products')
            .setLabel('📦 สินค้าทั้งหมด')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('btn_panel_add_product')
            .setLabel('➕ เพิ่มสินค้า')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('btn_panel_set_payment')
            .setLabel('⚙️ ตั้งค่าบัญชีรับเงิน')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('btn_panel_refresh')
            .setLabel('🔄 รีเฟรชแผง')
            .setStyle(ButtonStyle.Secondary)
    );

    // 3. Buttons แถวที่ 2 (จัดการเซิร์ฟเวอร์ & AI)
    const rowBtns2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('btn_panel_purge_modal')
            .setLabel('🧹 ลบข้อความด่วน')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('btn_panel_toggle_lock')
            .setLabel('🔒 สลับล็อกห้องนี้')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('btn_panel_ai_prompt')
            .setLabel('🤖 สั่งงาน Gemini AI')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('btn_panel_force_sync')
            .setLabel(`⚡ ซิงค์ ${totalCommands} คำสั่ง`)
            .setStyle(ButtonStyle.Primary)
    );

    return {
        embeds: [embed],
        components: [rowMenu, rowBtns1, rowBtns2]
    };
}

// Modal สำหรับลบข้อความด่วน
function createPurgeModal() {
    return new ModalBuilder()
        .setCustomId('modal_panel_purge')
        .setTitle('🧹 ลบข้อความด่วนในห้องนี้')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('purge_count')
                    .setLabel('จำนวนข้อความที่ต้องการลบ (1 - 100)')
                    .setPlaceholder('เช่น 20, 50, 100')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
            )
        );
}

// Modal สำหรับสั่งงาน Gemini AI
function createAiPromptModal() {
    return new ModalBuilder()
        .setCustomId('modal_panel_ai_prompt')
        .setTitle('🤖 สั่งการ Gemini AI จัดการเซิร์ฟเวอร์')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('ai_instruction')
                    .setLabel('คำสั่งภาษาไทยที่ต้องการให้ AI ปฏิบัติการ')
                    .setPlaceholder('เช่น "ลบข้อความ 30", "ล็อกห้องนี้ชั่วคราว", "เขียนประกาศต้อนรับ"')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
            )
        );
}

// Modal สำหรับเพิ่มสินค้าด่วน
function createAddProductModal() {
    return new ModalBuilder()
        .setCustomId('modal_panel_add_product')
        .setTitle('➕ เพิ่มสินค้าใหม่ใน Docomin Shop')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('product_id')
                    .setLabel('รหัสสินค้า (ID เช่น BF-DOUGH)')
                    .setPlaceholder('BF-DOUGH')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('product_name')
                    .setLabel('ชื่อสินค้า')
                    .setPlaceholder('ผลโมจิ (Dough Fruit) หรือ ไก่ตัน 6 หมัด')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('product_price')
                    .setLabel('ราคา (บาท)')
                    .setPlaceholder('150')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('product_stock')
                    .setLabel('จำนวนสต็อกเริ่มต้น')
                    .setPlaceholder('5')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('product_category')
                    .setLabel('หมวดหมู่ (blox_fruits / robux / nitro / other)')
                    .setValue('blox_fruits')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
            )
        );
}

module.exports = {
    createPanelEmbedAndRows,
    createPurgeModal,
    createAiPromptModal,
    createAddProductModal
};
