const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    VoiceConnectionStatus,
    entersState,
    StreamType
} = require('@discordjs/voice');
const { spawn } = require('child_process');
const path = require('path');
const ffmpegPath = require('ffmpeg-static');
const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder
} = require('discord.js');

// เก็บ Queue ของแต่ละเซิร์ฟเวอร์
const queues = new Map();
// แคชสำหรับเก็บผลการค้นหาชั่วคราว
const searchCache = new Map();

// ค้นหาวิดีโอผ่าน yt-dlp
function searchVideos(query, limit = 5) {
    return new Promise((resolve) => {
        const ytdl = spawn(path.join(__dirname, 'yt-dlp.exe'), [
            '--no-check-certificates',
            `ytsearch${limit}:${query}`,
            '--print', '%(title)s|||%(webpage_url)s|||%(duration_string)s|||%(channel)s|||%(thumbnail)s'
        ]);

        let output = '';
        ytdl.stdout.on('data', d => output += d);
        ytdl.on('close', () => {
            const lines = output.trim().split('\n').filter(l => l.includes('|||'));
            const results = lines.map(line => {
                const parts = line.split('|||');
                return {
                    title: parts[0]?.trim() || 'Unknown Title',
                    url: parts[1]?.trim() || '',
                    durationRaw: parts[2]?.trim() || 'Live',
                    channelName: parts[3]?.trim() || 'YouTube',
                    thumbnail: parts[4]?.trim() || ''
                };
            });
            resolve(results);
        });
        ytdl.on('error', (err) => {
            console.error('searchVideos error:', err);
            resolve([]);
        });
    });
}

// ดึงข้อมูลวิดีโอจาก URL โดยตรง
function getVideoDetails(url) {
    return new Promise((resolve) => {
        const ytdl = spawn(path.join(__dirname, 'yt-dlp.exe'), [
            '--no-check-certificates',
            '--print', '%(title)s|||%(webpage_url)s|||%(duration_string)s|||%(channel)s|||%(thumbnail)s',
            url
        ]);

        let output = '';
        ytdl.stdout.on('data', d => output += d);
        ytdl.on('close', () => {
            const lines = output.trim().split('\n').filter(l => l.includes('|||'));
            if (lines.length > 0) {
                const parts = lines[0].split('|||');
                resolve({
                    title: parts[0]?.trim() || 'Unknown Title',
                    url: parts[1]?.trim() || url,
                    durationRaw: parts[2]?.trim() || 'Live',
                    channelName: parts[3]?.trim() || 'YouTube',
                    thumbnail: parts[4]?.trim() || ''
                });
            } else {
                resolve(null);
            }
        });
        ytdl.on('error', () => resolve(null));
    });
}

// สร้าง Audio Resource ด้วยการ Pipe จาก yt-dlp -> ffmpeg -> Discord Voice
function createPCMResource(url) {
    const ytdlProcess = spawn(path.join(__dirname, 'yt-dlp.exe'), [
        '--no-check-certificates',
        '-f', 'bestaudio',
        '-o', '-',
        url
    ], { stdio: ['ignore', 'pipe', 'ignore'] });

    const ffmpegProcess = spawn(ffmpegPath, [
        '-i', 'pipe:0',
        '-f', 's16le',
        '-ar', '48000',
        '-ac', '2',
        'pipe:1'
    ], { stdio: ['pipe', 'pipe', 'ignore'] });

    ytdlProcess.stdout.pipe(ffmpegProcess.stdin);

    const resource = createAudioResource(ffmpegProcess.stdout, {
        inputType: StreamType.Raw
    });

    const cleanup = () => {
        try { ytdlProcess.kill(); } catch {}
        try { ffmpegProcess.kill(); } catch {}
    };

    return { resource, cleanup };
}

