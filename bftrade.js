const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// โหลดฐานข้อมูลมูลค่าผลปีศาจ
let VALUES_CATALOG = {};
const valuesPath = path.join(__dirname, 'bf_values.json');
const scratchPath = path.join('C:', 'Users', 'ACER', '.gemini', 'antigravity', 'brain', 'c39c62e1-d5f2-490b-9ed1-09c684e13262', 'scratch', 'bf_values.json');

if (fs.existsSync(valuesPath)) {
    VALUES_CATALOG = JSON.parse(fs.readFileSync(valuesPath, 'utf8'));
} else if (fs.existsSync(scratchPath)) {
    VALUES_CATALOG = JSON.parse(fs.readFileSync(scratchPath, 'utf8'));
    // คัดลอกมาไว้ในโปรเจกต์หลัก
    fs.writeFileSync(valuesPath, JSON.stringify(VALUES_CATALOG, null, 2));
}

// ฟังก์ชันค้นหาผลปีศาจจากชื่อหรือคำค้น
function findFruit(query) {
    if (!query) return null;
    const q = query.trim().toLowerCase();
    
    // ค้นหาตรงๆ
    for (const [key, f] of Object.entries(VALUES_CATALOG)) {
        if (key.toLowerCase() === q) return f;
        if (f.name.toLowerCase() === q) return f;
        if (f.thName && f.thName.toLowerCase() === q) return f;
    }
    
    // ค้นหาแบบบางส่วน (Partial Match)
    for (const [key, f] of Object.entries(VALUES_CATALOG)) {
        if (key.toLowerCase().includes(q)) return f;
        if (f.name.toLowerCase().includes(q)) return f;
        if (f.thName && f.thName.toLowerCase().includes(q)) return f;
    }

    return null;
}

// ฟอร์แมตตัวเลขมูลค่าให้เข้าใจง่าย (เช่น 30,000,000 -> 30M)
function formatValue(num) {
    if (!num || isNaN(num)) return '0';
    if (num >= 1000000000) {
        return (num / 1000000000).toFixed(2).replace(/\.00$/, '') + 'B';
    }
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(0) + 'K';
    }
    return num.toLocaleString();
}

// ฟอร์แมต Demand (1-10) เป็นดาว
function formatDemandStars(rating) {
    const r = Math.max(1, Math.min(10, Math.round(rating || 1)));
    const filled = '⭐'.repeat(r);
    return `${filled} (${r}/10)`;
}

// แปลง Trend เป็นข้อความภาษาไทยพร้อมอิโมจิ
function formatTrend(trend) {
    const t = (trend || 'Stable').toLowerCase();
    if (t.includes('overpaid')) return '🔥 **Overpaid** (คนยอมจ่ายเกินราคา)';
    if (t.includes('underpaid')) return '📉 **Underpaid** (ราคากำลังตก/คนกดราคา)';
    if (t.includes('fluctuating') || t.includes('unstable')) return '⚡ **Fluctuating** (ราคาผันผวน)';
    return '⚖️ **Stable** (ราคาเสถียร/คงที่)';
}

// สร้าง Embed ข้อมูลมูลค่าของผลปีศาจรายชิ้น
function createFruitValueEmbed(fruit) {
    const colorMap = {
        'Mythical': 0xED4245,
        'Legendary': 0x9B59B6,
        'Rare': 0x3498DB,
        'Uncommon': 0x2ECC71,
        'Common': 0x95A5A6
    };

    return new EmbedBuilder()
        .setTitle(`📊 ข้อมูลมูลค่าตลาดเทรด: ${fruit.name} (${fruit.thName || fruit.name})`)
        .setDescription(`ราคาและข้อมูลความต้องการอัปเดตล่าสุดจาก **Blox Fruits Values Database**`)
        .setColor(colorMap[fruit.rarity] || 0x5865F2)
        .setThumbnail(fruit.image)
        .addFields(
            { name: '💎 มูลค่าเทรดทั่วไป (Regular Value)', value: `💰 **${formatValue(fruit.regValue)}** (\`${fruit.regValue.toLocaleString()}\`)`, inline: true },
            { name: '🌟 มูลค่าผลถาวร (Permanent Value)', value: `✨ **${formatValue(fruit.permValue)}** (\`${fruit.permValue.toLocaleString()}\`)`, inline: true },
            { name: '📈 ความต้องการของตลาด (Demand)', value: formatDemandStars(fruit.regDemand), inline: false },
            { name: '📊 แนวโน้มราคา (Trend)', value: formatTrend(fruit.regTrend), inline: true },
            { name: '⚔️ เหมาะสำหรับ', value: `\`${fruit.bestUsedFor || 'PvP, Grinding'}\``, inline: true },
            { name: '🛒 ราคาในร้านค้า Dealer', value: `💵 ${fruit.beliPrice ? fruit.beliPrice.toLocaleString() + ' Beli' : 'N/A'} | 💎 ${fruit.robuxPrice ? fruit.robuxPrice.toLocaleString() + ' R$' : 'N/A'}`, inline: false }
        )
        .setFooter({ text: 'Blox Fruits Trade System • อัปเดตมูลค่าเรียลไทม์ 100%', iconURL: fruit.image })
        .setTimestamp();
}

