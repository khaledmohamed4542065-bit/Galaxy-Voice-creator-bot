import PrivateVC from '../models/PrivateVC.js';

export default async (channel) => {
    if (!channel || !channel.guild) return;

    try {
        const vcData = await PrivateVC.findOne({ channelId: channel.id });
        if (vcData) {
            console.log(`[ChannelDelete] Private VC ${channel.id} was deleted. Cleaning up role and DB record...`);
            if (vcData.roleId) {
                const roleToDelete = channel.guild.roles.cache.get(vcData.roleId) || await channel.guild.roles.fetch(vcData.roleId).catch(() => null);
                if (roleToDelete) {
                    await roleToDelete.delete('Private VC deleted').catch(() => {});
                }
            }
            await PrivateVC.updateOne({ _id: vcData._id }, { $unset: { channelId: "" }, $set: { roleId: null } });
        }
    } catch (err) {
        console.error('[ChannelDelete Event Error]:', err);
    }
};
