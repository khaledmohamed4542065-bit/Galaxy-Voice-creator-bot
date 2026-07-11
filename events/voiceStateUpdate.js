import { ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import PrivateVC from '../models/PrivateVC.js';
import { generatePVCGuideImage } from '../utils/pvcImage.js';
import Coin from '../models/Coin.js';
import config from '../config/config.js';

// Role IDs for gender-based visibility
const MALE_ROLE_ID = '1505841836466634762';
const FEMALE_ROLE_ID = '1505841838018269255';

const creatingChannels = new Set();
const voiceJoinTimes = new Map(); // key: userId, value: Date

export default async (oldState, newState) => {
    const { member, guild } = newState;
    if (!guild) return;

    const userId = member.id;
    const guildId = guild.id;
    const jointocreateId = config.joinToCreateId;

    // --- DYNAMIC VOICE TIME TRACKING FOR COIN CARD ---
    try {
        const oldChannel = oldState.channelId;
        const newChannel = newState.channelId;

        if (!oldChannel && newChannel) {
            voiceJoinTimes.set(userId, new Date());
        } else if (oldChannel && !newChannel) {
            const joinTime = voiceJoinTimes.get(userId);
            if (joinTime) {
                const diffMs = Date.now() - joinTime.getTime();
                const diffMins = Math.floor(diffMs / 60000);
                if (diffMins > 0) {
                    await Coin.updateOne(
                        { guildId, userId },
                        { $inc: { voiceTime: diffMins } },
                        { upsert: true }
                    );
                }
                voiceJoinTimes.delete(userId);
            }
        } else if (oldChannel && newChannel && oldChannel !== newChannel) {
            const joinTime = voiceJoinTimes.get(userId);
            if (joinTime) {
                const diffMs = Date.now() - joinTime.getTime();
                const diffMins = Math.floor(diffMs / 60000);
                if (diffMins > 0) {
                    await Coin.updateOne(
                        { guildId, userId },
                        { $inc: { voiceTime: diffMins } },
                        { upsert: true }
                    );
                }
            }
            voiceJoinTimes.set(userId, new Date());
        }
    } catch (err) {
        console.error('[Voice Time Tracking Error]:', err);
    }

    // Server Whitelist Guard
    if (config.allowedServers.length > 0 && !config.allowedServers.includes(guild.id)) {
        return;
    }

    // --- Dynamic JTC Locking/Unlocking ---
    if (oldState.channelId !== newState.channelId) {
        try {
            const jtcChannel = guild.channels.cache.get(jointocreateId);
            if (jtcChannel) {
                if (newState.channelId && newState.channelId !== jointocreateId) {
                    await jtcChannel.permissionOverwrites.edit(member.id, { 
                        Connect: false,
                        ViewChannel: false
                    }).catch(() => {});
                } else if (!newState.channelId) {
                    await jtcChannel.permissionOverwrites.delete(member.id).catch(() => {});
                }
            }
        } catch (err) {
            console.error('[JTC Permission Sync Error]:', err);
        }
    }

    // 1. User joins the "Join to Create" channel
    if (newState.channelId === jointocreateId) {
        console.log(`🎤 User ${member.user.username} joined Join to Create channel - creating new VC...`);

        if (creatingChannels.has(member.id)) {
            console.log(`⚠️ Member ${member.id} is already in the creation queue — skipping duplicate.`);
            return;
        }
        creatingChannels.add(member.id);

        try {
            let vcData = await PrivateVC.findOne({ ownerId: member.id });
            
            if (vcData && vcData.channelId) {
                const activeChannel = guild.channels.cache.get(vcData.channelId) || await guild.channels.fetch(vcData.channelId).catch(() => null);
                if (activeChannel && activeChannel.members.size === 0) {
                    if (vcData.roleId) {
                        const oldRole = guild.roles.cache.get(vcData.roleId) || await guild.roles.fetch(vcData.roleId).catch(() => null);
                        if (oldRole) await oldRole.delete('Recreating VC').catch(() => {});
                    }
                    await activeChannel.delete().catch(() => {});
                }
            }

            const triggerChannel = await guild.channels.fetch(jointocreateId).catch(() => null);
            const parentId = config.categoryId || (triggerChannel ? triggerChannel.parentId : null);
            
            const channelName = vcData?.name || `${member.user.username}'s VC`;
            const userLimit = vcData?.limit || 0;

            // Build default permission overwrites — open & visible to everyone by default
            const defaultPerms = [
                {
                    id: guild.id, // @everyone — open by default
                    allow: ['ViewChannel', 'Connect', 'SendMessages', 'ReadMessageHistory'],
                    deny: []
                },
                {
                    id: member.id, // The creator gets full control
                    allow: ['ManageChannels', 'MoveMembers', 'DeafenMembers', 'MuteMembers', 'Connect', 'ViewChannel', 'SendMessages', 'ReadMessageHistory'],
                },
            ];

            const newChannel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildVoice,
                parent: parentId,
                userLimit: userLimit,
                permissionOverwrites: defaultPerms,
            });

            // Apply privacyMode permissions (only if user had a saved preference)
            if (vcData?.privacyMode === 'female') {
                // Hide from everyone, show only to female role
                await newChannel.permissionOverwrites.edit(guild.id, { ViewChannel: false, Connect: false });
                const femaleRole = guild.roles.cache.get(FEMALE_ROLE_ID);
                if (femaleRole) {
                    await newChannel.permissionOverwrites.edit(FEMALE_ROLE_ID, { ViewChannel: true, Connect: true });
                }
            } else if (vcData?.privacyMode === 'male') {
                // Hide from everyone, show only to male role
                await newChannel.permissionOverwrites.edit(guild.id, { ViewChannel: false, Connect: false });
                const maleRole = guild.roles.cache.get(MALE_ROLE_ID);
                if (maleRole) {
                    await newChannel.permissionOverwrites.edit(MALE_ROLE_ID, { ViewChannel: true, Connect: true });
                }
            }
            // privacyMode === 'all' or undefined = already open by default — no extra changes needed

            // Apply lock/hide from saved preferences
            if (vcData?.isHidden) {
                await newChannel.permissionOverwrites.edit(guild.id, { ViewChannel: false, Connect: false });
            } else if (vcData?.isLocked) {
                await newChannel.permissionOverwrites.edit(guild.id, { Connect: false });
            }

            console.log(`✅ تم انشاء قناه خاصه للأيدي: ${member.id} باسم ${channelName}`);

            // Create Role with the room name
            let newRole = null;
            try {
                newRole = await guild.roles.create({
                    name: channelName,
                    reason: `Role for Private VC: ${channelName}`
                });
            } catch (roleErr) {
                console.error('[Create Role Error]:', roleErr);
            }

            // Initial Trusted/Blocked permissions
            if (vcData) {
                for (const userId of vcData.trustedUsers) {
                    await newChannel.permissionOverwrites.edit(userId, { Connect: true, ViewChannel: true }).catch(() => {});
                }
                for (const userId of vcData.blockedUsers) {
                    await newChannel.permissionOverwrites.edit(userId, { Connect: false }).catch(() => {});
                }
            }

            // Update or create DB record atomically without race condition errors
            // NOTE: query must match the unique index (ownerId only) to avoid E11000 duplicate key on upsert
            vcData = await PrivateVC.findOneAndUpdate(
                { ownerId: member.id },
                {
                    $set: {
                        guildId: guild.id,
                        channelId: newChannel.id,
                        roleId: newRole ? newRole.id : null,
                        name: channelName,
                        limit: userLimit
                    },
                    $setOnInsert: {
                        trustedUsers: [],
                        blockedUsers: [],
                        privacyMode: 'all',
                        isLocked: false,
                        isHidden: false
                    }
                },
                { upsert: true, new: true }
            ).catch(async (err) => {
                if (err.code === 11000) {
                    // Race condition: doc was just inserted by another process — fetch and update it
                    console.warn('[PVC] Duplicate key on upsert — retrying with findOneAndUpdate...');
                    return PrivateVC.findOneAndUpdate(
                        { ownerId: member.id },
                        { $set: { guildId: guild.id, channelId: newChannel.id, roleId: newRole ? newRole.id : null, name: channelName, limit: userLimit } },
                        { new: true }
                    );
                }
                throw err;
            });

            // Move the user to the new channel & give role
            await member.voice.setChannel(newChannel);
            if (newRole && member) {
                await member.roles.add(newRole).catch(err => console.error('[Add Role to Creator Error]:', err));
            }

            // Send Control Panel
            const exists = guild.channels.cache.has(newChannel.id);
            if (!exists) return;

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

            await newChannel.send({
                content: `<@${member.id}>`,
                embeds: [embed],
                components: [row1, row2],
                files: guideImageBuffer ? [{ attachment: guideImageBuffer, name: 'pvc_guide.png' }] : []
            }).catch(err => console.error('[VC Panel Send Fail]:', err));

        } catch (error) {
            console.error('❌ فشل انشاء القناه:', error);
        } finally {
            creatingChannels.delete(member.id);
        }
    }

    // 2. User leaves a channel
    if (oldState.channelId && oldState.channelId !== newState.channelId) {
        const oldChannel = oldState.channel;
        const vcData = await PrivateVC.findOne({ channelId: oldState.channelId });
        if (vcData) {
            // Remove the role from the member who left the Private VC
            if (vcData.roleId && oldState.member) {
                await oldState.member.roles.remove(vcData.roleId).catch(() => {});
            }

            if (oldChannel && oldChannel.members.size === 0) {
                try {
                    if (vcData.roleId) {
                        const roleToDelete = guild.roles.cache.get(vcData.roleId) || await guild.roles.fetch(vcData.roleId).catch(() => null);
                        if (roleToDelete) await roleToDelete.delete('Private VC empty/deleted').catch(() => {});
                    }
                    await oldChannel.delete();
                    await PrivateVC.updateOne({ _id: vcData._id }, { $unset: { channelId: "" }, $set: { roleId: null } });
                    console.log(`🗑️ Deleted empty private voice channel & role: ${oldChannel.id}`);
                } catch (error) {
                    // Silence deletion errors
                }
            }
        }
    }

    // 3. User joins an existing Private VC channel (not Join To Create)
    if (newState.channelId && newState.channelId !== jointocreateId && oldState.channelId !== newState.channelId) {
        try {
            const vcData = await PrivateVC.findOne({ channelId: newState.channelId });
            if (vcData && vcData.roleId && newState.member) {
                await newState.member.roles.add(vcData.roleId).catch(() => {});
            }
        } catch (err) {
            console.error('[Add Role on Join Error]:', err);
        }
    }
};
