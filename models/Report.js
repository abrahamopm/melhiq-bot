const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
    userId: { type: Number, required: true },
    username: String,
    type: { type: String, enum: ['comment', 'complaint', 'harassment', 'safety', 'feedback'], required: true },
    details: { type: String, required: true },
    isAnonymous: { type: Boolean, default: true },
    secretKey: { type: String, unique: true }, // For anonymous follow-ups
    language: { type: String, default: 'en' },
    evidence: [{
        fileId: String,
        fileType: String,
        url: String
    }],
    reporterInfo: {
        name: String,
        email: String
    },
    status: { type: String, default: 'pending', enum: ['pending', 'reviewed', 'resolved'] },
    response: String,
    respondedAt: Date,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Report', reportSchema);
