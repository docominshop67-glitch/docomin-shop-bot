const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    StringSelectMenuBuilder,
    ChannelType,
    PermissionFlagsBits
} = require('discord.js');
const db = require('./db');

// ========================================================
// 1. EMVCo PROMPTPAY STANDARD ENGINE (100% Real, Bank App Scannable)
// ========================================================

/**
 * คำนวณรหัสตรวจสอบความถูกต้อง CRC16-CCITT (Polynomial 0x1021) ตามมาตรฐาน EMVCo
 */
function crc16(data) {
    let crc = 0xFFFF;
    for (let i = 0; i < data.length; i++) {
        let x = ((crc >> 8) ^ data.charCodeAt(i)) & 0xFF;
        x ^= x >> 4;
        crc = ((crc << 8) ^ (x << 12) ^ (x << 5) ^ x) & 0xFFFF;
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * สร้าง TLV (Tag-Length-Value) String
 */
function tlv(tag, value) {
    const valStr = String(value);
    const lenStr = String(valStr.length).padStart(2, '0');
    return `${tag}${lenStr}${valStr}`;
}

/**
 * สร้างสตริง EMVCo Payload สำหรับ PromptPay QR Code
 * รองรับทั้งเบอร์โทรศัพท์มือถือ (10 หลัก) และเลขบัตรประชาชน / เลขประจำตัวผู้เสียภาษี (13 หลัก)
 */
function generatePromptPayPayload(target, amount = null) {
    if (!target) return null;
    const cleanTarget = String(target).replace(/[^0-9]/g, '');

    let subtag = '';
    if (cleanTarget.length === 10 && cleanTarget.startsWith('0')) {
        // เบอร์โทรศัพท์: ตัด 0 หน้าออกแล้วเติม 0066 (ความยาว 13 หลัก)
        const formattedMobile = '0066' + cleanTarget.substring(1);
        subtag = tlv('01', formattedMobile);
    } else if (cleanTarget.length === 13) {
        // บัตรประชาชน / เลขผู้เสียภาษี
        subtag = tlv('02', cleanTarget);
    } else if (cleanTarget.length === 15) {
        // e-Wallet ID
        subtag = tlv('03', cleanTarget);
    } else {
        // ค่าเริ่มต้นหากรูปแบบอื่น
        subtag = tlv('01', cleanTarget);
    }

    // Merchant Account Information (Tag 29)
    const aid = tlv('00', 'A000000677010111');
    const tag29 = tlv('29', `${aid}${subtag}`);

    // สร้างโครงสร้างหลัก
    let rawPayload = '';
    rawPayload += tlv('00', '01'); // Payload Format Indicator
    rawPayload += tlv('01', amount && amount > 0 ? '12' : '11'); // 11 = Static, 12 = Dynamic
    rawPayload += tag29;
    rawPayload += tlv('53', '764'); // Currency THB (764)

    if (amount && Number(amount) > 0) {
        const amtStr = Number(amount).toFixed(2);
        rawPayload += tlv('54', amtStr);
    }

    rawPayload += tlv('58', 'TH'); // Country Code TH
    rawPayload += '6304'; // Checksum Tag

    const checksum = crc16(rawPayload);
    return `${rawPayload}${checksum}`;
}

/**
 * สร้าง URL สำหรับแสดงภาพ QR Code คุณภาพสูง
 */
function getQrImageUrl(payload) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(payload)}&margin=15`;
}

/**
 * สร้างการ์ดแสดงช่องทางชำระเงินและ QR พร้อมเพย์
 */
/**
 * ตรวจสอบว่าบัญชีชำระเงินเป็นค่า Dummy หรือยังไม่ได้ตั้งค่าหรือไม่
 */
function isPaymentDummyOrEmpty(config) {
    if (!config) return true;
    const pp = (config.promptpay || '').trim();
    const ba = (config.bankAccount || '').trim();
    if (!pp && !ba) return true;
    if (pp === '0800000000' && ba === '123-4-56789-0') return true;
    return false;
}

/**
 * สร้างการ์ดแสดงช่องทางชำระเงินและ QR พร้อมเพย์
 */
function createPaymentEmbed(guildId, amount = null, note = null) {
    const config = db.getPaymentConfig(guildId) || {};
    const isDummy = isPaymentDummyOrEmpty(config);

    const promptpayNum = config.promptpay || '';
    const bankName = config.bankName || '';
    const bankAccount = config.bankAccount || '';
    const accountName = config.accountName || 'Docomin Shop Official';
    const truemoney = config.truemoney || '';

    const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('💳 ช่องทางการชำระเงิน — Docomin Shop')
        .setDescription(
            isDummy
                ? '⚠️ **บัญชีรับเงินยังไม่ได้ตั้งค่าข้อมูลจริง**\nแอดมินสามารถกดปุ่ม **[⚙️ ตั้งค่าบัญชีรับเงิน]** ด้านล่างเพื่อกรอกเบอร์พร้อมเพย์และเลขบัญชีได้ทันที'
                : 'สแกน QR Code พร้อมเพย์ หรือโอนผ่านบัญชีธนาคาร / ทรูมันนี่ ด้านล่างนี้'
        )
        .setThumbnail('https://cdn-icons-png.flaticon.com/512/893/893081.png')
        .setTimestamp()
        .setFooter({ text: 'ระบบชำระเงินอัตโนมัติ Docomin Shop • ปลอดภัย 100%' });

    if (amount && Number(amount) > 0) {
        embed.addFields({
            name: '💰 ยอดชำระเงินสุทธิ',
            value: `\`\`\`fix\n฿${Number(amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท\n\`\`\``,
            inline: false
        });
    }

    if (promptpayNum && !isDummy) {
        const payload = generatePromptPayPayload(promptpayNum, amount);
        if (payload) {
            embed.setImage(getQrImageUrl(payload));
        }
    } else if (promptpayNum && isDummy) {
        // Dummy or preview QR
        const payload = generatePromptPayPayload('0800000000', amount);
        if (payload) {
            embed.setImage(getQrImageUrl(payload));
        }
    }

    const ppText = promptpayNum
        ? `• **หมายเลข:** \`${promptpayNum}\` *(แตะเพื่อคัดลอก)*\n• **ชื่อบัญชี:** \`${accountName}\``
        : '*(ยังไม่ได้ตั้งค่า)*';

    const bankText = bankAccount
        ? `• **ธนาคาร:** **${bankName || 'ธนาคารพาณิชย์'}**\n• **เลขที่บัญชี:** \`${bankAccount.replace(/[^0-9-]/g, '')}\` *(แตะเพื่อคัดลอก)*\n• **ชื่อบัญชี:** \`${accountName}\``
        : '*(ยังไม่ได้ตั้งค่า)*';

    embed.addFields(
        {
            name: '📱 พร้อมเพย์ (PromptPay QR)',
            value: ppText,
            inline: true
        },
        {
            name: '🏦 บัญชีธนาคาร (Bank Transfer)',
            value: bankText,
            inline: true
        }
    );

    if (truemoney) {
        embed.addFields({
            name: '🧡 ทรูมันนี่ วอลเล็ท (TrueMoney)',
            value: `• **เบอร์วอลเล็ท:** \`${truemoney}\` *(แตะเพื่อคัดลอก)*\n• หรือกดปุ่ม **[🧧 ส่งซองทรูมันนี่]** ด้านล่างเพื่อส่งเป็นซองของขวัญ`,
            inline: false
        });
    }

    if (note) {
        embed.addFields({
            name: '📝 รายละเอียดคำสั่งซื้อ',
            value: note,
            inline: false
        });
    }

    embed.addFields({
        name: '📌 ขั้นตอนหลังชำระเงิน',
        value: '1. เมื่อโอนเงินเสร็จแล้ว ให้กดปุ่ม **[📤 แนบสลิป / แจ้งโอนเงิน]** หรือลากภาพสลิปลงในห้องนี้\n2. หากใช้ **ซองของขวัญทรูมันนี่** ให้กดปุ่ม **[🧧 ส่งซองทรูมันนี่]** แล้ววางลิงก์ซอง\n3. ระบบจะแจ้งเตือนทีมงานตรวจสอบและส่งมอบสินค้าให้ทันทีครับ',
        inline: false
    });

    return embed;
}

