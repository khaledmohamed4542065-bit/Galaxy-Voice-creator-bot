import dotenv from 'dotenv';
dotenv.config();

const config = {
    token: process.env.BOT_TOKEN,
    allowedServers: (process.env.ALLOW_SERVER || '').split(',').map(id => id.replace(/"/g, '').trim()).filter(id => id.length > 0),
    joinToCreateId: (process.env.JOIN_TO_CREATE_ID || '1494164521630306369').replace(/"/g, '').trim(),
    categoryId: (process.env.VOICE_CATEGORY_ID || '1525264513698496585').replace(/"/g, '').trim(),
    controlPanelChannelId: (process.env.CONTROL_PANEL_CHANNEL_ID || '1525485897682911442').replace(/"/g, '').trim(),
    mongoUrl: process.env.MONGO_URL || 'mongodb://localhost:27017/bot'
};

export default config;
