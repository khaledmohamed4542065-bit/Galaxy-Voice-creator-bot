import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    id: { type: String, required: true }
});

const adminCommandSchema = new mongoose.Schema({
    command: { type: String, required: true, unique: true },
    users: [userSchema],
    roles: [{ type: String }]
});

const AdminCommand = mongoose.model('AdminCommand', adminCommandSchema);

export default AdminCommand;