/**
 * สร้าง Action Row สำหรับปุ่มจัดการชำระเงินในห้องตั๋ว
 */
function createPaymentActionRow(ticketChannelId = null) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(ticketChannelId ? `btn_pay_upload_slip_${ticketChannelId}` : 'btn_pay_upload_slip')
            .setLabel('📤 แนบสลิป / แจ้งโอน')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(ticketChannelId ? `btn_pay_coupon_${ticketChannelId}` : 'btn_pay_coupon')
            .setLabel('🎟️ ใช้คูปองส่วนลด')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(ticketChannelId ? `btn_pay_truemoney_angpao_${ticketChannelId}` : 'btn_pay_truemoney_angpao')
            .setLabel('🧧 ส่งซองทรูมันนี่')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(ticketChannelId ? `btn_pay_call_staff_${ticketChannelId}` : 'btn_pay_call_staff')
            .setLabel('💬 ติดต่อแอดมิน')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('btn_pay_admin_setup')
            .setLabel('⚙️ ตั้งค่าบัญชี')
            .setStyle(ButtonStyle.Secondary)
    );
}

/**
 * สร้าง Modal ให้ Admin ตั้งค่าบัญชีรับเงินของร้านค้า
 */
function createSetPaymentModal(currentConfig = {}) {
    return new ModalBuilder()
        .setCustomId('modal_set_payment_submit')
        .setTitle('⚙️ ตั้งค่าบัญชีรับเงิน — Docomin Shop')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('payment_promptpay')
                    .setLabel('เบอร์พร้อมเพย์ / เลขบัตร ปชช. (10 หรือ 13 หลัก)')
                    .setPlaceholder('เช่น 0812345678 หรือ 1100400000000')
                    .setValue(currentConfig.promptpay && currentConfig.promptpay !== '0800000000' ? currentConfig.promptpay : '')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('payment_account_name')
                    .setLabel('ชื่อ-นามสกุล เจ้าของบัญชี (ตรงตามบัญชี)')
                    .setPlaceholder('เช่น นาย สมชาย ใจดี หรือ Somchai Jaidee')
                    .setValue(currentConfig.accountName && currentConfig.accountName !== 'Docomin Shop Official' ? currentConfig.accountName : '')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('payment_bank_name')
                    .setLabel('ชื่อธนาคาร')
                    .setPlaceholder('เช่น กสิกรไทย, ไทยพาณิชย์ (SCB), กรุงไทย, ออมสิน')
                    .setValue(currentConfig.bankName && currentConfig.bankName !== 'กสิกรไทย (KBANK)' ? currentConfig.bankName : '')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('payment_bank_account')
                    .setLabel('เลขที่บัญชีธนาคาร (เฉพาะตัวเลข)')
                    .setPlaceholder('เช่น 1234567890')
                    .setValue(currentConfig.bankAccount && currentConfig.bankAccount !== '123-4-56789-0' ? currentConfig.bankAccount : '')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('payment_truemoney')
                    .setLabel('เบอร์ทรูมันนี่ วอลเล็ท (TrueMoney Wallet)')
                    .setPlaceholder('เช่น 0812345678 (เว้นว่างได้ถ้าไม่ใช้)')
                    .setValue(currentConfig.truemoney && currentConfig.truemoney !== '080-000-0000' ? currentConfig.truemoney : '')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false)
            )
        );
}

/**
 * สร้าง Modal ให้ลูกค้าส่งซองของขวัญทรูมันนี่
 */
function createAngpaoModal() {
    return new ModalBuilder()
        .setCustomId('modal_angpao_submit')
        .setTitle('🧧 ส่งซองของขวัญทรูมันนี่ (Angpao)')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('angpao_link')
                    .setLabel('ลิงก์ซองของขวัญ TrueMoney')
                    .setPlaceholder('https://gift.truemoney.com/campaign/?v=xxxxxxxx')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('angpao_amount')
                    .setLabel('ยอดเงินในซอง (บาท)')
                    .setPlaceholder('เช่น 150')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('angpao_note')
                    .setLabel('หมายเหตุเพิ่มเติม (ถ้ามี)')
                    .setPlaceholder('เช่น ชำระค่าไก่ตัน')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false)
            )
        );
}

/**
 * สร้าง Modal ให้ลูกค้ากรอกโค้ดคูปองส่วนลด
 */
function createApplyCouponModal(ticketChannelId = '') {
    return new ModalBuilder()
        .setCustomId(`modal_apply_coupon_${ticketChannelId}`)
        .setTitle('🎟️ ใช้คูปองส่วนลด — Docomin Shop')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('coupon_code')
                    .setLabel('ใส่โค้ดคูปองส่วนลด')
                    .setPlaceholder('เช่น DOCOMIN10 หรือ WELCOME20')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
            )
        );
}

/**
 * สร้าง Modal สำหรับ Admin ส่งมอบสินค้าให้ลูกค้า
 */
