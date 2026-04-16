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

// SOUND MAP
const userSounds = {
    "477577044893368333": "Tim.mp3",
    "214595568549232642": "Calvin.mp3",
    "239205332470071298": "David.mp3"
};

const TOKEN = process.env.TOKEN;
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers
    ]
});

// Active state tracking
const activeConnections = new Map();
const activePlayers = new Map();

client.once('clientReady', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    try {
        if (!oldState.channelId && newState.channelId) {

            const guildId = newState.guild.id;
            const userId = newState.member.id;
            const soundFile = userSounds[userId];

            if (!soundFile) return;

            if (activePlayers.has(guildId)) {
                const oldPlayer = activePlayers.get(guildId);
                oldPlayer.stop(true);
            }

            let connection = activeConnections.get(guildId);

            if (!connection) {
                connection = joinVoiceChannel({
                    channelId: newState.channel.id,
                    guildId: guildId,
                    adapterCreator: newState.guild.voiceAdapterCreator,
                    selfDeaf: false,
                    selfMute: false,
                });

                activeConnections.set(guildId, connection);

                await entersState(connection, VoiceConnectionStatus.Ready, 15000);
            }

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

            player.on(AudioPlayerStatus.Idle, () => {
                activePlayers.delete(guildId);

                setTimeout(() => {
                    connection.destroy();
                    activeConnections.delete(guildId);
                }, 1000);
            });

            player.on('error', () => {
                activePlayers.delete(guildId);
                connection.destroy();
                activeConnections.delete(guildId);
            });
        }
    } catch (err) {
        console.error(err);
    }
});

client.login(TOKEN);