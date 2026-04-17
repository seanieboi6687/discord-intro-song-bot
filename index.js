require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');
const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus
} = require('@discordjs/voice');

const path = require('path');
const ffmpeg = require('ffmpeg-static');

process.env.FFMPEG_PATH = ffmpeg;

// 🎵 USER SOUND MAP
const userSounds = {
    "477577044893368333": "Tim.mp3",
    "210935568549232642": "Calvin.mp3",
    "239205332470071298": "David.mp3",
    "214595568549232642": "Sean.mp3",
    "210548747975786496": "Lew.mp3",
    "520650679497523201": "Shi.mp3"
};

const TOKEN = process.env.TOKEN;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers
    ]
});

// 🧠 STATE STORAGE PER GUILD
const state = new Map();

/* ----------------------------------------
   READY
---------------------------------------- */
client.once('clientReady', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

/* ----------------------------------------
   VOICE EVENTS (JOIN TRIGGER SOUND)
---------------------------------------- */
client.on('voiceStateUpdate', async (oldState, newState) => {
    try {
        // Only care about joins
        if (!oldState.channelId && newState.channelId) {

            const guildId = newState.guild.id;
            const userId = newState.member.id;
            const soundFile = userSounds[userId];

            if (!soundFile) return;

            // Get or create guild state
            let guild = state.get(guildId);

            if (!guild) {
                const connection = joinVoiceChannel({
                    channelId: newState.channel.id,
                    guildId,
                    adapterCreator: newState.guild.voiceAdapterCreator,
                    selfDeaf: false,
                    selfMute: false
                });

                guild = {
                    connection,
                    player: null,
                    channelId: newState.channel.id
                };

                state.set(guildId, guild);
            }

            // ⚡ INTERRUPT CURRENT AUDIO
            if (guild.player) {
                try {
                    guild.player.stop(true);
                } catch {}
            }

            // 🎧 NEW PLAYER
            const player = createAudioPlayer({
                behaviors: {
                    noSubscriber: 'play'
                }
            });

            guild.player = player;

            const resource = createAudioResource(
                path.join(__dirname, 'sounds', soundFile)
            );

            player.play(resource);
            guild.connection.subscribe(player);

            // 🧼 CLEANUP AFTER PLAYBACK
            player.on(AudioPlayerStatus.Idle, () => {
                guild.player = null;
            });

            player.on('error', () => {
                guild.player = null;
            });
        }
    } catch (err) {
        console.error(err);
    }
});

/* ----------------------------------------
   AUTO-LEAVE WHEN VC IS EMPTY
---------------------------------------- */
client.on('voiceStateUpdate', async (oldState, newState) => {
    try {
        const guildId = newState.guild.id;
        const guild = state.get(guildId);

        if (!guild?.connection) return;

        const channel = newState.guild.channels.cache.get(guild.channelId);
        if (!channel) return;

        // Count NON-BOT users
        const humanCount = channel.members.filter(m => !m.user.bot).size;

        if (humanCount === 0) {
            try {
                guild.connection.destroy();
                state.delete(guildId);
                console.log("VC empty → bot left");
            } catch {}
        }

    } catch (err) {
        console.error(err);
    }
});

/* ----------------------------------------
   LOGIN
---------------------------------------- */
client.login(TOKEN);