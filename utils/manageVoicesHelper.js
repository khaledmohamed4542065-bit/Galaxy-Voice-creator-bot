import { EmbedBuilder, ActionRowBuilder, RoleSelectMenuBuilder, UserSelectMenuBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import AdminCommand from '../models/AdminCommand.js';
import { clearAdminCache } from '../events/interactionCreate.js';

export const MASTER_ROLES = ['1505841893681139794', '1497160475782418484'];

export async function getManageVoicesData() {
    let data = await AdminCommand.findOne({ command: 'manage_voices' });
    if (!data) {
        // Fallback or migrate existing manage_vc_creator
        const oldData = await AdminCommand.findOne({ command: 'manage_vc_creator' });
        if (oldData) {
            data = await AdminCommand.create({
                command: 'manage_voices',
                roles: oldData.roles || [],
                users: oldData.users || []
            });
        } else {
            data = await AdminCommand.create({
                command: 'manage_voices',
                roles: [],
                users: []
            });
        }
    }
    return data;
}

export async function checkManageVoicesPerm(member) {
    if (!member || !member.guild) return false;
    if (member.id === member.guild.ownerId) return true;
    if (member.roles.cache.some(r => MASTER_ROLES.includes(r.id) || r.name === 'OWNER')) return true;

    const data = await getManageVoicesData();
    if (data) {
        const hasUserPerm = data.users.some(u => u.id === member.id);
        const hasRolePerm = data.roles.some(roleIdOrName =>
            member.roles.cache.some(r => r.id === roleIdOrName || r.name === roleIdOrName)
        );
        if (hasUserPerm || hasRolePerm) return true;
    }
    return false;
}

export async function buildManageVoicesPanel(guild) {
    const data = await getManageVoicesData();

    const rolesListText = data.roles.length > 0 
        ? data.roles.map(r => `<@&${r}> (\`${r}\`)`).join('\n') 
        : 'لا توجد رولات مضافة حالياً.';

    const usersListText = data.users.length > 0 
        ? data.users.map(u => `<@${u.id}> (\`${u.name || u.id}\`)`).join('\n') 
        : 'لا يوجد أعضاء مضافون حالياً.';

    const embed = new EmbedBuilder()
        .setTitle('🛡️ لوحة التحكم في صلاحيات إدارة الغرف الصوتية (Manage Voices)')
        .setDescription('يتيح هذا النظام تحديد الرولات والأعضاء المسموح لهم بالتحكم الكامل في جميع إعدادات الغرف الصوتية الخاصة (حتى لو لم يكونوا المالكين للغرفة).\n\nالأشخاص والرولات الموجودون هنا يمكنهم استخدام جميع أزرار لوحة التحكم وأمر `manage_voices`.')
        .setColor('#8A2BE2')
        .addFields(
            { name: '👑 الرولات الأساسية المسموح لها دائماً (Master Roles)', value: MASTER_ROLES.map(id => `<@&${id}>`).join('\n') },
            { name: '🛡️ الرولات المضافة بصلاحية التحكم في الغرف', value: rolesListText },
            { name: '👤 الأعضاء المضافون بصلاحية التحكم في الغرف', value: usersListText }
        )
        .setFooter({ text: 'Galaxy Temp Voice •' })
        .setTimestamp();

    const rowAddRole = new ActionRowBuilder().addComponents(
        new RoleSelectMenuBuilder()
            .setCustomId('admin_vc_select_role')
            .setPlaceholder('➕ اختر رول لإضافته إلى قائمة التحكم بالفويسات...')
            .setMaxValues(1)
    );

    const rowAddUser = new ActionRowBuilder().addComponents(
        new UserSelectMenuBuilder()
            .setCustomId('admin_vc_select_user')
            .setPlaceholder('➕ اختر عضواً لإضافته إلى قائمة التحكم بالفويسات...')
            .setMaxValues(1)
    );

    const rowRemoveRole = new ActionRowBuilder();
    const removeRoleSelect = new StringSelectMenuBuilder()
        .setCustomId('admin_vc_remove_role')
        .setPlaceholder('🗑️ اختر رول لحذفه من قائمة التحكم...');

    if (data.roles.length > 0) {
        for (const roleId of data.roles) {
            const roleObj = guild.roles.cache.get(roleId) || await guild.roles.fetch(roleId).catch(() => null);
            removeRoleSelect.addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel(roleObj ? roleObj.name : roleId)
                    .setValue(roleId)
                    .setEmoji('❌')
            );
        }
    } else {
        removeRoleSelect.addOptions(
            new StringSelectMenuOptionBuilder().setLabel('لا توجد رولات للحذف').setValue('none')
        );
        removeRoleSelect.setDisabled(true);
    }
    rowRemoveRole.addComponents(removeRoleSelect);

    const rowRemoveUser = new ActionRowBuilder();
    const removeUserSelect = new StringSelectMenuBuilder()
        .setCustomId('admin_vc_remove_user')
        .setPlaceholder('🗑️ اختر عضواً لحذفه من قائمة التحكم...');

    if (data.users.length > 0) {
        for (const u of data.users) {
            removeUserSelect.addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel(u.name || u.id)
                    .setDescription(`ID: ${u.id}`)
                    .setValue(u.id)
                    .setEmoji('❌')
            );
        }
    } else {
        removeUserSelect.addOptions(
            new StringSelectMenuOptionBuilder().setLabel('لا يوجد أعضاء للحذف').setValue('none')
        );
        removeUserSelect.setDisabled(true);
    }
    rowRemoveUser.addComponents(removeUserSelect);

    return {
        embeds: [embed],
        components: [rowAddRole, rowAddUser, rowRemoveRole, rowRemoveUser]
    };
}
