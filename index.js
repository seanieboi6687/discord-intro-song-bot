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

// 🧠 STATE PER GUILD
const state = new Map();

client.once('clientReady', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    try {
        if (!oldState.channelId && newState.channelId) {

            const guildId = newState.guild.id;
            const userId = newState.member.id;
            const soundFile = userSounds[userId];

            // ❌ ignore users without sound mapping
            if (!soundFile) return;

            // 🧠 get or create guild state
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
                    player: null
                };

                state.set(guildId, guild);
            }

            // ⚡ INTERRUPT ANY CURRENT AUDIO
            if (guild.player) {
                try {
                    guild.player.stop(true);
                } catch {}
            }

            // 🎧 CREATE NEW PLAYER
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

            // 🧼 CLEANUP AFTER FINISH
            player.on(AudioPlayerStatus.Idle, () => {
                try {
                    guild.player = null;
                } catch {}
            });

            // ❌ ERROR HANDLING
            player.on('error', () => {
                try {
                    guild.player = null;
                } catch {}
            });
        }
    } catch (err) {
        console.error(err);
    }
});

client.login(TOKEN);