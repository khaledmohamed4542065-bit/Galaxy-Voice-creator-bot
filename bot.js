import { Client, GatewayIntentBits } from 'discord.js';
import 'dotenv/config';
import config from './config/config.js';
import connectDB from './db/connectdb.js';
import { initCairoFonts } from './utils/pvcImage.js';
import voiceStateUpdate from './events/voiceStateUpdate.js';
import interactionCreate from './events/interactionCreate.js';
import channelDelete from './events/channelDelete.js';
import messageCreate from './events/messageCreate.js';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages
    ]
});

(async () => {
    console.log('🚀 Initializing Galaxy Temp Voice Bot...');
    
    // 1. Download and register Cairo fonts for Canvas royal image guide
    await initCairoFonts();
    
    // 2. Connect to MongoDB
    await connectDB();
})();

client.on('voiceStateUpdate', voiceStateUpdate);
client.on('interactionCreate', interactionCreate);
client.on('channelDelete', channelDelete);
client.on('messageCreate', messageCreate);

client.once('clientReady', async () => {
    console.log(`====================================================`);
    console.log(`✅ Galaxy Temp Voice Bot is READY as ${client.user.tag}`);
    console.log(`🌐 Allowed Servers: ${config.allowedServers.join(', ') || 'ALL SERVERS'}`);
    console.log(`🎤 Join-To-Create Channel ID: ${config.joinToCreateId}`);
    console.log(`📁 Voice Rooms Category ID: ${config.categoryId}`);
    console.log(`====================================================`);
    try {
        await client.application.commands.create({
            name: 'manage_voices',
            description: 'إدارة الرولات والأعضاء المسموح لهم بالتحكم الكامل في الغرف الصوتية'
        });
        console.log('✅ Registered /manage_voices slash command successfully!');
    } catch (e) {
        console.error('⚠️ Could not register slash command:', e.message);
    }
});

client.on('error', (err) => console.error('❌ Discord Client Error:', err));
process.on('unhandledRejection', (error) => console.error('⚠️ Unhandled Promise Rejection:', error));

if (!config.token || config.token === 'PUT_YOUR_NEW_VOICE_BOT_TOKEN_HERE') {
    console.error('❌ Error: BOT_TOKEN is missing or not configured in .env file!');
    process.exit(1);
}

client.login(config.token);
