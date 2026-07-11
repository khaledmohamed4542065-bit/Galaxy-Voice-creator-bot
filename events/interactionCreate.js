import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, UserSelectMenuBuilder, MessageFlags, EmbedBuilder } from 'discord.js';
import PrivateVC from '../models/PrivateVC.js';
import AdminCommand from '../models/AdminCommand.js';
import GuildSettings from '../models/GuildSettings.js';
import config from '../config/config.js';
import { checkManageVoicesPerm, getManageVoicesData, buildManageVoicesPanel } from '../utils/manageVoicesHelper.js';

let adminCache = null;

export function clearAdminCache() {
    adminCache = null;
}

export default async (interaction) => {
    if (!interaction.guild) return;

    // Whitelist Guard
    if (config.allowedServers.length > 0 && !config.allowedServers.includes(interaction.guild.id)) {
        return;
    }

    // Check if guild settings exist and active status
    const settings = await GuildSettings.findOne({ guildId: interaction.guild.id });
    if (settings && !settings.active) {
        if (interaction.customId && interaction.customId.startsWith('vc_')) {
            return interaction.reply({ content: 'البوت متوقف حالياً في هذا السيرفر بواسطة الإدارة.', flags: [MessageFlags.Ephemeral] });
        }
        return;
    }

    // Handle /manage_voices Slash Command
    if (interaction.isChatInputCommand() && interaction.commandName === 'manage_voices') {
        const hasPerm = await checkManageVoicesPerm(interaction.member);
        if (!hasPerm) {
            return interaction.reply({ 
                content: '❌ عذراً، لا تمتلك الصلاحية لاستخدام أمر إدارة صلاحيات الفويسات (Manage Voices).',
                flags: [MessageFlags.Ephemeral]
            });
        }
        try {
            const panel = await buildManageVoicesPanel(interaction.guild);
            return interaction.reply(panel);
        } catch (error) {
            console.error('[manage_voices Slash Command Error]:', error);
            return interaction.reply({ content: '❌ حدث خطأ أثناء إرسال لوحة الصلاحيات.', flags: [MessageFlags.Ephemeral] });
        }
    }

    // Handle Admin Manage Voices Panel (`admin_vc_...`)
    if (interaction.customId && interaction.customId.startsWith('admin_vc_')) {
        const hasPerm = await checkManageVoicesPerm(interaction.member);
        if (!hasPerm) {
            return interaction.reply({ content: '❌ ليس لديك الصلاحية لتعديل قائمة رولات وأعضاء التحكم في الفويسات!', flags: [MessageFlags.Ephemeral] });
        }

        const data = await getManageVoicesData();

        if (interaction.customId === 'admin_vc_select_role') {
            const roleId = interaction.values[0];
            if (!data.roles.includes(roleId)) {
                data.roles.push(roleId);
                await data.save();
                clearAdminCache();
            }
        } else if (interaction.customId === 'admin_vc_select_user') {
            const userId = interaction.values[0];
            if (!data.users.some(u => u.id === userId)) {
                const memberObj = await interaction.guild.members.fetch(userId).catch(() => null);
                data.users.push({ id: userId, name: memberObj ? memberObj.user.username : userId });
                await data.save();
                clearAdminCache();
            }
        } else if (interaction.customId === 'admin_vc_remove_role') {
            const roleId = interaction.values[0];
            if (roleId !== 'none') {
                data.roles = data.roles.filter(id => id !== roleId);
                await data.save();
                clearAdminCache();
            }
        } else if (interaction.customId === 'admin_vc_remove_user') {
            const userId = interaction.values[0];
            if (userId !== 'none') {
                data.users = data.users.filter(u => u.id !== userId);
                await data.save();
                clearAdminCache();
            }
        }

        const updatedPanel = await buildManageVoicesPanel(interaction.guild);
        return interaction.update(updatedPanel);
    }

    // We only care about Private VC interactions (`vc_...`)
    if (!interaction.customId || !interaction.customId.startsWith('vc_')) return;

    const channel = interaction.channel;
    let vcData = await PrivateVC.findOne({ channelId: interaction.channelId });

    // Fallback: Check if the user is the owner but the channel ID hasn't updated in DB yet
    if (!vcData) {
        vcData = await PrivateVC.findOne({ ownerId: interaction.user.id, guildId: interaction.guild.id });
        if (vcData && !vcData.channelId) {
            vcData.channelId = interaction.channelId;
            await vcData.save().catch(() => {});
        }
    }

    const isOwnerAction = async (customId) => {
        if (!customId.startsWith('vc_')) return false;

        // 1. Admin / Master / Authorized check
        if (await checkManageVoicesPerm(interaction.member)) return true;

        // 2. Room Owner check
        if (!vcData) {
            console.log(`[VC Debug] No data found for channel: ${interaction.channelId}`);
            return false;
        }
        return interaction.user.id === vcData.ownerId;
    };

    // 1. Handle Buttons
    if (interaction.isButton()) {
        if (!(await isOwnerAction(interaction.customId))) {
            return interaction.reply({ content: 'أنت لست صاحب هذه الغرفة أو إدارياً للتحكم بها!', flags: [MessageFlags.Ephemeral] });
        }

        if (interaction.customId === 'vc_rename') {
            const modal = new ModalBuilder().setCustomId('vc_modal_rename').setTitle('تغيير اسم الغرفة');
            const nameInput = new TextInputBuilder().setCustomId('new_name').setLabel('الاسم الجديد').setStyle(TextInputStyle.Short).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
            await interaction.showModal(modal);
        }

        if (interaction.customId === 'vc_privacy_menu') {
            const select = new StringSelectMenuBuilder()
                .setCustomId('vc_select_privacy')
                .setPlaceholder('اختر إعداد الخصوصية...')
                .addOptions(
                    new StringSelectMenuOptionBuilder().setLabel('قفل الروم').setValue('privacy_lock').setEmoji('🔒'),
                    new StringSelectMenuOptionBuilder().setLabel('فتح الروم').setValue('privacy_unlock').setEmoji('🔓'),
                    new StringSelectMenuOptionBuilder().setLabel('إخفاء الروم').setValue('privacy_hide').setEmoji('👻'),
                    new StringSelectMenuOptionBuilder().setLabel('إظهار الروم').setValue('privacy_show').setEmoji('👁️'),
                    new StringSelectMenuOptionBuilder().setLabel('شات عام').setValue('privacy_chat_public').setEmoji('💬'),
                    new StringSelectMenuOptionBuilder().setLabel('شات خاص').setValue('privacy_chat_private').setEmoji('📵'),
                    new StringSelectMenuOptionBuilder().setLabel('تظهر للبنات بس').setValue('privacy_female').setEmoji('👩'),
                    new StringSelectMenuOptionBuilder().setLabel('تظهر للولاد بس').setValue('privacy_male').setEmoji('👨'),
                    new StringSelectMenuOptionBuilder().setLabel('تظهر للولاد والبنات').setValue('privacy_all').setEmoji('👥')
                );
            await interaction.reply({ 
                embeds: [new EmbedBuilder().setColor('#8A2BE2').setDescription('>>> **إعدادات الخصوصية والظهور:**')], 
                components: [new ActionRowBuilder().addComponents(select)], 
                flags: [MessageFlags.Ephemeral] 
            });
        }

        if (interaction.customId === 'vc_limit') {
            const modal = new ModalBuilder().setCustomId('vc_modal_limit').setTitle('تحديد عدد الأعضاء');
            const limitInput = new TextInputBuilder().setCustomId('limit_count').setLabel('العدد (0-99)').setStyle(TextInputStyle.Short).setPlaceholder('0 للغاء الحد').setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(limitInput));
            await interaction.showModal(modal);
        }

        if (interaction.customId === 'vc_trust') {
            const userSelect = new UserSelectMenuBuilder().setCustomId('vc_select_trust').setPlaceholder('اختر العضو لإعطائه الثقة...').setMaxValues(1);
            await interaction.reply({ 
                embeds: [new EmbedBuilder().setColor('#8A2BE2').setDescription('>>> **اختر العضو من القائمة لإعطائه الثقة (الدخول والرؤية دائماً):**')], 
                components: [new ActionRowBuilder().addComponents(userSelect)], 
                flags: [MessageFlags.Ephemeral] 
            });
        }

        if (interaction.customId === 'vc_block') {
            const userSelect = new UserSelectMenuBuilder().setCustomId('vc_select_block').setPlaceholder('اختر العضو لحظره...').setMaxValues(1);
            await interaction.reply({ 
                embeds: [new EmbedBuilder().setColor('#8A2BE2').setDescription('>>> **اختر العضو الذي تريد حظره وطرده من الروم:**')], 
                components: [new ActionRowBuilder().addComponents(userSelect)], 
                flags: [MessageFlags.Ephemeral] 
            });
        }

        if (interaction.customId === 'vc_transfer') {
            const userSelect = new UserSelectMenuBuilder().setCustomId('vc_select_transfer').setPlaceholder('اختر الملك الجديد للروم...').setMaxValues(1);
            await interaction.reply({ 
                embeds: [new EmbedBuilder().setColor('#8A2BE2').setDescription('>>> **اختر العضو الذي تريد نقل ملكية الروم إليه:**')], 
                components: [new ActionRowBuilder().addComponents(userSelect)], 
                flags: [MessageFlags.Ephemeral] 
            });
        }

        if (interaction.customId === 'vc_trusted_list') {
            if (!vcData || !vcData.trustedUsers || vcData.trustedUsers.length === 0) {
                return interaction.reply({ 
                    embeds: [new EmbedBuilder().setColor('#8A2BE2').setDescription('>>> **لا يوجد أعضاء موثوقون حالياً في هذه الغرفة.**')], 
                    flags: [MessageFlags.Ephemeral] 
                });
            }
            const select = new StringSelectMenuBuilder().setCustomId('vc_select_untrust').setPlaceholder('اختر عضواً لإزالة الثقة منه...');
            for (const userId of vcData.trustedUsers) {
                const member = await interaction.guild.members.fetch(userId).catch(() => null);
                select.addOptions(new StringSelectMenuOptionBuilder().setLabel(member ? member.user.username : userId).setValue(userId).setEmoji('❌'));
            }
            await interaction.reply({ 
                embeds: [new EmbedBuilder().setColor('#8A2BE2').setDescription('>>> **قائمة الموثوقين الحالية (اختر لإزالة الثقة):**')], 
                components: [new ActionRowBuilder().addComponents(select)], 
                flags: [MessageFlags.Ephemeral] 
            });
        }

        if (interaction.customId === 'vc_delete_chat') {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
            try {
                let deletedCount = 0;
                let fetched;
                do {
                    fetched = await channel.messages.fetch({ limit: 100 });
                    // Filter out the control panel message so buttons stay intact, and only recent (<14 days) messages
                    const toDelete = fetched.filter(m => m.id !== interaction.message.id && (Date.now() - m.createdTimestamp) < 14 * 24 * 60 * 60 * 1000);
                    if (toDelete.size > 0) {
                        const deleted = await channel.bulkDelete(toDelete, true).catch(() => null);
                        if (deleted && deleted.size > 0) {
                            deletedCount += deleted.size;
                        } else {
                            break;
                        }
                    } else {
                        break;
                    }
                } while (fetched && fetched.size >= 100);

                await interaction.editReply({
                    embeds: [new EmbedBuilder().setColor('#8A2BE2').setDescription(`>>> **تم تنظيف رسائل الشات بنجاح (` + deletedCount + ` رسالة). 🗑️✅**`)]
                });
            } catch (error) {
                console.error('[Delete Chat Error]:', error);
                await interaction.editReply({
                    embeds: [new EmbedBuilder().setColor('#8A2BE2').setDescription('>>> **❌ حدث خطأ أثناء محاولة مسح الشات.**')]
                });
            }
        }

        if (interaction.customId === 'vc_status') {
            if (!vcData) {
                return interaction.reply({ 
                    content: '❌ لم يتم العثور على بيانات لهذه الغرفة.', 
                    flags: [MessageFlags.Ephemeral] 
                });
            }

            const privacyText = {
                all: 'تظهر للولاد والبنات 👥',
                female: 'تظهر للبنات بس 👩',
                male: 'تظهر للولاد بس 👨'
            }[vcData.privacyMode] || 'تظهر للكل 👥';

            const limitText = vcData.limit === 0 ? 'مفتوح 👥' : `${vcData.limit} عضو`;
            const lockText = vcData.isLocked ? 'مقفول 🔒' : 'مفتوح 🔓';
            const hideText = vcData.isHidden ? 'مخفي 👻' : 'ظاهر 👁️';
            const channelName = channel ? channel.name : vcData.name;

            const statusEmbed = new EmbedBuilder()
                .setTitle('📊 حالة الغرفة الصوتية الحالية')
                .setColor('#8A2BE2')
                .setDescription(`هذه هي إعدادات غرفتك الصوتية في الوقت الفعلي:`)
                .addFields(
                    { name: '📝 الاسم', value: `\`${channelName}\``, inline: true },
                    { name: '👥 الحد الأقصى', value: `\`${limitText}\``, inline: true },
                    { name: '🛡️ الخصوصية', value: `\`${privacyText}\``, inline: true },
                    { name: '🔒 القفل', value: `\`${lockText}\``, inline: true },
                    { name: '👁️ الإخفاء', value: `\`${hideText}\``, inline: true },
                    { name: '🤝 الموثوقين', value: `\`${vcData.trustedUsers.length}\` عضو`, inline: true },
                    { name: '🚫 المحظورين', value: `\`${vcData.blockedUsers.length}\` عضو`, inline: true }
                )
                .setFooter({ text: `Galaxy Temp Voice • طلب بواسطة: ${interaction.user.username}` })
                .setTimestamp();

            return interaction.reply({
                embeds: [statusEmbed],
                flags: [MessageFlags.Ephemeral]
            });
        }
    }

    // 2. Handle String Select Menus
    if (interaction.isStringSelectMenu()) {
        if (!(await isOwnerAction(interaction.customId))) return;
        if (!vcData) return interaction.reply({ content: 'عذراً، لم يتم العثور على بيانات لهذه الغرفة في قاعدة البيانات.', flags: [MessageFlags.Ephemeral] });

        if (interaction.customId === 'vc_select_privacy') {
            const selection = interaction.values[0];
            const everyone = interaction.guild.roles.everyone;

            if (selection === 'privacy_lock') {
                try {
                    await channel.permissionOverwrites.edit(everyone, { Connect: false });
                    await new Promise(r => setTimeout(r, 500));
                    await channel.permissionOverwrites.edit(everyone, { SendMessages: false, ReadMessageHistory: false });
                    vcData.isLocked = true;
                    await vcData.save();
                    return interaction.update({ 
                        embeds: [new EmbedBuilder().setColor('#8A2BE2').setDescription('>>> **تم قفل الروم والشات بنجاح! 🔒**')], 
                        components: [] 
                    });
                } catch (error) {
                    console.error(`[VC Privacy Lock Error] Channel: ${channel.id}, User: ${interaction.user.id}`, error);
                    return interaction.update({ 
                        embeds: [new EmbedBuilder().setColor('#8A2BE2').setDescription('>>> **❌ خطأ في تحديث صلاحيات الروم.**')], 
                        components: [] 
                    });
                }
            }
            if (selection === 'privacy_unlock') {
                try {
                    await channel.permissionOverwrites.edit(everyone, { Connect: true });
                    vcData.isLocked = false;
                    await vcData.save();
                    return interaction.update({ 
                        embeds: [new EmbedBuilder().setColor('#8A2BE2').setDescription('>>> **تم فتح الروم للجميع! 🔓**')], 
                        components: [] 
                    });
                } catch (error) {
                    console.error(`[VC Privacy Unlock Error] Channel: ${channel.id}, User: ${interaction.user.id}`, error);
                    return interaction.update({ 
                        embeds: [new EmbedBuilder().setColor('#8A2BE2').setDescription('>>> **❌ خطأ في تحديث صلاحيات فتح الروم.**')], 
                        components: [] 
                    });
                }
            }
            if (selection === 'privacy_hide') {
                await channel.permissionOverwrites.edit(everyone, { 
                    ViewChannel: false, 
                    Connect: false,
                    SendMessages: false,
                    ReadMessageHistory: false
                });
                vcData.isHidden = true;
                vcData.isLocked = true;
                await vcData.save();
                return interaction.update({ 
                    embeds: [new EmbedBuilder().setColor('#8A2BE2').setDescription('>>> **تم إخفاء وقفل الروم والشات عن الجميع! 👻🔒**')], 
                    components: [] 
                });
            }
            if (selection === 'privacy_show') {
                try {
                    await channel.permissionOverwrites.edit(everyone, { ViewChannel: true });
                    vcData.isHidden = false;
                    await vcData.save();
                    return interaction.update({ 
                        embeds: [new EmbedBuilder().setColor('#8A2BE2').setDescription('>>> **تم إظهار الروم للجميع! 👁️**')], 
                        components: [] 
                    });
                } catch (error) {
                    console.error(`[VC Privacy Show Error] Channel: ${channel.id}, User: ${interaction.user.id}`, error);
                    return interaction.update({ 
                        embeds: [new EmbedBuilder().setColor('#8A2BE2').setDescription('>>> **❌ حدث خطأ أثناء إظهار الروم.**')], 
                        components: [] 
                    });
                }
            }
            if (selection === 'privacy_chat_public') {
                try {
                    await channel.permissionOverwrites.edit(everyone, { SendMessages: true, ReadMessageHistory: true });
                    return interaction.update({ 
                        embeds: [new EmbedBuilder().setColor('#8A2BE2').setDescription('>>> **تم فتح الشات للجميع! 💬**')], 
                        components: [] 
                    });
                } catch (error) {
                    console.error(`[VC Chat Public Error] Channel: ${channel.id}, User: ${interaction.user.id}`, error);
                    return interaction.update({ 
                        embeds: [new EmbedBuilder().setColor('#8A2BE2').setDescription('>>> **❌ حدث خطأ أثناء فتح الشات.**')], 
                        components: [] 
                    });
                }
            }
            if (selection === 'privacy_chat_private') {
                await channel.permissionOverwrites.edit(everyone, { SendMessages: false, ReadMessageHistory: false });
                return interaction.update({ 
                        embeds: [new EmbedBuilder().setColor('#8A2BE2').setDescription('>>> **تم جعل الشات خاصاً بالموجودين فقط! 📵**')], 
                        components: [] 
                });
            }

            if (selection === 'privacy_all') {
                await channel.permissionOverwrites.edit(everyone, { ViewChannel: true });
                vcData.privacyMode = 'all';
                await vcData.save();
                return interaction.update({ 
                    embeds: [new EmbedBuilder().setColor('#8A2BE2').setDescription('>>> **تم تعيين الروم لتظهر للجميع! 👥**')], 
                    components: [] 
                });
            }

            if (selection === 'privacy_female') {
                const femaleRole = interaction.guild.roles.cache.find(r => r.name === 'female' || r.name === 'بنات');
                await channel.permissionOverwrites.edit(everyone, { ViewChannel: false });
                if (femaleRole) {
                    await channel.permissionOverwrites.edit(femaleRole.id, { ViewChannel: true });
                }
                vcData.privacyMode = 'female';
                await vcData.save();
                return interaction.update({ 
                    embeds: [new EmbedBuilder().setColor('#8A2BE2').setDescription('>>> **تم تعيين الروم لتظهر للبنات فقط! 👩**')], 
                    components: [] 
                });
            }

            if (selection === 'privacy_male') {
                const maleRole = interaction.guild.roles.cache.find(r => r.name === 'male' || r.name === 'ولاد');
                await channel.permissionOverwrites.edit(everyone, { ViewChannel: false });
                if (maleRole) {
                    await channel.permissionOverwrites.edit(maleRole.id, { ViewChannel: true });
                }
                vcData.privacyMode = 'male';
                await vcData.save();
                return interaction.update({ 
                    embeds: [new EmbedBuilder().setColor('#8A2BE2').setDescription('>>> **تم تعيين الروم لتظهر للولاد فقط! 👨**')], 
                    components: [] 
                });
            }
        }

        if (interaction.customId === 'vc_select_untrust') {
            const userId = interaction.values[0];
            vcData.trustedUsers = vcData.trustedUsers.filter(id => id !== userId);
            await vcData.save();
            await channel.permissionOverwrites.delete(userId).catch(() => {});
            return interaction.update({ 
                embeds: [new EmbedBuilder().setColor('#8A2BE2').setDescription(`>>> **تم إزالة الثقة من <@${userId}> بنجاح ✅**`)], 
                components: [] 
            });
        }
    }

    // 3. Handle User Select Menus
    if (interaction.isUserSelectMenu()) {
        if (!(await isOwnerAction(interaction.customId))) return;
        if (!vcData) return interaction.reply({ content: 'عذراً، لم يتم العثور على بيانات لهذه الغرفة في قاعدة البيانات.', flags: [MessageFlags.Ephemeral] });
        const userId = interaction.values[0];

        if (interaction.customId === 'vc_select_trust') {
            if (!vcData.trustedUsers.includes(userId)) {
                vcData.trustedUsers.push(userId);
                await vcData.save();
            }
            await channel.permissionOverwrites.edit(userId, { Connect: true, ViewChannel: true });
            return interaction.update({ 
                embeds: [new EmbedBuilder().setColor('#8A2BE2').setDescription(`>>> **تم إعطاء الثقة للعضو <@${userId}> بنجاح! 🤝**`)], 
                components: [] 
            });
        }

        if (interaction.customId === 'vc_select_block') {
            if (userId === vcData.ownerId) {
                return interaction.update({ 
                    embeds: [new EmbedBuilder().setColor('#8A2BE2').setDescription('>>> **لا يمكنك حظر مالك الروم! ❌**')], 
                    components: [] 
                });
            }
            if (!vcData.blockedUsers.includes(userId)) {
                vcData.blockedUsers.push(userId);
                await vcData.save();
            }
            await channel.permissionOverwrites.edit(userId, { Connect: false });
            const member = await interaction.guild.members.fetch(userId).catch(() => null);
            if (member && member.voice.channelId === channel.id) await member.voice.setChannel(null);
            return interaction.update({ 
                embeds: [new EmbedBuilder().setColor('#8A2BE2').setDescription(`>>> **تم حظر العضو <@${userId}> من الروم بنجاح! 🚫**`)], 
                components: [] 
            });
        }

        if (interaction.customId === 'vc_select_transfer') {
            if (userId !== interaction.user.id) {
                let newOwnerData = await PrivateVC.findOne({ ownerId: userId, guildId: interaction.guild.id });
                if (newOwnerData) {
                    if (newOwnerData.channelId) {
                        return interaction.update({ content: 'هذا العضو يملك قناة نشطة بالفعل، لا يمكنه استلام ملكية قناة أخرى حالياً.', components: [] });
                    }
                    await PrivateVC.deleteOne({ _id: newOwnerData._id });
                }
            }

            try {
                await channel.permissionOverwrites.edit(userId, { 
                    ManageChannels: true, 
                    MoveMembers: true, 
                    DeafenMembers: true, 
                    MuteMembers: true, 
                    Connect: true, 
                    ViewChannel: true 
                });
                if (userId !== interaction.user.id) {
                    await channel.permissionOverwrites.delete(interaction.user.id).catch(() => {});
                    if (vcData.trustedUsers.includes(interaction.user.id)) {
                        await channel.permissionOverwrites.edit(interaction.user.id, { Connect: true, ViewChannel: true }).catch(() => {});
                    }
                }
            } catch (error) {
                return interaction.update({ 
                    embeds: [new EmbedBuilder().setColor('#8A2BE2').setDescription('>>> **❌ حدث خطأ أثناء محاولة نقل الملكية.**')], 
                    components: [] 
                });
            }

            vcData.ownerId = userId;
            await vcData.save();

            await interaction.update({ 
                embeds: [new EmbedBuilder().setColor('#8A2BE2').setDescription('>>> **تم تنفيذ طلب نقل الملكية بنجاح. ✅**')], 
                components: [] 
            });
            
            const transferEmbed = new EmbedBuilder()
                .setColor('#8A2BE2')
                .setTitle('👑 انتقال ملكية الغرفة الصوتية')
                .setDescription(`>>> **تم نقل ملكية هذه الغرفة من <@${interaction.user.id}> إلى <@${userId}>**`);

            return channel.send({ embeds: [transferEmbed] }).catch(() => {});
        }
    }

    // 4. Handle Modals
    if (interaction.isModalSubmit()) {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        if (interaction.customId === 'vc_modal_rename') {
            if (!vcData) return interaction.editReply({ content: 'عذراً، لم يتم العثور على بيانات هذه الغرفة.' });
            const newName = interaction.fields.getTextInputValue('new_name');
            await channel.setName(newName).catch(() => {});
            if (vcData.roleId) {
                const roleToRename = interaction.guild.roles.cache.get(vcData.roleId) || await interaction.guild.roles.fetch(vcData.roleId).catch(() => null);
                if (roleToRename) await roleToRename.setName(newName).catch(() => {});
            }
            vcData.name = newName;
            await vcData.save();
            await interaction.editReply({ 
                embeds: [new EmbedBuilder().setColor('#8A2BE2').setDescription(`>>> **تم تغيير اسم الروم والرول بنجاح إلى: ** \`${newName}\` ✅`)]
            });
        }
        if (interaction.customId === 'vc_modal_limit') {
            if (!vcData) return interaction.editReply({ content: 'عذراً، لم يتم العثور على بيانات هذه الغرفة.' });
            const limitStr = interaction.fields.getTextInputValue('limit_count');
            const limit = parseInt(limitStr);
            if (isNaN(limit) || limit < 0 || limit > 99) {
                return interaction.editReply({ 
                    embeds: [new EmbedBuilder().setColor('#8A2BE2').setDescription('>>> **يرجى إدخال رقم صحيح بين (0-99). ❌**')]
                });
            }
            await channel.setUserLimit(limit).catch(() => {});
            vcData.limit = limit;
            await vcData.save();
            await interaction.editReply({ 
                embeds: [new EmbedBuilder().setColor('#8A2BE2').setDescription(`>>> **تم تحديث حد الأعضاء إلى: ** \`${limit === 0 ? 'مفتوح' : limit}\` 👥`)]
            });
        }
    }
};
