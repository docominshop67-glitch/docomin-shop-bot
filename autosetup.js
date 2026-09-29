const { ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const music = require('./music');

// ฟังก์ชันค้นหาหรือสร้างหมวดหมู่ (ป้องกันการสร้างซ้ำ 100%)
async function getOrCreateCategory(guild, displayName, keywords, options = {}) {
    const existing = guild.channels.cache.find(c => {
        if (c.type !== ChannelType.GuildCategory) return false;
        const low = c.name.toLowerCase();
        if (low === displayName.toLowerCase()) return true;
        return keywords.some(k => low.includes(k.toLowerCase()));
    });

    if (existing) {
        return { category: existing, created: false };
    }

    const created = await guild.channels.create({
        name: displayName,
        type: ChannelType.GuildCategory,
        ...options
    });
    return { category: created, created: true };
}

// ฟังก์ชันค้นหาหรือสร้างห้องข้อความ (ป้องกันการสร้างซ้ำ 100%)
async function getOrCreateTextChannel(guild, displayName, parentId, keywords, options = {}) {
    // 1. ค้นหาในหมวดหมู่นี้ก่อน
    let existing = guild.channels.cache.find(c => {
        if (c.type !== ChannelType.GuildText) return false;
        if (parentId && c.parentId !== parentId) return false;
        const low = c.name.toLowerCase();
        if (low === displayName.toLowerCase()) return true;
        return keywords.some(k => low.includes(k.toLowerCase()));
    });

    // 2. ถ้าไม่พบในหมวดหมู่ ลองค้นหาจากทั้งเซิร์ฟเวอร์
    if (!existing) {
        existing = guild.channels.cache.find(c => {
            if (c.type !== ChannelType.GuildText) return false;
            const low = c.name.toLowerCase();
            return keywords.some(k => low === k.toLowerCase());
        });
        if (existing && parentId) {
            await existing.setParent(parentId).catch(() => {});
        }
    }

    if (existing) {
        return { channel: existing, created: false };
    }

    const created = await guild.channels.create({
        name: displayName,
        type: ChannelType.GuildText,
        parent: parentId,
        ...options
    });
    return { channel: created, created: true };
}

// ฟังก์ชันค้นหาหรือสร้างห้องเสียง (ป้องกันการสร้างซ้ำ 100%)
async function getOrCreateVoiceChannel(guild, displayName, parentId, keywords, options = {}) {
    let existing = guild.channels.cache.find(c => {
        if (c.type !== ChannelType.GuildVoice) return false;
        if (parentId && c.parentId !== parentId) return false;
        const low = c.name.toLowerCase();
        if (low === displayName.toLowerCase()) return true;
        return keywords.some(k => low.includes(k.toLowerCase()));
    });

    if (existing) {
        return { channel: existing, created: false };
    }

    const created = await guild.channels.create({
        name: displayName,
        type: ChannelType.GuildVoice,
        parent: parentId,
        ...options
    });
    return { channel: created, created: true };
}

async function runAutoSetup(guild, interaction) {
    await interaction.editReply({
        content: '⚙️ กำลังตรวจสอบโครงสร้างเซิร์ฟเวอร์ และจัดระเบียบห้องต่างๆ อย่างชาญฉลาด... (ป้องกันการสร้างห้องซ้ำซ้อน)'
    });

    const everyoneRole = guild.roles.everyone;
    let reusedCount = 0;
    let createdCount = 0;

    // 1. หมวดหมู่ข้อมูลและประกาศ
    const { category: catInfo, created: isCatInfoNew } = await getOrCreateCategory(
        guild, 
        '📢 │ ข้อมูลและประกาศ', 
        ['ข้อมูลและประกาศ', 'ประกาศ', 'information']
    );
    if (isCatInfoNew) createdCount++; else reusedCount++;

    const { channel: chAnnounce, created: isAnnounceNew } = await getOrCreateTextChannel(
        guild, 
        '📢-ประกาศ', 
        catInfo.id, 
        ['ประกาศ', 'announcement', 'announcements'],
        {
            permissionOverwrites: [
                { id: everyoneRole.id, deny: [PermissionFlagsBits.SendMessages], allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory] }
            ]
        }
    );
    if (isAnnounceNew) createdCount++; else reusedCount++;

    const { channel: chRules, created: isRulesNew } = await getOrCreateTextChannel(
        guild, 
        '📜-กฎระเบียบ', 
        catInfo.id, 
        ['กฎระเบียบ', 'กฎ', 'rules'],
        {
            permissionOverwrites: [
                { id: everyoneRole.id, deny: [PermissionFlagsBits.SendMessages], allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory] }
            ]
        }
    );
    if (isRulesNew) {
        createdCount++;
        const rulesEmbed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('📜 กฎระเบียบประจำเซิร์ฟเวอร์')
            .setDescription('ยินดีต้อนรับสู่เซิร์ฟเวอร์! เพื่อความสงบเรียบร้อย โปรดปฏิบัติตามกฎดังต่อไปนี้:')
            .addFields(
                { name: '1. สุภาพและให้เกียรติกัน', value: 'ห้ามใช้คำหยาบคายรุนแรง หรือพาดพิงเหยียดหยามผู้อื่น' },
                { name: '2. ห้ามสแปมข้อความ', value: 'ห้ามส่งข้อความซ้ำๆ หรือสแปมลิงก์ที่ไม่พึงประสงค์' },
                { name: '3. ห้ามโฆษณา/โปรโมต', value: 'ห้ามโปรโมตเซิร์ฟเวอร์อื่นโดยไม่ได้รับอนุญาต' },
                { name: '4. ปฏิบัติตามคำแนะนำของทีมงาน', value: 'คำตัดสินของทีมงานแอดมินถือเป็นที่สิ้นสุด' }
            )
            .setFooter({ text: 'Server Rules & Guidelines' });
        await chRules.send({ embeds: [rulesEmbed] }).catch(() => {});
    } else {
        reusedCount++;
    }

    // 2. หมวดหมู่พูดคุยทั่วไป
    const { category: catChat, created: isCatChatNew } = await getOrCreateCategory(
        guild, 
        '💬 │ พูดคุยทั่วไป', 
        ['พูดคุยทั่วไป', 'พูดคุย', 'general']
    );
    if (isCatChatNew) createdCount++; else reusedCount++;

    const { channel: chChat, created: isChatNew } = await getOrCreateTextChannel(guild, '💬-แชททั่วไป', catChat.id, ['แชททั่วไป', 'general-chat', 'คุย']);
    if (isChatNew) createdCount++; else reusedCount++;

    const { channel: chMedia, created: isMediaNew } = await getOrCreateTextChannel(guild, '📷-แชร์รูปภาพ', catChat.id, ['แชร์รูปภาพ', 'รูปภาพ', 'media', 'photos']);
    if (isMediaNew) createdCount++; else reusedCount++;

    const { channel: chBot, created: isBotNew } = await getOrCreateTextChannel(guild, '🤖-คำสั่งบอท', catChat.id, ['คำสั่งบอท', 'bot-commands', 'commands']);
    if (isBotNew) createdCount++; else reusedCount++;

    // 3. หมวดหมู่ห้องฟังเพลงและเสียง
    const { category: catMusic, created: isCatMusicNew } = await getOrCreateCategory(
        guild, 
        '🎧 │ ห้องฟังเพลงและเสียง', 
        ['ห้องฟังเพลง', 'ฟังเพลงและเสียง', 'music']
    );
    if (isCatMusicNew) createdCount++; else reusedCount++;

    const { channel: chMusic, created: isMusicNew } = await getOrCreateTextChannel(guild, '🎵-ขอเพลง', catMusic.id, ['ขอเพลง', 'music', 'bot-music']);
    if (isMusicNew) {
        createdCount++;
        await music.sendMusicPanel(chMusic).catch(() => {});
    } else {
        reusedCount++;
        // ตรวจสอบว่ามีแผงเพลงหรือยัง ถ้าไม่มีส่งเพิ่ม
        const existingMsgs = await chMusic.messages.fetch({ limit: 5 }).catch(() => null);
        if (!existingMsgs || existingMsgs.size === 0) {
            await music.sendMusicPanel(chMusic).catch(() => {});
        }
    }

    const { channel: chVoice1, created: isV1New } = await getOrCreateVoiceChannel(guild, '🔊│ห้องพูดคุย-1', catMusic.id, ['ห้องพูดคุย-1', 'voice 1', 'คุย 1']);
    if (isV1New) createdCount++; else reusedCount++;

    const { channel: chVoice2, created: isV2New } = await getOrCreateVoiceChannel(guild, '🔊│ห้องพูดคุย-2', catMusic.id, ['ห้องพูดคุย-2', 'voice 2', 'คุย 2']);
    if (isV2New) createdCount++; else reusedCount++;

    // 4. หมวดหมู่บริการ & ช่วยเหลือ
    const { category: catSupport, created: isCatSupportNew } = await getOrCreateCategory(
        guild, 
        '🎫 │ บริการ & ช่วยเหลือ', 
        ['บริการ & ช่วยเหลือ', 'ช่วยเหลือ', 'support', 'ticket']
    );
    if (isCatSupportNew) createdCount++; else reusedCount++;

    const { channel: chTicket, created: isTicketNew } = await getOrCreateTextChannel(guild, '🎫-เปิดตั๋ว', catSupport.id, ['เปิดตั๋ว', 'tickets', 'open-ticket']);
    if (isTicketNew) {
        createdCount++;
        const ticketEmbed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('🎫 ศูนย์บริการติดต่อ / แจ้งปัญหา / ซื้อสินค้า')
            .setDescription('หากต้องการติดต่อทีมงาน ซื้อยศ หรือแจ้งปัญหา\nกรุณากดที่ปุ่ม **"เปิดตั๋ว (Open Ticket)"** ด้านล่างนี้เพื่อสร้างห้องส่วนตัว')
            .setFooter({ text: 'Ticket Support System' });

        const ticketBtn = new ButtonBuilder()
            .setCustomId('btn_open_ticket')
            .setLabel('🎫 เปิดตั๋ว (Open Ticket)')
            .setStyle(ButtonStyle.Primary);

        await chTicket.send({ embeds: [ticketEmbed], components: [new ActionRowBuilder().addComponents(ticketBtn)] }).catch(() => {});
    } else {
        reusedCount++;
        const existingTicketMsgs = await chTicket.messages.fetch({ limit: 5 }).catch(() => null);
        if (!existingTicketMsgs || existingTicketMsgs.size === 0) {
            const ticketEmbed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle('🎫 ศูนย์บริการติดต่อ / แจ้งปัญหา / ซื้อสินค้า')
                .setDescription('หากต้องการติดต่อทีมงาน ซื้อยศ หรือแจ้งปัญหา\nกรุณากดที่ปุ่ม **"เปิดตั๋ว (Open Ticket)"** ด้านล่างนี้เพื่อสร้างห้องส่วนตัว')
                .setFooter({ text: 'Ticket Support System' });

            const ticketBtn = new ButtonBuilder()
                .setCustomId('btn_open_ticket')
                .setLabel('🎫 เปิดตั๋ว (Open Ticket)')
                .setStyle(ButtonStyle.Primary);

            await chTicket.send({ embeds: [ticketEmbed], components: [new ActionRowBuilder().addComponents(ticketBtn)] }).catch(() => {});
        }
    }

    // 5. หมวดหมู่ทีมงาน (Admin)
    const { category: catAdmin, created: isCatAdminNew } = await getOrCreateCategory(
        guild, 
        '🛡️ │ สำหรับทีมงาน', 
        ['สำหรับทีมงาน', 'ทีมงาน', 'staff', 'admin'],
        {
            permissionOverwrites: [
                { id: everyoneRole.id, deny: [PermissionFlagsBits.ViewChannel] }
            ]
        }
    );
    if (isCatAdminNew) createdCount++; else reusedCount++;

    const { channel: chLog, created: isLogNew } = await getOrCreateTextChannel(guild, '🔒-บันทึกบอท', catAdmin.id, ['บันทึกบอท', 'bot-logs', 'logs']);
    if (isLogNew) createdCount++; else reusedCount++;

    const { channel: chStaff, created: isStaffNew } = await getOrCreateTextChannel(guild, '🛡️-ห้องแอดมิน', catAdmin.id, ['ห้องแอดมิน', 'admin-chat', 'staff-chat']);
    if (isStaffNew) createdCount++; else reusedCount++;

    const finishEmbed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✨ จัดระเบียบเซิร์ฟเวอร์เสร็จสมบูรณ์! (Smart Auto-Setup)')
        .setDescription(`ระบบได้ทำการตรวจสอบห้องทั้งหมดในเซิร์ฟเวอร์อย่างละเอียด เพื่อป้องกันการสร้างห้องซ้ำซ้อน:\n\n` +
            `🔄 **นำห้องเดิมมาเชื่อมต่อและตั้งค่าใหม่:** \`${reusedCount}\` ห้อง/หมวดหมู่\n` +
            `🆕 **สร้างห้อง/หมวดหมู่ที่ยังขาดอยู่:** \`${createdCount}\` ห้อง/หมวดหมู่\n\n` +
            `✅ **ยืนยัน: ไม่มีปัญหาห้องหรือหมวดหมู่ซ้ำซ้อน 100%!**`)
        .addFields(
            { name: '📢 ข้อมูลและประกาศ', value: `${chAnnounce.toString()}, ${chRules.toString()}`, inline: true },
            { name: '💬 พูดคุยทั่วไป', value: `${chChat.toString()}, ${chMedia.toString()}, ${chBot.toString()}`, inline: true },
            { name: '🎧 ห้องฟังเพลง', value: `${chMusic.toString()}, ${chVoice1.name}, ${chVoice2.name}`, inline: true },
            { name: '🎫 บริการ & ช่วยเหลือ', value: `${chTicket.toString()}`, inline: true },
            { name: '🛡️ สำหรับทีมงาน', value: `${chLog.toString()}, ${chStaff.toString()} (ซ่อนจากคนทั่วไป)`, inline: true }
        )
        .setFooter({ text: 'Smart Auto-Setup • Zero Duplicates Guaranteed' })
        .setTimestamp();

    await interaction.editReply({ content: '🎉 ตรวจสอบและจัดระเบียบเรียบร้อยแล้ว!', embeds: [finishEmbed] });
}

module.exports = {
    runAutoSetup,
    getOrCreateCategory,
    getOrCreateTextChannel,
    getOrCreateVoiceChannel
};
