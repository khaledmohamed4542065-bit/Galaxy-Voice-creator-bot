import { MessageFlags, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, PermissionFlagsBits } from 'discord.js';
import { checkManageVoicesPerm, buildManageVoicesPanel } from '../utils/manageVoicesHelper.js';
import PrivateVC from '../models/PrivateVC.js';
import config from '../config/config.js';

// Fixed role IDs for gender-based visibility
const MALE_ROLE_ID = '1505841836466634762';
const FEMALE_ROLE_ID = '1505841838018269255';

export default async (message) => {
    if (!message || !message.guild || message.author.bot) return;

    // Whitelist Guard
    if (config.allowedServers.length > 0 && !config.allowedServers.includes(message.guild.id)) {
        return;
    }

    const content = message.content.trim().toLowerCase();

    // ─────────────────────────────────────────────────────────
    // أمر manage_voices (للإدمن)
    // ─────────────────────────────────────────────────────────
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
        return;
    }

    // ─────────────────────────────────────────────────────────
    // أمر "تحكم" في شات الفويس — يرسل لوحة التحكم الكاملة
    // ─────────────────────────────────────────────────────────
    if (content === 'تحكم' || content === '!تحكم' || content === '-تحكم') {
        // يجب أن تكون الرسالة في شات مرتبط بغرفة صوتية خاصة
        const vcData = await PrivateVC.findOne({ channelId: message.channelId }).catch(() => null);
        if (!vcData) return; // مش شات فويس خاص

        // فقط صاحب الروم أو المسؤولين
        const isAdmin = await checkManageVoicesPerm(message.member).catch(() => false);
        const isOwner = message.author.id === vcData.ownerId;
        if (!isAdmin && !isOwner) {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#FF4757')
                    .setDescription('> **❌ فقط صاحب الغرفة أو الإدارة يمكنهم استخدام هذا الأمر!**')
                ]
            }).catch(() => {});
        }

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

        const embed = new EmbedBuilder()
            .setTitle('👑 لوحة تحكم الغرفة الملكية — Galaxy Temp Voice')
            .setDescription(
                '> استخدم الأزرار بالأسفل لإدارة غرفتك الصوتية بالكامل ⚡\n' +
                '> يمكنك إرسال `تحكم` في أي وقت لاستدعاء اللوحة مجدداً.'
            )
            .setColor('#8A2BE2')
            .setFooter({ text: `Galaxy Temp Voice • طلب بواسطة: ${message.author.username}` })
            .setTimestamp();

        await message.reply({
            embeds: [embed],
            components: [row1, row2]
        }).catch(() => {});

        // حذف رسالة المستخدم بعد ثانية
        message.delete().catch(() => {});
        return;
    }

    // ─────────────────────────────────────────────────────────
    // أمر "فتح" في شات الفويس — يفتح الغرفة لو كانت مخفية أو مقفولة (للدوست فقط)
    // ─────────────────────────────────────────────────────────
    if (content === 'فتح' || content === '!فتح') {
        const vcData = await PrivateVC.findOne({ channelId: message.channelId }).catch(() => null);
        if (!vcData) return;

        // فقط صاحب الروم
        if (message.author.id !== vcData.ownerId) {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#FF4757')
                    .setDescription('> **❌ فقط صاحب الغرفة يمكنه استخدام هذا الأمر!**')
                ]
            }).catch(() => {});
        }

        const channel = message.guild.channels.cache.get(message.channelId);
        if (!channel) return;

        const everyone = message.guild.roles.everyone;
        let changed = [];

        // لو مخفية → ظهّرها
        if (vcData.isHidden) {
            await channel.permissionOverwrites.edit(everyone, { ViewChannel: true }).catch(() => {});
            vcData.isHidden = false;
            changed.push('✅ تم **إظهار** الغرفة للجميع');
        }

        // لو مقفولة → افتحها
        if (vcData.isLocked) {
            await channel.permissionOverwrites.edit(everyone, { Connect: true }).catch(() => {});
            vcData.isLocked = false;
            changed.push('✅ تم **فتح** الغرفة للجميع');
        }

        // لو مش مخفية ولا مقفولة
        if (changed.length === 0) {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#8A2BE2')
                    .setDescription('> **ℹ️ الغرفة مفتوحة وظاهرة بالفعل!**')
                ]
            }).catch(() => {});
        }

        await vcData.save();

        const replyMsg = await message.reply({
            embeds: [new EmbedBuilder()
                .setColor('#2ECC71')
                .setTitle('🔓 تم فتح الغرفة')
                .setDescription(changed.join('\n'))
                .setFooter({ text: `Galaxy Temp Voice • بواسطة: ${message.author.username}` })
                .setTimestamp()
            ]
        }).catch(() => {});

        // حذف رسالة المستخدم
        message.delete().catch(() => {});

        // حذف الرد بعد 5 ثواني
        if (replyMsg) setTimeout(() => replyMsg.delete().catch(() => {}), 5000);
        return;
    }
};