function getControllerButtons(isPaused = false) {
    const pauseBtn = new ButtonBuilder()
        .setCustomId('btn_music_pause_resume')
        .setLabel(isPaused ? '▶️ เล่นต่อ' : '⏸️ หยุดชั่วคราว')
        .setStyle(isPaused ? ButtonStyle.Success : ButtonStyle.Secondary);

    const skipBtn = new ButtonBuilder()
        .setCustomId('btn_music_skip')
        .setLabel('⏭️ ข้ามเพลง')
        .setStyle(ButtonStyle.Primary);

    const stopBtn = new ButtonBuilder()
        .setCustomId('btn_music_stop')
        .setLabel('⏹️ หยุด & ออก')
        .setStyle(ButtonStyle.Danger);

    const queueBtn = new ButtonBuilder()
        .setCustomId('btn_music_queue')
        .setLabel('📜 คิวเพลง')
        .setStyle(ButtonStyle.Secondary);

    const searchBtn = new ButtonBuilder()
        .setCustomId('btn_music_search_modal')
        .setLabel('🔍 ค้นหาเพลงใหม่')
        .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder().addComponents(pauseBtn, skipBtn, stopBtn, queueBtn, searchBtn);
    return [row];
}

async function playNextSong(guildId) {
    const queue = queues.get(guildId);
    if (!queue) return;

    if (queue.currentProcess) {
        queue.currentProcess.cleanup();
        queue.currentProcess = null;
    }

    if (queue.songs.length === 0) {
        queue.playing = false;
        if (queue.textChannel) {
            queue.textChannel.send('🎵 เล่นเพลงหมดคิวแล้ว! กดปุ่ม **"🔍 ค้นหาเพลงใหม่"** ด้านล่างเพื่อเปิดเพลงต่อได้เลย').catch(() => {});
        }
        return;
    }

    const song = queue.songs[0];
    try {
        const { resource, cleanup } = createPCMResource(song.url);
        queue.currentProcess = { cleanup };

        queue.player.play(resource);
        queue.playing = true;
        queue.isPaused = false;

        const embed = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('🎶 กำลังเล่นเพลง (Now Playing)')
            .setDescription(`[**${song.title}**](${song.url})`)
            .addFields(
                { name: '⏱️ ความยาว', value: song.durationRaw || 'ไม่ระบุ', inline: true },
                { name: '📺 ช่อง', value: song.channelName || 'YouTube', inline: true },
                { name: '👤 ขอโดย', value: `<@${song.requestedBy.id}>`, inline: true },
                { name: '📊 เพลงในคิว', value: `${queue.songs.length - 1} เพลง`, inline: true }
            )
            .setFooter({ text: 'Music Player Engine v2.0' });

        if (song.thumbnail) {
            embed.setThumbnail(song.thumbnail);
        }

        const rows = getControllerButtons(false);
        queue.textChannel.send({ embeds: [embed], components: rows }).catch(() => {});
    } catch (err) {
        console.error('Error in playNextSong:', err);
        if (queue.textChannel) {
            queue.textChannel.send(`❌ ไม่สามารถเล่นเพลง: **${song.title}** (${err.message})`).catch(() => {});
        }
        queue.songs.shift();
        playNextSong(guildId);
    }
}

function ensureVoiceConnection(interaction, voiceChannel) {
    let queue = queues.get(interaction.guildId);
    if (!queue) {
        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: interaction.guildId,
            adapterCreator: interaction.guild.voiceAdapterCreator
        });

        const player = createAudioPlayer();

        player.on(AudioPlayerStatus.Idle, () => {
            const currentQueue = queues.get(interaction.guildId);
            if (currentQueue && currentQueue.songs.length > 0) {
                currentQueue.songs.shift();
                playNextSong(interaction.guildId);
            }
        });

        player.on('error', error => {
            console.error('Audio Player Error:', error.message);
            const currentQueue = queues.get(interaction.guildId);
            if (currentQueue && currentQueue.songs.length > 0) {
                currentQueue.songs.shift();
                playNextSong(interaction.guildId);
            }
        });

        connection.subscribe(player);

        connection.on(VoiceConnectionStatus.Disconnected, async () => {
            try {
                await Promise.race([
                    entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                    entersState(connection, VoiceConnectionStatus.Connecting, 5_000)
                ]);
            } catch {
                if (queue && queue.currentProcess) {
                    queue.currentProcess.cleanup();
                }
                queues.delete(interaction.guildId);
                connection.destroy();
            }
        });

        queue = {
            voiceChannel,
            textChannel: interaction.channel,
            connection,
            player,
            songs: [],
            playing: false,
            isPaused: false,
            currentProcess: null
        };

        queues.set(interaction.guildId, queue);
    }
    return queue;
}