function createDeliverProductModal(ticketChannelId, ticket = null) {
    const itemName = ticket?.itemName || 'สินค้า';
    return new ModalBuilder()
        .setCustomId(`modal_admin_deliver_${ticketChannelId}`)
        .setTitle(`📦 ส่งมอบสินค้า: ${itemName.slice(0, 30)}`)
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('deliver_content')
                    .setLabel('ข้อมูลสินค้า / ไอดี : รหัสผ่าน / โค้ดสินค้า')
                    .setPlaceholder('Username: ...\nPassword: ...\nหรือ ลิงก์รับสินค้า')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('deliver_guide')
                    .setLabel('คำแนะนำการใช้งาน / ข้อควรระวัง')
                    .setValue('กรุณาเปลี่ยนรหัสผ่านและผูกอีเมลความปลอดภัยทันที หากพบปัญหาสามารถติดต่อแอดมินได้ตลอด 24 ชม.')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(false)
            )
        );
}

/**
 * สร้าง Embed ส่งมอบสินค้า
 */
function createDeliveryEmbed(ticket, deliverContent, deliverGuide, adminUser) {
    const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('🎉 ส่งมอบสินค้าสำเร็จเรียบร้อย — Docomin Shop')
        .setDescription(`เรียนคุณลูกค้า <@${ticket.userId}> สินค้าของคุณได้รับการจัดส่งเรียบร้อยแล้ว! ขอขอบคุณที่ใช้บริการกับร้านของเราครับ ❤️`)
        .addFields(
            {
                name: '📦 สินค้าที่จัดส่ง',
                value: `**${ticket.itemName || 'สินค้า'}** (จำนวน: \`${ticket.quantity || 1}\`)`,
                inline: true
            },
            {
                name: '🛡️ ผู้ส่งมอบสินค้า',
                value: adminUser ? `<@${adminUser.id}>` : 'ทีมงาน Docomin Shop',
                inline: true
            },
            {
                name: '🔐 ข้อมูลสินค้าของคุณ (บันทึกและเก็บไว้เป็นความลับ)',
                value: `\`\`\`fix\n${deliverContent}\n\`\`\``,
                inline: false
            }
        )
        .setFooter({ text: 'Docomin Shop Official Delivery Desk • ปลอดภัย 100%' })
        .setTimestamp();

    if (deliverGuide) {
        embed.addFields({
            name: '💡 คำแนะนำและการรับประกัน',
            value: deliverGuide,
            inline: false
        });
    }

    return embed;
}

/**
 * สร้าง Modal สำหรับรีวิวและให้คะแนนร้านค้า (Vouch)
 */
function createVouchModal(sellerId = '', itemName = '') {
    return new ModalBuilder()
        .setCustomId(`modal_vouch_submit_${sellerId}`)
        .setTitle('⭐ ให้คะแนนและรีวิวร้านค้า (Vouch)')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('vouch_stars')
                    .setLabel('ระดับคะแนนดาว (1 - 5)')
                    .setValue('5')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('vouch_comment')
                    .setLabel('ความคิดเห็นและคำชมของคุณ')
                    .setPlaceholder('เช่น ส่งไวมาก บริการดี ได้ของแท้ 100% ประทับใจมากครับ')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('vouch_item')
                    .setLabel('สินค้าที่สั่งซื้อ')
                    .setValue(itemName || 'ไก่ตัน')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
            )
        );
}

// ========================================================
// 2. VOUCH & REPUTATION SYSTEM (ระบบรีวิวและเครดิตร้านค้า)
// ========================================================

function renderStars(count) {
    const full = Math.max(1, Math.min(5, parseInt(count) || 5));
    return '⭐'.repeat(full) + '☆'.repeat(5 - full);
}

function renderProgressBar(percentage, totalBars = 10) {
    const filled = Math.round((percentage / 100) * totalBars);
    const empty = totalBars - filled;
    return '🟩'.repeat(filled) + '⬜'.repeat(empty) + ` ${percentage}%`;
}

function createVouchEmbed(vouch, buyerUser, sellerUser) {
    const embed = new EmbedBuilder()
        .setColor(0xFEE75C) // Gold
        .setTitle('⭐ รีวิวและเครดิตใหม่ — Docomin Shop')
        .setDescription(`มีลูกค้าสั่งซื้อสินค้าและยืนยันเครดิตสำเร็จเรียบร้อย!`)
        .addFields(
            {
                name: '👤 ลูกค้าผู้สั่งซื้อ',
                value: `<@${vouch.buyerId}> (\`${buyerUser ? buyerUser.tag : vouch.buyerTag}\`)`,
                inline: true
            },
            {
                name: '🛍️ ผู้จำหน่าย / ร้านค้า',
                value: `<@${vouch.sellerId}>`,
                inline: true
            },
            {
                name: '📦 สินค้าที่ซื้อ',
                value: `**${vouch.item}**`,
                inline: true
            },
            {
                name: '⭐ คะแนนความพึงพอใจ',
                value: `## ${renderStars(vouch.stars)} (${vouch.stars}/5 ดาว)`,
                inline: false
            },
            {
                name: '💬 ความคิดเห็นและคำชม',
                value: `> *"${vouch.comment}"*`,
                inline: false
            }
        )
        .setThumbnail(buyerUser ? buyerUser.displayAvatarURL({ dynamic: true }) : 'https://cdn-icons-png.flaticon.com/512/1828/1828884.png')
        .setFooter({ text: `รหัสรีวิว: ${vouch.id} • ตรวจสอบแล้วโดยระบบเครดิตร้านค้า` })
        .setTimestamp(new Date(vouch.timestamp));

    if (vouch.proofUrl) {
        embed.setImage(vouch.proofUrl);
    }

    return embed;
}

