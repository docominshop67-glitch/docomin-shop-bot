const { 
    ChannelType, 
    PermissionFlagsBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder
} = require('discord.js');
const db = require('./db');

// สร้างแผงควบคุมห้องเสียงส่วนตัว (Interactive Control Panel)
function createVoiceControlPanel(ownerId, channelName) {
    const embed = new EmbedBuilder()
        .setTitle('🎙️ แผงควบคุมห้องเสียงส่วนตัว (Voice Master)')
        .setDescription(`👑 **เจ้าของห้อง:** <@${ownerId}>\n🔊 **ชื่อห้องปัจจุบัน:** \`${channelName}\`\n\nกดปุ่มด้านล่างเพื่อปรับแต่งการเข้าถึงห้องเสียงของคุณได้อย่างอิสระ:`)
        .setColor(0x5865F2)
        .addFields(
            { name: '🔒 ล็อก / ปลดล็อก', value: 'ป้องกันคนนอกเข้าห้อง', inline: true },
            { name: '👁️ ซ่อน / เปิดห้อง', value: 'ซ่อนห้องไม่ให้คนอื่นเห็น', inline: true },
            { name: '👥 จำกัดคน / เปลี่ยนชื่อ', value: 'ตั้งจำนวนคนหรือแก้ชื่อห้อง', inline: true }
        )
        .setFooter({ text: 'ห้องนี้จะถูกลบอัตโนมัติเมื่อทุกคนออกจากห้อง • Voice Master System' })
        .setTimestamp();

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('vm_lock').setLabel('🔒 ล็อกห้อง').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('vm_unlock').setLabel('🔓 ปลดล็อก').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('vm_hide').setLabel('👁️ ซ่อนห้อง').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('vm_unhide').setLabel('👁️‍🗨️ เปิดห้อง').setStyle(ButtonStyle.Success)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('vm_limit').setLabel('👥 จำกัดจำนวนคน').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('vm_rename').setLabel('🏷️ เปลี่ยนชื่อห้อง').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('vm_kick').setLabel('👢 เตะสมาชิก').setStyle(ButtonStyle.Danger)
    );

    return { embed, components: [row1, row2] };
}

// ตรวจสอบและจัดการอีเวนต์ voiceStateUpdate
async function handleVoiceStateUpdate(oldState, newState, client) {
    try {
        const guild = newState.guild || oldState.guild;
        if (!guild) return;

        const vmConfig = db.getVoiceMaster(guild.id);

        // 1. สมาชิกกดเข้าห้องแม่ "➕ คลิกเพื่อสร้างห้อง"
        if (vmConfig && newState.channelId === vmConfig.channelId) {
            const member = newState.member;
            if (!member) return;

            const categoryId = vmConfig.categoryId || newState.channel.parentId;
            const channelName = `🔊 ห้องของ ${member.displayName}`;

            // สร้างห้องเสียงชั่วคราว
            const tempChannel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildVoice,
                parent: categoryId,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak]
                    },
                    {
                        id: member.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.Connect,
                            PermissionFlagsBits.Speak,
                            PermissionFlagsBits.MoveMembers,
                            PermissionFlagsBits.ManageChannels
                        ]
                    }
                ]
            });

            // ย้ายสมาชิกเข้าห้องใหม่ทันที
            await member.voice.setChannel(tempChannel).catch(() => null);

            // บันทึกสถานะห้องชั่วคราวลง Database
            db.setTempVoice(tempChannel.id, {
                ownerId: member.id,
                guildId: guild.id,
                createdAt: Date.now(),
                locked: false,
                hidden: false
            });

            // ส่งแผงควบคุมเข้าช่องแชทข้อความของห้องเสียง
            const { embed, components } = createVoiceControlPanel(member.id, channelName);
            await tempChannel.send({
                content: `👋 ยินดีต้อนรับ <@${member.id}> เข้าสู่ห้องเสียงส่วนตัวของคุณ!`,
                embeds: [embed],
                components
            }).catch(() => null);
        }

        // 2. สมาชิกออกจากห้องเสียง -> ตรวจสอบว่าห้องชั่วคราวว่างหรือไม่
        if (oldState.channelId && oldState.channelId !== newState.channelId) {
            const tempInfo = db.getTempVoice(oldState.channelId);
            if (tempInfo) {
                const oldChannel = oldState.channel;
                if (oldChannel && oldChannel.members.size === 0) {
                    // ห้องว่างแล้ว -> ลบทันที
                    db.removeTempVoice(oldChannel.id);
                    await oldChannel.delete('Voice Master: ลบห้องชั่วคราวที่ไม่มีคนอยู่').catch(() => null);
                }
            }
        }
    } catch (err) {
        console.error('[VoiceMaster] Error in handleVoiceStateUpdate:', err.message);
    }
}