// คำนวณผลการเทรดระหว่าง 2 ฝั่ง
function calculateTrade(side1Names = [], side2Names = []) {
    const side1Fruits = side1Names.map(findFruit).filter(Boolean);
    const side2Fruits = side2Names.map(findFruit).filter(Boolean);

    const side1Total = side1Fruits.reduce((sum, f) => sum + (f.regValue || 0), 0);
    const side2Total = side2Fruits.reduce((sum, f) => sum + (f.regValue || 0), 0);

    const diff = side2Total - side1Total;
    const diffPercent = side1Total > 0 ? ((diff / side1Total) * 100) : (side2Total > 0 ? 100 : 0);

    const side1AvgDemand = side1Fruits.length > 0 
        ? (side1Fruits.reduce((s, f) => s + (f.regDemand || 1), 0) / side1Fruits.length).toFixed(1)
        : 0;

    const side2AvgDemand = side2Fruits.length > 0 
        ? (side2Fruits.reduce((s, f) => s + (f.regDemand || 1), 0) / side2Fruits.length).toFixed(1)
        : 0;

    let verdict = 'FAIR';
    let verdictTitle = '';
    let verdictDesc = '';
    let color = 0xFEE75C;

    if (diffPercent >= 20) {
        verdict = 'MASSIVE_WIN';
        verdictTitle = '🟢 มหาชัยชนะ! (Massive Win)';
        verdictDesc = `คุณได้กำไรถึง **+${diffPercent.toFixed(1)}%** (+${formatValue(diff)})! **รีบกดรับเทรดทันที!**`;
        color = 0x57F287;
    } else if (diffPercent >= 5) {
        verdict = 'WIN';
        verdictTitle = '🟢 ได้เปรียบ (Win)';
        verdictDesc = `คุณได้กำไร **+${diffPercent.toFixed(1)}%** (+${formatValue(diff)}) การเทรดนี้คุ้มค่าที่จะกดรับ`;
        color = 0x57F287;
    } else if (diffPercent >= -5) {
        verdict = 'FAIR';
        verdictTitle = '🟡 ยุติธรรมทั้งสองฝ่าย (Fair Trade)';
        verdictDesc = `มูลค่าต่างกันเพียง **${Math.abs(diffPercent).toFixed(1)}%** เทรดได้ทั้งคู่ แฟร์มาก!`;
        color = 0xFEE75C;
    } else if (diffPercent >= -20) {
        verdict = 'LOSS';
        verdictTitle = '🔴 เสียเปรียบเล็กน้อย (Loss)';
        verdictDesc = `คุณขาดทุน **${diffPercent.toFixed(1)}%** (-${formatValue(Math.abs(diff))}) แนะนำให้ขอผลแถมเพิ่ม`;
        color = 0xED4245;
    } else {
        verdict = 'MASSIVE_LOSS';
        verdictTitle = '🔴 ขาดทุนยับเยิน! (Massive Loss)';
        verdictDesc = `คุณขาดทุนหนักมาก **${diffPercent.toFixed(1)}%** (-${formatValue(Math.abs(diff))}) **อย่ากดตกลงเด็ดขาด!**`;
        color = 0xED4245;
    }

    return {
        side1Fruits,
        side2Fruits,
        side1Total,
        side2Total,
        diff,
        diffPercent,
        side1AvgDemand,
        side2AvgDemand,
        verdict,
        verdictTitle,
        verdictDesc,
        color
    };
}