function createReputationEmbed(sellerUser, stats) {
    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`🛡️ ประวัติเครดิตและความน่าเชื่อถือ — ${sellerUser.username}`)
        .setDescription(`ข้อมูลคะแนนความไว้วางใจและรีวิวทั้งหมดจากลูกค้าจริงในเซิร์ฟเวอร์`)
        .setThumbnail(sellerUser.displayAvatarURL({ dynamic: true }))
        .addFields(
            {
                name: '📊 สถิติภาพรวม',
                value: `• **ออเดอร์ทั้งหมด:** \`${stats.total}\` รายการ\n• **คะแนนเฉลี่ย:** \`${stats.average} / 5.0\` ⭐\n• **สถานะร้านค้า:** 👑 **ร้านค้ายอดนิยม (Top Rated Seller)**`,
                inline: false
            }
        );

    if (stats.total > 0) {
        const b = stats.breakdown;
        const b5Pct = Math.round((b[5] / stats.total) * 100);
        const b4Pct = Math.round((b[4] / stats.total) * 100);
        const b3Pct = Math.round((b[3] / stats.total) * 100);
        const b2Pct = Math.round((b[2] / stats.total) * 100);
        const b1Pct = Math.round((b[1] / stats.total) * 100);

        embed.addFields({
            name: '📈 การแจกแจงระดับคะแนนดาว',
            value: `⭐⭐⭐⭐⭐ (${b[5]}) ${renderProgressBar(b5Pct, 8)}\n⭐⭐⭐⭐☆ (${b[4]}) ${renderProgressBar(b4Pct, 8)}\n⭐⭐⭐☆☆ (${b[3]}) ${renderProgressBar(b3Pct, 8)}\n⭐⭐☆☆☆ (${b[2]}) ${renderProgressBar(b2Pct, 8)}\n⭐☆☆☆☆ (${b[1]}) ${renderProgressBar(b1Pct, 8)}`,
            inline: false
        });

        if (stats.recent.length > 0) {
            const recentTexts = stats.recent.map(r => {
                const dateStr = `<t:${Math.floor(r.timestamp / 1000)}:R>`;
                return `• **${renderStars(r.stars)}** โดย <@${r.buyerId}>: "${r.comment}" (${r.item}) — ${dateStr}`;
            }).join('\n');

            embed.addFields({
                name: '💬 รีวิวล่าสุด',
                value: recentTexts,
                inline: false
            });
        }
    } else {
        embed.addFields({
            name: 'ℹ️ สถานะ',
            value: 'ยังไม่มีประวัติการรีวิว ลูกค้าที่สั่งซื้อสามารถใช้คำสั่ง `/vouch` เพื่อให้เครดิตได้',
            inline: false
        });
    }

    embed.setFooter({ text: 'Docomin Shop Reputation System • โปร่งใส ตรวจสอบได้' });
    embed.setTimestamp();
    return embed;
}

/**
 * สร้าง Embed แสดงภาพรวมยอดขาย สถิติ และการวิเคราะห์ร้านค้า (Sales Analytics Dashboard)
 */
function createSalesSummaryEmbed(stats, vouchStats = null) {
    const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('📊 รายงานสรุปยอดขาย & ประสิทธิภาพร้านค้า — Docomin Shop')
        .setDescription('สรุปข้อมูลผลการดำเนินงาน ยอดขายคำสั่งซื้อ และสถิติความพึงพอใจของลูกค้า')
        .setThumbnail('https://cdn-icons-png.flaticon.com/512/3135/3135706.png')
        .addFields(
            {
                name: '💰 ยอดขายรวมทั้งหมด (Total Revenue)',
                value: `\`\`\`fix\n฿${(stats.totalRevenue || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท\n\`\`\``,
                inline: false
            },
            {
                name: '📦 คำสั่งซื้อที่สำเร็จ',
                value: `\`${stats.totalSalesCount || 0}\` ออเดอร์`,
                inline: true
            },
            {
                name: '👥 ลูกค้าทั้งหมด',
                value: `\`${stats.uniqueCustomersCount || 0}\` คน`,
                inline: true
            },
            {
                name: '🎟️ ส่วนลดที่ให้ลูกค้า',
                value: `\`฿${(stats.totalDiscount || 0).toLocaleString('th-TH')} บาท\` (${stats.couponsUsedCount || 0} ครั้ง)`,
                inline: true
            },
            {
                name: '📅 ยอดขายวันนี้ (24 ชม.)',
                value: `\`฿${(stats.todayRevenue || 0).toLocaleString('th-TH')} บาท\``,
                inline: true
            },
            {
                name: '📈 ยอดขายสัปดาห์นี้ (7 วัน)',
                value: `\`฿${(stats.weekRevenue || 0).toLocaleString('th-TH')} บาท\``,
                inline: true
            }
        );

    if (vouchStats && vouchStats.total > 0) {
        embed.addFields({
            name: '⭐ คะแนนรีวิวเฉลี่ย',
            value: `\`${vouchStats.average} / 5.0\` ดาว (${vouchStats.total} รีวิว)`,
            inline: true
        });
    }

    if (stats.topProducts && stats.topProducts.length > 0) {
        const topText = stats.topProducts.map((p, idx) => {
            const medal = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][idx] || '•';
            return `${medal} **${p.name}** — ขายได้ \`${p.count}\` ชิ้น (รวม \`฿${p.revenue.toLocaleString()}\` บาท)`;
        }).join('\n');

        embed.addFields({
            name: '🏆 สินค้าขายดีที่สุด (Top 5 Best Sellers)',
            value: topText,
            inline: false
        });
    } else {
        embed.addFields({
            name: '🏆 สินค้าขายดีที่สุด',
            value: '*ยังไม่มีข้อมูลสินค้าที่มียอดขาย*',
            inline: false
        });
    }

    embed.setFooter({ text: 'Docomin Shop Analytics • Real-time Business Intelligence' })
        .setTimestamp();

    return embed;
}

/**
 * สร้าง Embed แสดงระดับสมาชิก VIP และสิทธิพิเศษ
 */
function createVipEmbed(user, stats) {
    const tierColors = {
        'diamond': 0x00FFFF,
        'gold': 0xFFD700,
        'silver': 0xC0C0C0,
        'bronze': 0xCD7F32
    };

    const color = tierColors[stats.tier] || 0x5865F2;
    const bar = renderProgressBar(stats.progress, 10);

    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`👑 ระดับสมาชิก VIP — ${user.username}`)
        .setDescription(`สะสมยอดซื้อจากการสั่งซื้อสินค้าใน Docomin Shop เพื่อเลื่อนระดับและรับส่วนลดถาวร!`)
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .addFields(
            {
                name: '🎖️ ระดับสมาชิกปัจจุบัน',
                value: `## ${stats.tierName}\n• ส่วนลดอัตโนมัติทุกคำสั่งซื้อ: **${stats.discountPercent}%**`,
                inline: false
            },
            {
                name: '💰 ยอดซื้อสะสมทั้งหมด',
                value: `\`฿${stats.totalSpent.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท\``,
                inline: true
            },
            {
                name: '📦 คำสั่งซื้อสำเร็จ',
                value: `\`${stats.totalOrders}\` ครั้ง`,
                inline: true
            },
            {
                name: '🏷️ ประหยัดเงินไปแล้ว',
                value: `\`฿${stats.totalSaved.toLocaleString('th-TH')} บาท\``,
                inline: true
            }
        );

    if (stats.tier !== 'diamond') {
        embed.addFields({
            name: `🚀 ความคืบหน้าสู่ระดับ ${stats.nextTier} (${stats.progress}%)`,
            value: `${bar}\nซื้อเพิ่มอีกเพียง **฿${stats.remainingToNext.toLocaleString('th-TH')} บาท** เพื่อเลื่อนระดับ!`,
            inline: false
        });
    } else {
        embed.addFields({
            name: '👑 ระดับสูงสุด (Max Level)',
            value: 'คุณอยู่ในระดับสมาชิกสูงสุด **Diamond VIP** รับส่วนลดพิเศษ 10% ทุกการสั่งซื้อตลอดชีพ!',
            inline: false
        });
    }

    embed.setFooter({ text: 'Docomin Shop Loyalty Rewards Program' })
        .setTimestamp();

    return embed;
}