// จัดการปุ่มควบคุมห้องเสียง (Button Interaction)
async function handleVoiceButton(interaction) {
    const customId = interaction.customId;
    if (!customId.startsWith('vm_')) return false;

    const channel = interaction.channel;
    if (!channel || channel.type !== ChannelType.GuildVoice) {
        return interaction.reply({ content: '❌ คุณต้องใช้คำสั่งนี้ในห้องเสียงของคุณเท่านั้น', ephemeral: true });
    }

    const tempInfo = db.getTempVoice(channel.id);
    if (!tempInfo) {
        return interaction.reply({ content: '❌ ห้องนี้ไม่ใช่ห้องเสียงส่วนตัวของระบบ Voice Master', ephemeral: true });
    }

    const isOwner = tempInfo.ownerId === interaction.user.id;
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

    if (!isOwner && !isAdmin) {
        return interaction.reply({ content: '❌ มีเพียงเจ้าของห้องเสียงนี้เท่านั้นที่สามารถปรับแต่งได้!', ephemeral: true });
    }

    // --- 🔒 ล็อกห้อง ---
    if (customId === 'vm_lock') {
        await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
            Connect: false
        });
        tempInfo.locked = true;
        db.setTempVoice(channel.id, tempInfo);
        return interaction.reply({ content: '🔒 ล็อกห้องเรียบร้อย! สมาชิกทั่วไปไม่สามารถกดเข้าห้องได้แล้ว', ephemeral: true });
    }

    // --- 🔓 ปลดล็อกห้อง ---
    if (customId === 'vm_unlock') {
        await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
            Connect: null
        });
        tempInfo.locked = false;
        db.setTempVoice(channel.id, tempInfo);
        return interaction.reply({ content: '🔓 ปลดล็อกห้องเรียบร้อย! ทุกคนสามารถกดเข้าห้องได้ตามปกติ', ephemeral: true });
    }

    // --- 👁️ ซ่อนห้อง ---
    if (customId === 'vm_hide') {
        await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
            ViewChannel: false
        });
        tempInfo.hidden = true;
        db.setTempVoice(channel.id, tempInfo);
        return interaction.reply({ content: '👁️ ซ่อนห้องเรียบร้อย! สมาชิกคนอื่นจะไม่เห็นห้องนี้ในรายการห้อง', ephemeral: true });
    }

    // --- 👁️‍🗨️ เปิดห้อง ---
    if (customId === 'vm_unhide') {
        await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
            ViewChannel: null
        });
        tempInfo.hidden = false;
        db.setTempVoice(channel.id, tempInfo);
        return interaction.reply({ content: '👁️‍🗨️ แสดงห้องเรียบร้อย! ทุกคนสามารถมองเห็นห้องนี้ได้ตามปกติ', ephemeral: true });
    }

    // --- 👥 จำกัดจำนวนคน (Modal) ---
    if (customId === 'vm_limit') {
        const modal = new ModalBuilder()
            .setCustomId('modal_vm_limit')
            .setTitle('👥 จำกัดจำนวนคนในห้องเสียง');

        const limitInput = new TextInputBuilder()
            .setCustomId('limit_value')
            .setLabel('ระบุจำนวนคน (0 = ไม่จำกัด, สูงสุด 99)')
            .setPlaceholder('ตัวอย่าง: 4')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(2)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(limitInput));
        return interaction.showModal(modal);
    }

    // --- 🏷️ เปลี่ยนชื่อห้อง (Modal) ---
    if (customId === 'vm_rename') {
        const modal = new ModalBuilder()
            .setCustomId('modal_vm_rename')
            .setTitle('🏷️ เปลี่ยนชื่อห้องเสียง');

        const nameInput = new TextInputBuilder()
            .setCustomId('rename_value')
            .setLabel('ชื่อห้องใหม่ที่ต้องการ')
            .setPlaceholder('ตัวอย่าง: ตี้ลงดัน V4')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(50)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
        return interaction.showModal(modal);
    }

    // --- 👢 เตะสมาชิก (Select Menu) ---
    if (customId === 'vm_kick') {
        const membersInVoice = channel.members.filter(m => m.id !== interaction.user.id);
        if (membersInVoice.size === 0) {
            return interaction.reply({ content: 'ℹ️ ขณะนี้ไม่มีสมาชิกคนอื่นอยู่ในห้องเสียงของคุณ', ephemeral: true });
        }

        const options = membersInVoice.map(m => 
            new StringSelectMenuOptionBuilder()
                .setLabel(m.displayName)
                .setDescription(`ID: ${m.id}`)
                .setValue(m.id)
                .setEmoji('👤')
        );

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('select_vm_kick')
            .setPlaceholder('เลือกสมาชิกที่ต้องการเตะออกจากห้อง...')
            .addOptions(options.slice(0, 25));

        const row = new ActionRowBuilder().addComponents(selectMenu);
        return interaction.reply({ content: '👢 **เลือกสมาชิกที่ต้องการเตะออกจากห้องของคุณ:**', components: [row], ephemeral: true });
    }

    return false;
}

