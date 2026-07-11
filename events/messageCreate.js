import { MessageFlags } from 'discord.js';
import { checkManageVoicesPerm, buildManageVoicesPanel } from '../utils/manageVoicesHelper.js';
import config from '../config/config.js';

export default async (message) => {
    if (!message || !message.guild || message.author.bot) return;

    // Whitelist Guard
    if (config.allowedServers.length > 0 && !config.allowedServers.includes(message.guild.id)) {
        return;
    }

    const content = message.content.trim().toLowerCase();

    if (content === 'manage_voices' || content === '!manage_voices' || content === '-manage_voices' || content === '/manage_voices') {
        const hasPerm = await checkManageVoicesPerm(message.member);
        if (!hasPerm) {
            return message.reply({ 
                content: '❌ عذراً، لا تمتلك الصلاحية لاستخدام أمر إدارة صلاحيات الفويسات (Manage Voices).',
                flags: [MessageFlags.Ephemeral]
            }).catch(() => {});
        }

        try {
            const panel = await buildManageVoicesPanel(message.guild);
            await message.reply(panel);
        } catch (error) {
            console.error('[manage_voices Command Error]:', error);
            await message.reply('❌ حدث خطأ أثناء إرسال لوحة الصلاحيات.').catch(() => {});
        }
    }
};
