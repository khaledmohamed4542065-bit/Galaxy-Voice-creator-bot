import mongoose from 'mongoose';

const guildSettingsSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    guildName: { type: String, required: true },
    active: { type: Boolean, default: true },
    commandsStatus: {
        type: Map,
        of: Boolean,
        default: {}
    },
    allowedTicketRoles: {
        type: [String],
        default: []
    }
});

const GuildSettings = mongoose.model('GuildSettings', guildSettingsSchema);

export default GuildSettings;