const music = {
    // ค้นหาเพลงและส่ง Dropdown Menu ให้เลือก
    async searchAndSelect(interaction, query) {
        const member = interaction.member;
        const voiceChannel = member?.voice?.channel;

        if (!voiceChannel) {
            const msg = '❌ คุณต้องเข้าห้องเสียง (Voice Channel) ก่อนค้นหาหรือเปิดเพลง!';
            return interaction.replied || interaction.deferred
                ? interaction.editReply({ content: msg })
                : interaction.reply({ content: msg, ephemeral: true });
        }

        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply();
        }

        const searchResults = await searchVideos(query, 5);
        if (!searchResults || searchResults.length === 0) {
            return interaction.editReply(`❌ ไม่พบผลลัพธ์เพลงสำหรับ: **${query}**`);
        }

        const searchId = `${interaction.user.id}_${Date.now()}`;
        searchCache.set(searchId, {
            results: searchResults,
            user: interaction.user,
            voiceChannel
        });

        const selectOptions = searchResults.map((video, idx) => {
            const labelTitle = video.title.length > 80 ? video.title.substring(0, 77) + '...' : video.title;
            return new StringSelectMenuOptionBuilder()
                .setLabel(`${idx + 1}. ${labelTitle}`)
                .setDescription(`⏱️ ความยาว: ${video.durationRaw} | 📺 ${video.channelName}`)
                .setValue(`${searchId}_${idx}`);
        });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('menu_select_music')
            .setPlaceholder('🎵 กรุณาเลือกเพลงที่คุณต้องการเปิดจากรายการ...')
            .addOptions(selectOptions);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(`🔍 ผลการค้นหาเพลง: "${query}"`)
            .setDescription('กรุณาเลือกเพลงจาก **เมนูเลือกเพลงด้านล่าง**\nเมื่อเลือกแล้วจะมีตัวเลือกว่าต้องการ **"เล่นทันที (ข้ามเพลงปัจจุบัน)"** หรือ **"เพิ่มเข้าคิว"**')
            .setFooter({ text: 'เลือกเพลงภายใน 60 วินาที' });

        return interaction.editReply({ embeds: [embed], components: [row] });
    },

    // เมื่อผู้ใช้เลือกเพลงจาก Dropdown -> ถามว่าจะเล่นทันที หรือ เข้าคิว
    handleSelectMenu(interaction) {
        const [searchId, indexStr] = interaction.values[0].split('_');
        const searchData = searchCache.get(searchId);

        if (!searchData) {
            return interaction.reply({ content: '⚠️ ผลการค้นหานี้หมดอายุแล้ว กรุณาค้นหาใหม่อีกครั้ง', ephemeral: true });
        }

        const idx = parseInt(indexStr);
        const song = searchData.results[idx];
        if (!song) {
            return interaction.reply({ content: '❌ ไม่พบข้อมูลเพลงที่เลือก', ephemeral: true });
        }

        const choiceId = `choice_${interaction.user.id}_${Date.now()}`;
        searchCache.set(choiceId, {
            song: {
                title: song.title,
                url: song.url,
                durationRaw: song.durationRaw,
                channelName: song.channelName,
                thumbnail: song.thumbnail,
                requestedBy: interaction.user
            },
            voiceChannel: searchData.voiceChannel
        });

        const embed = new EmbedBuilder()
            .setColor(0x00A2FF)
            .setTitle('🎯 คุณได้เลือกเพลง:')
            .setDescription(`[**${song.title}**](${song.url})\n⏱️ ความยาว: **${song.durationRaw}**\n📺 ช่อง: **${song.channelName}**`)
            .setFooter({ text: 'เลือกรูปแบบการเปิดเพลงด้านล่าง' });

        if (song.thumbnail) {
            embed.setThumbnail(song.thumbnail);
        }

        const playNowBtn = new ButtonBuilder()
            .setCustomId(`btn_music_mode_playnow_${choiceId}`)
            .setLabel('▶️ เล่นทันที (ข้ามเพลงปัจจุบัน)')
            .setStyle(ButtonStyle.Success);

        const queueBtn = new ButtonBuilder()
            .setCustomId(`btn_music_mode_queue_${choiceId}`)
            .setLabel('📥 เพิ่มเข้าคิว (ต่อท้าย)')
            .setStyle(ButtonStyle.Primary);

        const cancelBtn = new ButtonBuilder()
            .setCustomId('btn_music_mode_cancel')
            .setLabel('❌ ยกเลิก')
            .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents(playNowBtn, queueBtn, cancelBtn);

        return interaction.update({ embeds: [embed], components: [row] });
    },

    // จัดการเริ่มเล่นตามโหมด (playnow / queue)
    async executeChosenMode(interaction, choiceId, mode) {
        const choiceData = searchCache.get(choiceId);
        if (!choiceData) {
            return interaction.update({ content: '⚠️ รายการเพลงนี้หมดอายุแล้ว กรุณาเลือกใหม่อีกครั้ง', embeds: [], components: [] });
        }

        const member = interaction.member;
        const voiceChannel = member?.voice?.channel || choiceData.voiceChannel;

        if (!voiceChannel) {
            return interaction.update({ content: '❌ คุณต้องอยู่ในห้องเสียงก่อนเปิดเพลง!', embeds: [], components: [] });
        }

        const queue = ensureVoiceConnection(interaction, voiceChannel);
        const songInfo = choiceData.song;

        if (mode === 'playnow') {
            if (queue.playing) {
                queue.songs.splice(1, 0, songInfo);
                queue.player.stop();
                await interaction.update({
                    content: `⚡ **ข้ามเพลงปัจจุบันและเริ่มเล่นทันที:** [${songInfo.title}](${songInfo.url})`,
                    embeds: [],
                    components: []
                });
            } else {
                queue.songs.push(songInfo);
                await interaction.update({
                    content: `▶️ **กำลังเริ่มเล่นเพลง:** [${songInfo.title}](${songInfo.url})`,
                    embeds: [],
                    components: []
                });
                playNextSong(interaction.guildId);
            }
        } else if (mode === 'queue') {
            queue.songs.push(songInfo);
            if (!queue.playing) {
                await interaction.update({
                    content: `▶️ **กำลังเริ่มเล่นเพลง:** [${songInfo.title}](${songInfo.url})`,
                    embeds: [],
                    components: []
                });
                playNextSong(interaction.guildId);
            } else {
                await interaction.update({
                    content: `📥 **เพิ่มเข้าคิวเรียบร้อย:** [${songInfo.title}](${songInfo.url}) (ลำดับคิวที่ #${queue.songs.length})`,
                    embeds: [],
                    components: []
                });
            }
        }
        searchCache.delete(choiceId);
    },

    // คำสั่ง /play
    async executePlay(interaction, query) {
        const member = interaction.member;
        const voiceChannel = member?.voice?.channel;

        if (!voiceChannel) {
            const msg = '❌ คุณต้องเข้าห้องเสียง (Voice Channel) ก่อนใช้คำสั่งเปิดเพลง!';
            return interaction.replied || interaction.deferred
                ? interaction.editReply({ content: msg })
                : interaction.reply({ content: msg, ephemeral: true });
        }

        const permissions = voiceChannel.permissionsFor(interaction.client.user);
        if (!permissions.has('Connect') || !permissions.has('Speak')) {
            const msg = '❌ บอทไม่มีสิทธิ์เข้าห้องเสียงหรือเปิดไมค์ในห้องนี้ (ต้องการสิทธิ์ Connect และ Speak)';
            return interaction.replied || interaction.deferred
                ? interaction.editReply({ content: msg })
                : interaction.reply({ content: msg, ephemeral: true });
        }

        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply();
        }

        const isDirectUrl = query.startsWith('http://') || query.startsWith('https://');

        if (isDirectUrl) {
            const details = await getVideoDetails(query);
            if (!details) {
                return interaction.editReply('❌ ไม่สามารถดึงข้อมูลเพลงจากลิงก์ดังกล่าวได้');
            }

            const songInfo = {
                title: details.title,
                url: details.url,
                durationRaw: details.durationRaw,
                channelName: details.channelName,
                thumbnail: details.thumbnail,
                requestedBy: interaction.user
            };

            const queue = ensureVoiceConnection(interaction, voiceChannel);
            queue.songs.push(songInfo);

            if (!queue.playing) {
                await interaction.editReply(`▶️ กำลังเริ่มเล่นเพลง: **${songInfo.title}**`);
                playNextSong(interaction.guildId);
            } else {
                const embed = new EmbedBuilder()
                    .setColor(0x5865F2)
                    .setTitle('📥 เพิ่มเพลงเข้าคิวเรียบร้อย!')
                    .setDescription(`[**${songInfo.title}**](${songInfo.url})`)
                    .addFields(
                        { name: '⏱️ ความยาว', value: songInfo.durationRaw || 'ไม่ระบุ', inline: true },
                        { name: '🔢 ลำดับคิว', value: `#${queue.songs.length}`, inline: true },
                        { name: '👤 ขอโดย', value: `<@${interaction.user.id}>`, inline: true }
                    );

                if (songInfo.thumbnail) {
                    embed.setThumbnail(songInfo.thumbnail);
                }

                return interaction.editReply({ embeds: [embed] });
            }
        } else {
            return this.searchAndSelect(interaction, query);
        }
    },

    // ส่งแผงควบคุมเพลง (Music Dashboard)
    async sendMusicPanel(channel) {
        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('🎧 ศูนย์ควบคุมและเปิดเพลง (Music Dashboard)')
            .setDescription('กดปุ่ม **"🔍 ค้นหา / เปิดเพลง"** ด้านล่างเพื่อพิมพ์ชื่อเพลง แล้วจะมีเมนูเลือกเพลงและเลือกว่าจะ **"เล่นทันที"** หรือ **"เข้าคิว"**')
            .addFields(
                { name: '🔍 ค้นหาเพลง', value: 'กดปุ่มเปิดกล่องค้นหาเพลงจาก YouTube', inline: true },
                { name: '🎛️ ควบคุมเพลง', value: 'ปุ่มกด พัก/เล่นต่อ, ข้ามเพลง, ดูคิว, หยุดและออก', inline: true }
            )
            .setFooter({ text: 'Music Control Center' });

        const searchBtn = new ButtonBuilder()
            .setCustomId('btn_music_search_modal')
            .setLabel('🔍 ค้นหา / เปิดเพลง')
            .setStyle(ButtonStyle.Success);

        const pauseBtn = new ButtonBuilder()
            .setCustomId('btn_music_pause_resume')
            .setLabel('⏯️ พัก / เล่นต่อ')
            .setStyle(ButtonStyle.Secondary);

        const skipBtn = new ButtonBuilder()
            .setCustomId('btn_music_skip')
            .setLabel('⏭️ ข้ามเพลง')
            .setStyle(ButtonStyle.Primary);

        const queueBtn = new ButtonBuilder()
            .setCustomId('btn_music_queue')
            .setLabel('📜 ดูคิวเพลง')
            .setStyle(ButtonStyle.Secondary);

        const stopBtn = new ButtonBuilder()
            .setCustomId('btn_music_stop')
            .setLabel('⏹️ หยุด & ออก')
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(searchBtn, pauseBtn, skipBtn, queueBtn, stopBtn);
        return channel.send({ embeds: [embed], components: [row] });
    },

    skip(guildId) {
        const queue = queues.get(guildId);
        if (!queue || !queue.playing) return false;
        queue.player.stop();
        return true;
    },

    stop(guildId) {
        const queue = queues.get(guildId);
        if (!queue) return false;
        if (queue.currentProcess) {
            queue.currentProcess.cleanup();
            queue.currentProcess = null;
        }
        queue.songs = [];
        queue.player.stop();
        if (queue.connection) {
            queue.connection.destroy();
        }
        queues.delete(guildId);
        return true;
    },

    pauseOrResume(guildId) {
        const queue = queues.get(guildId);
        if (!queue || !queue.playing) return null;

        if (queue.isPaused) {
            queue.player.unpause();
            queue.isPaused = false;
            return 'resumed';
        } else {
            queue.player.pause();
            queue.isPaused = true;
            return 'paused';
        }
    },

    getQueue(guildId) {
        return queues.get(guildId);
    }
};

module.exports = music;