/**
 * สร้าง Embed แสดงประวัติการสั่งซื้อของลูกค้า
 */
function createMyOrdersEmbed(user, stats, orders) {
    const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle(`🛍️ ประวัติการสั่งซื้อของ ${user.username}`)
        .setDescription(`ข้อมูลคำสั่งซื้อทั้งหมดของคุณในร้านค้า Docomin Shop\n• ระดับสมาชิก: **${stats.tierName}** (ส่วนลดอัตโนมัติ: **${stats.discountPercent}%**)`)
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .addFields(
            {
                name: '📊 ข้อมูลสรุป',
                value: `• สั่งซื้อสำเร็จทั้งหมด: **${stats.totalOrders}** รายการ\n• ยอดใช้จ่ายรวม: **฿${stats.totalSpent.toLocaleString('th-TH')}** บาท`,
                inline: false
            }
        );

    if (orders && orders.length > 0) {
        const orderTexts = orders.map((o, idx) => {
            const dateStr = `<t:${Math.floor(o.timestamp / 1000)}:d>`;
            const discText = o.discount > 0 ? ` (ประหยัด ฿${o.discount})` : '';
            return `**${idx + 1}.** [${dateStr}] **${o.productName}** x${o.quantity || 1} — \`฿${Number(o.amount).toLocaleString()} บาท\`${discText}`;
        }).join('\n');

        embed.addFields({
            name: '📦 คำสั่งซื้อล่าสุด',
            value: orderTexts,
            inline: false
        });
    } else {
        embed.addFields({
            name: '📦 ประวัติคำสั่งซื้อ',
            value: '*ยังไม่มีประวัติการสั่งซื้อ คุณสามารถสั่งซื้อได้ที่ห้องเปิดตั๋วสั่งซื้อ*',
            inline: false
        });
    }

    embed.setFooter({ text: 'Docomin Shop Customer Portal' })
        .setTimestamp();

    return embed;
}

/**
 * สร้าง Embed รายงานการขึ้นบัญชีดำ (Blacklist Alert)
 */
function createBlacklistEmbed(targetUser, info) {
    return new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('🚨 รายงานบัญชีดำ / ประวัติอันตราย (Blacklist Alert)')
        .setDescription(`⚠️ ตรวจพบข้อมูลผู้ใช้ที่ถูกขึ้นบัญชีดำในระบบ`)
        .setThumbnail('https://cdn-icons-png.flaticon.com/512/564/564619.png')
        .addFields(
            {
                name: '👤 ผู้ใช้',
                value: `<@${targetUser.id}> (\`${targetUser.tag || targetUser.username}\`)\nID: \`${targetUser.id}\``,
                inline: true
            },
            {
                name: '🛡️ สถานะ',
                value: '🔴 **ถูกขึ้นบัญชีดำ (Blacklisted)**',
                inline: true
            },
            {
                name: '⚠️ สาเหตุที่ถูกแบน',
                value: `\`\`\`diff\n- ${info.reason || 'พฤติกรรมน่าสงสัย / หลอกลวง'}\n\`\`\``,
                inline: false
            },
            {
                name: '👮 วันที่บันทึก',
                value: `<t:${Math.floor(info.timestamp / 1000)}:F> (<t:${Math.floor(info.timestamp / 1000)}:R>)`,
                inline: true
            }
        )
        .setFooter({ text: 'Docomin Anti-Fraud Security System' })
        .setTimestamp(new Date(info.timestamp));
}

// ========================================================
// 3. PRODUCT CATALOG & SHOWCASE (แคตตาล็อกสินค้า)
// ========================================================

const CATEGORY_NAMES = {
    'all': '📦 ทั้งหมด (All Items)',
    'blox_fruits': '🍎 ผลปีศาจ & รหัส Blox Fruits',
    'robux': '🪙 Robux & กิฟต์การ์ด',
    'nitro': '🚀 Discord Nitro & บูสต์',
    'services': '⚔️ บริการฟาร์ม & เควส',
    'other': '🎁 อื่นๆ (Other Items)'
};

function createCatalogEmbed(products, category = 'all') {
    const catTitle = CATEGORY_NAMES[category] || '📦 สินค้าทั้งหมด';
    const embed = new EmbedBuilder()
        .setColor(0xEB459E)
        .setTitle(`🛒 แคตตาล็อกสินค้า Docomin Shop — ${catTitle}`)
        .setDescription(`เลือกดูสินค้าและเช็คสต็อกได้แบบเรียลไทม์\nหากต้องการสั่งซื้อ สามารถกดปุ่ม **"🛒 สั่งซื้อสินค้า"** ด้านล่างได้เลย!`)
        .setThumbnail('https://cdn-icons-png.flaticon.com/512/3081/3081986.png')
        .setFooter({ text: `มีสินค้าทั้งหมด ${products.length} รายการ • อัปเดตสต็อกเรียลไทม์` })
        .setTimestamp();

    if (products.length === 0) {
        embed.addFields({
            name: 'ℹ️ ยังไม่มีสินค้าในหมวดหมู่นี้',
            value: 'แอดมินสามารถเพิ่มสินค้าได้โดยใช้คำสั่ง `/product-add`',
            inline: false
        });
        return embed;
    }

    for (const p of products.slice(0, 15)) {
        const stockDisplay = p.stock > 0 ? `🟢 พร้อมส่ง (${p.stock} ชิ้น)` : '🔴 สินค้าหมดชั่วคราว';
        const priceDisplay = `฿${Number(p.price).toLocaleString('th-TH')} บาท`;
        embed.addFields({
            name: `📦 [${p.id}] ${p.name}`,
            value: `💰 **ราคา:** \`${priceDisplay}\` | 📦 **สถานะ:** ${stockDisplay}\n📝 **รายละเอียด:** ${p.description}`,
            inline: false
        });
    }

    return embed;
}