// จัดการ Modal ของ Voice Master
async function handleVoiceModal(interaction) {
    if (interaction.customId === 'modal_vm_limit') {
        const val = interaction.fields.getTextInputValue('limit_value');
        const limit = parseInt(val, 10);
        if (isNaN(limit) || limit < 0 || limit > 99) {
            return interaction.reply({ content: '❌ กรุณาระบุตัวเลขระหว่าง 0 ถึง 99 เท่านั้น', ephemeral: true });
        }

        await interaction.channel.setUserLimit(limit);
        return interaction.reply({ content: `✅ ตั้งค่าจำนวนคนในห้องเป็น: **${limit === 0 ? 'ไม่จำกัด' : limit + ' คน'}** สำเร็จ!`, ephemeral: true });
    }

    if (interaction.customId === 'modal_vm_rename') {
        const newName = interaction.fields.getTextInputValue('rename_value');
        await interaction.channel.setName(`🔊 ${newName}`);
        return interaction.reply({ content: `✅ เปลี่ยนชื่อห้องเป็น: **🔊 ${newName}** เรียบร้อยแล้ว!`, ephemeral: true });
    }

    return false;
}

// จัดการ Select Menu เตะสมาชิก
async function handleVoiceSelect(interaction) {
    if (interaction.customId === 'select_vm_kick') {
        const targetUserId = interaction.values[0];
        const member = await interaction.guild.members.fetch(targetUserId).catch(() => null);

        if (!member || !member.voice.channelId || member.voice.channelId !== interaction.channelId) {
            return interaction.reply({ content: '❌ สมาชิกคนนี้ไม่ได้อยู่ในห้องเสียงของคุณแล้ว', ephemeral: true });
        }

        // เตะออกจากห้องโดยตัดการเชื่อมต่อเสียง
        await member.voice.disconnect('เตะโดยเจ้าของห้องเสียง Voice Master').catch(() => null);
        return interaction.reply({ content: `👢 เตะ **${member.displayName}** ออกจากห้องเสียงเรียบร้อยแล้ว!`, ephemeral: true });
    }

    return false;
}

module.exports = {
    createVoiceControlPanel,
    handleVoiceStateUpdate,
    handleVoiceButton,
    handleVoiceModal,
    handleVoiceSelect
};