// สร้าง Embed วิเคราะห์ผลการเทรดแบบ 2 ฝั่ง
function createTradeEmbed(tradeData) {
    const formatList = (fruits) => {
        if (!fruits || fruits.length === 0) return '*ยังไม่มีผลในฝั่งนี้*';
        return fruits.map((f, i) => `**${i + 1}.** ${f.name} (${formatValue(f.regValue)}) | ความต้องการ: ${f.regDemand}/10`).join('\n');
    };

    const embed = new EmbedBuilder()
        .setTitle(`⚖️ Blox Fruits Trade Calculator • วิเคราะห์การเทรด`)
        .setDescription(`### ${tradeData.verdictTitle}\n${tradeData.verdictDesc}`)
        .setColor(tradeData.color)
        .addFields(
            {
                name: `👤 ฝั่งคุณเสนอ (${tradeData.side1Fruits.length} ผล)`,
                value: `${formatList(tradeData.side1Fruits)}\n\n💰 **มูลค่ารวม:** \`${formatValue(tradeData.side1Total)}\` (${tradeData.side1Total.toLocaleString()})\n📊 **ความต้องการเฉลี่ย:** \`${tradeData.side1AvgDemand}/10\``,
                inline: true
            },
            {
                name: `👥 ฝั่งเขาเสนอ (${tradeData.side2Fruits.length} ผล)`,
                value: `${formatList(tradeData.side2Fruits)}\n\n💰 **มูลค่ารวม:** \`${formatValue(tradeData.side2Total)}\` (${tradeData.side2Total.toLocaleString()})\n📊 **ความต้องการเฉลี่ย:** \`${tradeData.side2AvgDemand}/10\``,
                inline: true
            },
            {
                name: '📊 สรุปความต่างของมูลค่า',
                value: `ส่วนต่าง: **${tradeData.diff >= 0 ? '+' : ''}${formatValue(tradeData.diff)}** (${tradeData.diff >= 0 ? '+' : ''}${tradeData.diffPercent.toFixed(1)}%)\n*เปรียบเทียบตามมาตรฐานมูลค่า Blox Fruits สากล*`,
                inline: false
            }
        )
        .setFooter({ text: 'Blox Fruits Real-Time Value Engine • ข้อมูลจริงจากตลาดเทรด' })
        .setTimestamp();

    if (tradeData.side1Fruits[0]) {
        embed.setThumbnail(tradeData.side1Fruits[0].image);
    }

    return embed;
}

// สร้าง Dropdown สำหรับเลือกผลในคำนวณการเทรด
function createTradeSelectMenu(customId, placeholder, currentSelected = []) {
    const popularKeys = [
        'Kitsune', 'West Dragon', 'East Dragon', 'Control', 'Yeti', 'Gas', 'Tiger',
        'Dough', 'T-Rex', 'Mammoth', 'Spirit', 'Venom', 'Shadow', 'Gravity',
        'Portal', 'Buddha', 'Blizzard', 'Sound', 'Phoenix', 'Rumble', 'Lightning',
        'Magma', 'Quake', 'Light', 'Ice', 'Dark', 'Sand'
    ];

    const options = [];
    for (const key of popularKeys) {
        const fruit = VALUES_CATALOG[key];
        if (fruit) {
            const emoji = fruit.rarity === 'Mythical' ? '🔴' : (fruit.rarity === 'Legendary' ? '🟣' : '🔵');
            options.push(
                new StringSelectMenuOptionBuilder()
                    .setLabel(`${fruit.name} (ค่า: ${formatValue(fruit.regValue)})`)
                    .setDescription(`สาย ${fruit.fruitType} | Demand: ${fruit.regDemand}/10`)
                    .setValue(fruit.name)
                    .setEmoji(emoji)
                    .setDefault(currentSelected.includes(fruit.name))
            );
        }
    }

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(customId)
        .setPlaceholder(placeholder)
        .setMinValues(1)
        .setMaxValues(Math.min(4, options.length))
        .addOptions(options.slice(0, 25));

    return new ActionRowBuilder().addComponents(selectMenu);
}

module.exports = {
    VALUES_CATALOG,
    findFruit,
    formatValue,
    createFruitValueEmbed,
    calculateTrade,
    createTradeEmbed,
    createTradeSelectMenu
};