function createCatalogSelectMenu(products) {
    const options = [
        { label: '📦 ทั้งหมด (All Items)', value: 'cat_all', description: 'ดูสินค้าทุกหมวดหมู่ของร้าน' },
        { label: '🍎 Blox Fruits (ผลปีศาจ/ไอดี)', value: 'cat_blox_fruits', description: 'ผลปีศาจถาวร ผลดอง รหัสไก่ตัน' },
        { label: '🪙 Robux & บัตรเติมเงิน', value: 'cat_robux', description: 'Robux เรทถูก ส่งไว ปลอดภัย' },
        { label: '🚀 Discord Nitro', value: 'cat_nitro', description: 'Discord Nitro รายเดือน / รายปี' },
        { label: '⚔️ บริการฟาร์ม / รับทำเควส', value: 'cat_services', description: 'รับฟาร์มเลเวล ดาบคู่ หมัด ก็อดฮิวแมน' },
        { label: '🎁 สินค้าอื่นๆ', value: 'cat_other', description: 'ไอเทมและบริการอื่นๆ' }
    ];

    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('select_shop_category')
            .setPlaceholder('📂 เลือกหมวดหมู่สินค้าที่ต้องการดู...')
            .addOptions(options)
    );
}

// ========================================================
// 4. MULTI-CATEGORY ORDER & SERVICE DESK TICKET SYSTEM
// ========================================================

function createOrderDeskEmbed(guildName) {
    return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`🛒 ศูนย์บริการสั่งซื้อและติดต่อสอบถาม — Docomin Shop`)
        .setDescription(`ยินดีต้อนรับสู่ **Docomin Shop** อย่างเป็นทางการ!\nเราพร้อมให้บริการสินค้าคุณภาพ ส่งรวดเร็วทันใจ ปลอดภัย 100%\n\nกรุณาเลือกประเภทบริการที่คุณต้องการจากปุ่มด้านล่างนี้:`)
        .addFields(
            {
                name: '🛒 1. สั่งซื้อสินค้า (Buy / Order)',
                value: 'เปิดตั๋วเพื่อแจ้งรายการสินค้าที่ต้องการสั่งซื้อ คำนวณยอด และรับช่องทางชำระเงิน',
                inline: false
            },
            {
                name: '❓ 2. สอบถามข้อมูล / เช็คสต็อก (Inquiry)',
                value: 'สอบถามรายละเอียดสินค้า นัดเวลาส่งมอบ หรือปรึกษาแอดมิน',
                inline: false
            },
            {
                name: '🛠️ 3. เคลมสินค้า / แจ้งปัญหา (Warranty & Support)',
                value: 'แจ้งปัญหาสินค้า เคลมรหัส หรือขอความช่วยเหลือเร่งด่วน',
                inline: false
            }
        )
        .setImage('https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=1200&q=80')
        .setFooter({ text: 'Docomin Shop Service Desk • เปิดบริการทุกวัน พร้อมดูแลคุณ' })
        .setTimestamp();
}

function createOrderDeskButtons() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('btn_order_buy')
            .setLabel('🛒 สั่งซื้อสินค้า')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('btn_order_inquiry')
            .setLabel('❓ สอบถามข้อมูล')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('btn_order_claim')
            .setLabel('🛠️ เคลมสินค้า/แจ้งปัญหา')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('btn_shop_catalog_open')
            .setLabel('📦 ดูรายการสินค้า')
            .setStyle(ButtonStyle.Secondary)
    );
}

// Modal สำหรับการสั่งซื้อสินค้า
function createBuyOrderModal() {
    return new ModalBuilder()
        .setCustomId('modal_order_buy_submit')
        .setTitle('🛒 แบบฟอร์มสั่งซื้อสินค้า Docomin Shop')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('order_item_name')
                    .setLabel('ชื่อสินค้าหรือรหัสสินค้า (ID)')
                    .setPlaceholder('เช่น Kitsune ถาวร หรือ BF-KIT-P')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('order_quantity')
                    .setLabel('จำนวนที่ต้องการสั่งซื้อ')
                    .setPlaceholder('เช่น 1 หรือ 2 ชิ้น')
                    .setValue('1')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('order_payment_method')
                    .setLabel('ช่องทางชำระเงินที่สะดวก')
                    .setPlaceholder('พร้อมเพย์ (QR) / โอนธนาคาร / ทรูมันนี่')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('order_game_info')
                    .setLabel('ชื่อในเกม Roblox หรือข้อมูลรับของ')
                    .setPlaceholder('Username ในเกม Roblox เพื่อส่งมอบสินค้า')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('order_note')
                    .setLabel('โค้ดคูปองส่วนลด หรือข้อความเพิ่มเติม')
                    .setPlaceholder('ใส่โค้ดส่วนลด (ถ้ามี) หรือพิมพ์ข้อความถึงทีมงาน')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(false)
            )
        );
}

// Modal สำหรับการสอบถามข้อมูล
function createInquiryModal() {
    return new ModalBuilder()
        .setCustomId('modal_order_inquiry_submit')
        .setTitle('❓ สอบถามข้อมูลเพิ่มเติม')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('inquiry_topic')
                    .setLabel('หัวข้อที่ต้องการสอบถาม')
                    .setPlaceholder('เช่น เช็คสต็อกผลมังกร / สอบถามคิวรับฟาร์ม')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('inquiry_details')
                    .setLabel('รายละเอียดคำถาม')
                    .setPlaceholder('พิมพ์คำถามที่คุณต้องการสอบถามแอดมินที่นี่...')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
            )
        );
}

// Modal สำหรับการเคลมสินค้า
function createClaimModal() {
    return new ModalBuilder()
        .setCustomId('modal_order_claim_submit')
        .setTitle('🛠️ แบบฟอร์มแจ้งปัญหาและเคลมสินค้า')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('claim_order_id')
                    .setLabel('รหัสออเดอร์ หรือ ชื่อสินค้าที่มีปัญหา')
                    .setPlaceholder('เช่น รหัสไก่ตัน ID: xxx หรือ ผลปีศาจ')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('claim_description')
                    .setLabel('รายละเอียดปัญหาที่พบ')
                    .setPlaceholder('อธิบายปัญหาอย่างละเอียด เพื่อให้ทีมงานตรวจสอบและแก้ไขให้เร็วที่สุด')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
            )
        );
}

