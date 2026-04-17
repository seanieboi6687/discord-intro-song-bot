require('dotenv').config();

process.env.DISCORD_VOICE_DISABLE_IP_DISCOVERY = "true";

const { Client, GatewayIntentBits } = require('discord.js');
const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    VoiceConnectionStatus
} = require('@discordjs/voice');

const path = require('path');
const ffmpeg = require('ffmpeg-static');

process.env.FFMPEG_PATH = ffmpeg;

// 🎵 SOUND MAP
const userSounds = {
    "477577044893368333": "Tim.mp3",
    "210935568549232642": "Calvin.mp3",
    "239205332470071298": "David.mp3",
    "214595568549232642": "Sean.mp3"
};

const TOKEN = process.env.TOKEN;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers
    ]
});

// 🧠 STATE TRACKING
const activeConnections = new Map();
const activePlayers = new Map();
const destroyedConnections = new Set();

// 🧼 SAFE DESTROY (NO DOUBLE CRASH)
function safeDestroy(connection, guildId) {
    if (!connection || destroyedConnections.has(guildId)) return;

    destroyedConnections.add(guildId);

    try {
        connection.destroy();
    } catch {}

    activeConnections.delete(guildId);
    activePlayers.delete(guildId);

    setTimeout(() => destroyedConnections.delete(guildId), 5000);
}

// 🛑 GLOBAL ERROR SAFETY (IMPORTANT FOR RAILWAY)
process.on('uncaughtException', (err) => {
    console.error("UNCAUGHT:", err);
});

process.on('unhandledRejection', (err) => {
    console.error("PROMISE ERROR:", err);
});

// 🚀 LOGIN (NO DELAY NEEDED NOW)
client.login(TOKEN);

client.once('clientReady', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    try {

        // ONLY JOIN EVENTS
        if (!oldState.channelId && newState.channelId) {

            const guildId = newState.guild.id;
            const userId = newState.member.id;
            const soundFile = userSounds[userId];

            if (!soundFile) return;

            // ⚡ INTERRUPT CURRENT AUDIO
            if (activePlayers.has(guildId)) {
                try {
                    activePlayers.get(guildId).stop(true);
                } catch {}
            }

            // 🔗 GET OR CREATE CONNECTION (NO entersState!)
            let connection = activeConnections.get(guildId);

            if (!connection) {
                connection = joinVoiceChannel({
                    channelId: newState.channel.id,
                    guildId,
                    adapterCreator: newState.guild.voiceAdapterCreator,
                    selfDeaf: false,
                    selfMute: false
                });

                activeConnections.set(guildId, connection);

                // NON-BLOCKING READY HANDLER
                connection.on(VoiceConnectionStatus.Ready, () => {
                    console.log("Voice connection ready");
                });

                connection.on('error', (err) => {
                    console.error("Voice connection error:", err);
                    safeDestroy(connection, guildId);
                });
            }

            // 🎧 CREATE PLAYER
            const player = createAudioPlayer({
                behaviors: {
                    noSubscriber: 'play'
                }
            });

            activePlayers.set(guildId, player);

            const resource = createAudioResource(
                path.join(__dirname, 'sounds', soundFile)
            );

            player.play(resource);
            connection.subscribe(player);

            // 🧼 CLEANUP AFTER PLAYBACK
            player.on(AudioPlayerStatus.Idle, () => {
                setTimeout(() => {
                    safeDestroy(connection, guildId);
                }, 1000);
            });

            // ❌ ERROR HANDLING
            player.on('error', () => {
                safeDestroy(connection, guildId);
            });
        }

    } catch (err) {
        console.error("VOICE ERROR:", err);
    }
});