require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');
const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    VoiceConnectionStatus,
    entersState
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

// 🧠 STATE
const activeConnections = new Map();
const activePlayers = new Map();
const destroyedConnections = new Set();

// 🧼 SAFE DESTROY (ONLY ONE CLEANUP PATH)
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

client.once('clientReady', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    try {
        // ONLY handle joins
        if (!oldState.channelId && newState.channelId) {

            const guildId = newState.guild.id;
            const userId = newState.member.id;
            const soundFile = userSounds[userId];

            if (!soundFile) return;

            // ⚡ INTERRUPT CURRENT AUDIO (if any)
            if (activePlayers.has(guildId)) {
                const oldPlayer = activePlayers.get(guildId);
                try {
                    oldPlayer.stop(true);
                } catch {}
            }

            // 🔗 REUSE OR CREATE CONNECTION
            let connection = activeConnections.get(guildId);

            if (!connection) {
                connection = joinVoiceChannel({
                    channelId: newState.channel.id,
                    guildId,
                    adapterCreator: newState.guild.voiceAdapterCreator,
                    selfDeaf: false,
                    selfMute: false,
                });

                activeConnections.set(guildId, connection);

                await entersState(connection, VoiceConnectionStatus.Ready, 15000);
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

            // 🧼 CLEANUP ON FINISH
            player.on(AudioPlayerStatus.Idle, () => {
                activePlayers.delete(guildId);

                setTimeout(() => {
                    safeDestroy(connection, guildId);
                }, 1000);
            });

            // ❌ ERROR HANDLING
            player.on('error', () => {
                activePlayers.delete(guildId);
                safeDestroy(connection, guildId);
            });

            connection.on('error', () => {
                safeDestroy(connection, guildId);
            });
        }
    } catch (err) {
        console.error(err);
    }
});

client.login(TOKEN);