// Action buttons ภายในห้อง Ticket
function createTicketActionButtons(ticketChannelId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`btn_ticket_qr_${ticketChannelId}`)
            .setLabel('💳 ขอ QR ชำระเงิน')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`btn_ticket_done_${ticketChannelId}`)
            .setLabel('✅ ส่งของแล้ว / จบงาน')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`btn_ticket_transcript_${ticketChannelId}`)
            .setLabel('📄 บันทึก Transcript')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`btn_ticket_close_${ticketChannelId}`)
            .setLabel('🔒 ปิดตั๋ว')
            .setStyle(ButtonStyle.Danger)
    );
}

// Setup ทั้งระบบร้านค้า Docomin Shop อัตโนมัติ (ตรวจสอบและป้องกันการสร้างห้องซ้ำซ้อน 100%)
async function runSetupDocominShop(guild, interaction) {
    await interaction.editReply({
        content: '⚙️ กำลังตรวจสอบและติดตั้งระบบร้านค้า Docomin Shop... (ระบบจะนำห้องเดิมมาเชื่อมต่ออัตโนมัติ โดยไม่สร้างห้องซ้ำ)'
    });

    const { getOrCreateCategory, getOrCreateTextChannel } = require('./autosetup');
    const everyoneRole = guild.roles.everyone;
    let reusedCount = 0;
    let createdCount = 0;

    // 1. หมวดหมู่ DOCOMIN SHOP
    const { category: catShop, created: isCatShopNew } = await getOrCreateCategory(
        guild,
        '🛒 │ DOCOMIN SHOP',
        ['docomin shop', 'ร้านค้า docomin', 'ร้านค้า', 'shop']
    );
    if (isCatShopNew) createdCount++; else reusedCount++;

    // 2. ห้องรายการสินค้าและราคา (Catalog)
    const { channel: chCatalog, created: isCatalogNew } = await getOrCreateTextChannel(
        guild,
        '📦-รายการสินค้า',
        catShop.id,
        ['รายการสินค้า', 'catalog', 'สินค้า'],
        {
            permissionOverwrites: [
                { id: everyoneRole.id, deny: [PermissionFlagsBits.SendMessages], allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory] }
            ]
        }
    );
    if (isCatalogNew) {
        createdCount++;
        const products = db.getProducts(guild.id);
        const catalogEmbed = createCatalogEmbed(products, 'all');
        const catalogMenu = createCatalogSelectMenu(products);
        await chCatalog.send({ embeds: [catalogEmbed], components: [catalogMenu] }).catch(() => {});
    } else {
        reusedCount++;
        const existing = await chCatalog.messages.fetch({ limit: 5 }).catch(() => null);
        if (!existing || existing.size === 0) {
            const products = db.getProducts(guild.id);
            const catalogEmbed = createCatalogEmbed(products, 'all');
            const catalogMenu = createCatalogSelectMenu(products);
            await chCatalog.send({ embeds: [catalogEmbed], components: [catalogMenu] }).catch(() => {});
        }
    }

    // 3. ห้องช่องทางชำระเงิน (Payment)
    const { channel: chPayment, created: isPaymentNew } = await getOrCreateTextChannel(
        guild,
        '💳-ช่องทางชำระเงิน',
        catShop.id,
        ['ช่องทางชำระเงิน', 'payment', 'โอนเงิน'],
        {
            permissionOverwrites: [
                { id: everyoneRole.id, deny: [PermissionFlagsBits.SendMessages], allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory] }
            ]
        }
    );
    if (isPaymentNew) {
        createdCount++;
        const paymentEmbed = createPaymentEmbed(guild.id);
        await chPayment.send({ embeds: [paymentEmbed] }).catch(() => {});
    } else {
        reusedCount++;
        const existing = await chPayment.messages.fetch({ limit: 5 }).catch(() => null);
        if (!existing || existing.size === 0) {
            const paymentEmbed = createPaymentEmbed(guild.id);
            await chPayment.send({ embeds: [paymentEmbed] }).catch(() => {});
        }
    }

    // 4. ห้องรีวิวและเครดิต (Reviews & Vouches)
    const { channel: chReviews, created: isReviewsNew } = await getOrCreateTextChannel(
        guild,
        '⭐-รีวิวและเครดิต',
        catShop.id,
        ['รีวิวและเครดิต', 'รีวิว', 'review', 'vouch']
    );
    db.setReviewChannel(guild.id, chReviews.id);
    if (isReviewsNew) {
        createdCount++;
        const reviewIntroEmbed = new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle('⭐ ห้องยืนยันเครดิตและรีวิวร้านค้า — Docomin Shop')
            .setDescription('ยินดีต้อนรับสู่ห้องรวมรีวิวและความน่าเชื่อถือของร้านค้า!\n\nลูกค้าที่สั่งซื้อสินค้าสำเร็จสามารถใช้คำสั่งด้านล่างเพื่อรีวิวและให้เครดิตร้านค้าได้ทันที:\n```\n/vouch seller:@พ่อค้า stars:5 comment:บริการดีมาก ส่งไว item:ชื่อสินค้า proof:ลิงก์รูปสลิป\n```\nบอทจะบันทึกคะแนนและส่งการ์ดรีวิวสวยงามลงในห้องนี้อัตโนมัติ!')
            .setFooter({ text: 'Docomin Shop Vouch System • ความน่าเชื่อถือ 100%' });

        await chReviews.send({ embeds: [reviewIntroEmbed] }).catch(() => {});
    } else {
        reusedCount++;
        const existing = await chReviews.messages.fetch({ limit: 5 }).catch(() => null);
        if (!existing || existing.size === 0) {
            const reviewIntroEmbed = new EmbedBuilder()
                .setColor(0xFEE75C)
                .setTitle('⭐ ห้องยืนยันเครดิตและรีวิวร้านค้า — Docomin Shop')
                .setDescription('ยินดีต้อนรับสู่ห้องรวมรีวิวและความน่าเชื่อถือของร้านค้า!\n\nลูกค้าที่สั่งซื้อสินค้าสำเร็จสามารถใช้คำสั่งด้านล่างเพื่อรีวิวและให้เครดิตร้านค้าได้ทันที:\n```\n/vouch seller:@พ่อค้า stars:5 comment:บริการดีมาก ส่งไว item:ชื่อสินค้า proof:ลิงก์รูปสลิป\n```\nบอทจะบันทึกคะแนนและส่งการ์ดรีวิวสวยงามลงในห้องนี้อัตโนมัติ!')
                .setFooter({ text: 'Docomin Shop Vouch System • ความน่าเชื่อถือ 100%' });

            await chReviews.send({ embeds: [reviewIntroEmbed] }).catch(() => {});
        }
    }

    // 5. ห้องเปิดตั๋วสั่งซื้อ (Order Desk)
    const { channel: chOrder, created: isOrderNew } = await getOrCreateTextChannel(
        guild,
        '🎫-เปิดตั๋วสั่งซื้อ',
        catShop.id,
        ['เปิดตั๋วสั่งซื้อ', 'สั่งซื้อ', 'order-desk', 'buy-ticket'],
        {
            permissionOverwrites: [
                { id: everyoneRole.id, deny: [PermissionFlagsBits.SendMessages], allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory] }
            ]
        }
    );
    if (isOrderNew) {
        createdCount++;
        const orderEmbed = createOrderDeskEmbed(guild.name);
        const orderBtns = createOrderDeskButtons();
        await chOrder.send({ embeds: [orderEmbed], components: [orderBtns] }).catch(() => {});
    } else {
        reusedCount++;
        const existing = await chOrder.messages.fetch({ limit: 5 }).catch(() => null);
        if (!existing || existing.size === 0) {
            const orderEmbed = createOrderDeskEmbed(guild.name);
            const orderBtns = createOrderDeskButtons();
            await chOrder.send({ embeds: [orderEmbed], components: [orderBtns] }).catch(() => {});
        }
    }

    // 6. ห้องแจ้งเตือนสต็อก (Restock)
    const { channel: chRestock, created: isRestockNew } = await getOrCreateTextChannel(
        guild,
        '📢-แจ้งเตือนสต็อก',
        catShop.id,
        ['แจ้งเตือนสต็อก', 'สต็อก', 'restock'],
        {
            permissionOverwrites: [
                { id: everyoneRole.id, deny: [PermissionFlagsBits.SendMessages], allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory] }
            ]
        }
    );
    if (isRestockNew) {
        createdCount++;
        const restockIntroEmbed = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('📢 ประกาศแจ้งเตือนสต็อกสินค้าเข้าใหม่')
            .setDescription('ห้องนี้จะใช้สำหรับการประกาศเมื่อมีสินค้าเข้าสต็อก เช่น ผลปีศาจถาวร, ไอดีไก่ตัน, Robux หรือโปรโมชั่นพิเศษจาก Docomin Shop!\n\nเปิดแจ้งเตือนห้องนี้ไว้เพื่อไม่พลาดสินค้าราคาพิเศษ!')
            .setFooter({ text: 'Docomin Shop Restock Watcher' });

        await chRestock.send({ embeds: [restockIntroEmbed] }).catch(() => {});
    } else {
        reusedCount++;
        const existing = await chRestock.messages.fetch({ limit: 5 }).catch(() => null);
        if (!existing || existing.size === 0) {
            const restockIntroEmbed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle('📢 ประกาศแจ้งเตือนสต็อกสินค้าเข้าใหม่')
                .setDescription('ห้องนี้จะใช้สำหรับการประกาศเมื่อมีสินค้าเข้าสต็อก เช่น ผลปีศาจถาวร, ไอดีไก่ตัน, Robux หรือโปรโมชั่นพิเศษจาก Docomin Shop!\n\nเปิดแจ้งเตือนห้องนี้ไว้เพื่อไม่พลาดสินค้าราคาพิเศษ!')
                .setFooter({ text: 'Docomin Shop Restock Watcher' });

            await chRestock.send({ embeds: [restockIntroEmbed] }).catch(() => {});
        }
    }

    // บันทึกการตั้งค่าร้านค้าลงฐานข้อมูล
    db.setShopSettings(guild.id, {
        catShopId: catShop.id,
        catalogId: chCatalog.id,
        paymentId: chPayment.id,
        reviewId: chReviews.id,
        orderId: chOrder.id,
        restockId: chRestock.id,
        updatedAt: Date.now()
    });

    const setupFinishEmbed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('🎉 ติดตั้งระบบร้านค้า Docomin Shop สำเร็จ! (Smart Duplicate Guard)')
        .setDescription(`ระบบได้ตรวจสอบและตั้งค่าระบบร้านค้าเรียบร้อยแล้ว โดยไม่สร้างห้องซ้ำซ้อน:\n\n` +
            `🔄 **นำห้องเดิมมาเชื่อมต่อและอัปเดต:** \`${reusedCount}\` ห้อง/หมวดหมู่\n` +
            `🆕 **สร้างห้องใหม่ที่ยังไม่มี:** \`${createdCount}\` ห้อง/หมวดหมู่\n\n` +
            `📌 **สถานะห้องของร้านค้า:**\n` +
            `• หมวดหมู่: **${catShop.name}**\n` +
            `• รายการสินค้า: ${chCatalog.toString()}\n` +
            `• ชำระเงิน: ${chPayment.toString()}\n` +
            `• รีวิวเครดิต: ${chReviews.toString()}\n` +
            `• เปิดตั๋วสั่งซื้อ: ${chOrder.toString()}\n` +
            `• แจ้งเตือนสต็อก: ${chRestock.toString()}`)
        .setFooter({ text: 'Docomin Shop System • Zero Duplicates Guaranteed' })
        .setTimestamp();

    await interaction.editReply({ content: '✨ จัดการระบบร้านค้าเรียบร้อยแล้ว!', embeds: [setupFinishEmbed] });

    return {
        catShop,
        chCatalog,
        chPayment,
        chReviews,
        chOrder,
        chRestock
    };
}

module.exports = {
    // EMVCo PromptPay & Payment
    crc16,
    generatePromptPayPayload,
    getQrImageUrl,
    createPaymentEmbed,
    createPaymentActionRow,
    createSetPaymentModal,
    createAngpaoModal,
    createApplyCouponModal,
    createDeliverProductModal,
    createDeliveryEmbed,
    createVouchModal,

    // Vouch & Reputation
    renderStars,
    renderProgressBar,
    createVouchEmbed,
    createReputationEmbed,
    createSalesSummaryEmbed,

    // Loyalty, Orders & Security
    createVipEmbed,
    createMyOrdersEmbed,
    createBlacklistEmbed,

    // Product Catalog
    CATEGORY_NAMES,
    createCatalogEmbed,
    createCatalogSelectMenu,

    // Order & Support Tickets
    createOrderDeskEmbed,
    createOrderDeskButtons,
    createBuyOrderModal,
    createInquiryModal,
    createClaimModal,
    createTicketActionButtons,

    // 1-Click Shop Setup
    runSetupDocominShop
};

