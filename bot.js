import { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import 'dotenv/config';
import config from './config/config.js';
import connectDB from './db/connectdb.js';
import { initCairoFonts, generatePVCGuideImage } from './utils/pvcImage.js';
import voiceStateUpdate from './events/voiceStateUpdate.js';
import interactionCreate from './events/interactionCreate.js';
import channelDelete from './events/channelDelete.js';
import messageCreate from './events/messageCreate.js';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
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

    // ─────────────────────────────────────────────────────────
    // إرسال وتجديد لوحة التحكم العامة عند بدء تشغيل البوت
    // ─────────────────────────────────────────────────────────
    try {
        const panelChannel = client.channels.cache.get(config.controlPanelChannelId) || await client.channels.fetch(config.controlPanelChannelId).catch(() => null);
        if (panelChannel) {
            console.log(`🧹 Refreshing Control Panel in channel ${panelChannel.id}...`);
            const fetched = await panelChannel.messages.fetch({ limit: 50 }).catch(() => null);
            if (fetched && fetched.size > 0) {
                const botMsgs = fetched.filter(m => m.author.id === client.user.id);
                for (const [, m] of botMsgs) {
                    await m.delete().catch(() => {});
                }
            }

            const embed = new EmbedBuilder()
                .setTitle('👑 لوحة تحكم الغرفة الملكية - Galaxy Temp Voice')
                .setDescription('مرحباً بك مجدداً! تم استعادة إعدادات غرفتك السابقة تلقائياً.\n\nاستخدم الأزرار بالأسفل لإدارة غرفتك الصوتية بالكامل وبأقصى سرعة ⚡.')
                .setColor('#8A2BE2')
                .setImage('attachment://pvc_guide.png');

            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('vc_rename').setEmoji('1508307894720921770').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('vc_privacy_menu').setEmoji('1508308707690283110').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('vc_limit').setEmoji('1508311004252078230').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('vc_status').setEmoji('1508310210198900806').setStyle(ButtonStyle.Secondary)
            );

            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('vc_trust').setEmoji('1508309775018885181').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('vc_block').setEmoji('1508308168390742017').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('vc_transfer').setEmoji('1508309385670164622').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('vc_trusted_list').setEmoji('1508310598260097076').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('vc_delete_chat').setEmoji('1508308168390742017').setStyle(ButtonStyle.Danger)
            );

            const guideImageBuffer = await generatePVCGuideImage().catch(() => null);

            await panelChannel.send({
                embeds: [embed],
                components: [row1, row2],
                files: guideImageBuffer ? [{ attachment: guideImageBuffer, name: 'pvc_guide.png' }] : []
            });
            console.log(`✅ Sent Global Control Panel to channel ${panelChannel.id} without any mention.`);
        }
    } catch (panelErr) {
        console.error('❌ Error sending global control panel:', panelErr);
    }
});

client.on('error', (err) => console.error('❌ Discord Client Error:', err));
process.on('unhandledRejection', (error) => console.error('⚠️ Unhandled Promise Rejection:', error));

if (!config.token || config.token === 'PUT_YOUR_NEW_VOICE_BOT_TOKEN_HERE') {
    console.error('❌ Error: BOT_TOKEN is missing or not configured in .env file!');
    process.exit(1);
}

client.login(config.token);
