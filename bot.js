require('dotenv').config();
const { Telegraf, Markup, session } = require('telegraf');
const mongoose = require('mongoose');
const HttpsProxyAgent = require('https-proxy-agent');
const { DateTime } = require('luxon');
const crypto = require('crypto');
const Report = require('./models/Report');
const User = require('./models/User');

// --- Configuration & Initialization ---
const ADMIN_IDS = (process.env.ADMIN_CHAT_ID || '').split(',').map(id => id.trim());

const botOptions = { handlerTimeout: 120_000 };
if (process.env.HTTPS_PROXY) {
    botOptions.telegram = { agent: new HttpsProxyAgent(process.env.HTTPS_PROXY) };
}

const bot = new Telegraf(process.env.BOT_TOKEN, botOptions);

// Database Connection
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/melhiq_bot');
        console.log('🍃 Database connected');
    } catch (err) {
        console.error('❌ DB Error:', err.message);
        setTimeout(connectDB, 5000);
    }
};
connectDB();

bot.use(session());

// Global Logging Middleware
bot.use((ctx, next) => {
    if (ctx.message) {
        console.log(`📩 [MSG] From: ${ctx.from.id} | Text: ${ctx.message.text || '[Non-text]'}`);
    }
    return next();
});

// --- Localization ---
const STRINGS = {
    en: {
        welcome: "⚓ <b>Welcome to Melhiq!</b>\n\nI am your Safeguarding Anchor for EngenderHealth YAC. This is a safe space for you.",
        lang_choice: "Please select your language / እባክዎን ቋንቋዎን ይምረጡ፡",
        main_menu: "Main Menu",
        new_sub: "📝 New Submission",
        safety_info: "🛡️ Safety Info",
        help: "🆘 Help",
        profile: "👤 My Reports",
        step1: "<b>Step 1/5: Type</b>\nWhat would you like to share?",
        step2: "<b>Step 2/5: Details</b>\nPlease describe the situation. You can also send a photo or document as evidence after this message.",
        step3: "<b>Step 3/5: Evidence</b>\nWould you like to attach any evidence (Photo/File)? If not, click 'Continue'.",
        step4: "<b>Step 4/5: Privacy</b>\nHow should we handle your identity?",
        step5: "<b>Step 5/5: Contact</b>\nPlease provide your Name/Email:",
        anon_desc: "👤 <b>Anonymous Mode:</b> We will NOT store your Telegram ID or name with the report. You will receive a <b>Secret Key</b> to track your report.",
        identified: "🆔 <b>Identified Mode:</b> Your name and email will be shared with the Safeguarding Team for direct follow-up.",
        success: "✅ <b>Report Anchored!</b>\n\nYour reference ID: <code>#REF</code>\nYour Secret Key: <code>#KEY</code>\n\n<i>SAVE THIS KEY! It is the only way to track an anonymous report.</i>",
        processing: "Securing Report",
        evidence_added: "✅ Evidence attached!",
        continue: "➡️ Continue",
        no_reports: "📝 You have no identified reports.",
        reports_list: "📋 <b>Your Identified Reports:</b>\n\n",
        help_text: "🆘 <b>Melhiq Help Guide</b>\n\n" +
                  "• <b>New Submission:</b> Start a report about safeguarding concerns.\n" +
                  "• <b>Anonymous Mode:</b> Your identity is hidden. Save the Secret Key!\n" +
                  "• <b>Identified Mode:</b> We store your name/email for follow-up.\n" +
                  "• <b>My Reports:</b> View reports you sent in Identified Mode.\n" +
                  "• <b>Check Report:</b> Use <code>/check [SecretKey]</code> to track anonymous reports.",
        response_from_admin: "💬 <b>Admin Response:</b>",
        no_response_yet: "<i>No response yet.</i>",
        update_notification: "🔔 <b>Update on your report #${REF}:</b>\n\n${MSG}",
        resolved_notification: "✅ <b>Your report #${REF} has been resolved.</b>",
        cancel: "❌ Cancel"
    },
    am: {
        welcome: "⚓ <b>እንኳን ወደ መልሕቅ በሰላም መጡ!</b>\n\nእኔ ለኢንጀንደር ሄልዝ (EngenderHealth) YAC የጥበቃ መልሕቅ ነኝ። ይህ ለእርስዎ አስተማማኝ ቦታ ነው።",
        lang_choice: "እባክዎን ቋንቋ ይምረጡ፡",
        main_menu: "ዋና ማውጫ",
        new_sub: "📝 አዲስ ሪፖርት",
        safety_info: "🛡️ ስለ ጥበቃ",
        help: "🆘 እርዳታ",
        profile: "👤 የእኔ ሪፖርቶች",
        step1: "<b>ደረጃ 1/5፡ ዓይነት</b>\nምን ማጋራት ይፈልጋሉ?",
        step2: "<b>ደረጃ 2/5፡ ዝርዝር</b>\nእባክዎን ሁኔታውን ይግለጹ። ከዚህ መልዕክት በኋላ ፎቶ ወይም ሰነድ እንደ ማስረጃ መላክ ይችላሉ።",
        step3: "<b>ደረጃ 3/5፡ ማስረጃ</b>\nማስረጃ (ፎቶ/ፋይል) ማያያዝ ይፈልጋሉ? ካልፈለጉ 'ቀጥል' የሚለውን ይጫኑ።",
        step4: "<b>ደረጃ 4/5፡ ግላዊነት</b>\nማንነትዎ እንዴት ይያዝ?",
        step5: "<b>ደረጃ 5/5፡ አድራሻ</b>\nእባክዎን ስምዎን እና ኢሜልዎን ያስገቡ፡",
        anon_desc: "👤 <b>ማንነትን መደበቅ፡</b> የእርስዎን የቴሌግራም መለያ ወይም ስም ከሪፖርቱ ጋር አንይዝም። ሪፖርቱን ለመከታተል <b>ሚስጥራዊ ቁልፍ</b> ይሰጥዎታል።",
        identified: "🆔 <b>ማንነትን ማሳወቅ፡</b> ለቀጥታ ክትትል ስምዎ እና ኢሜልዎ ለጥበቃ ቡድኑ ይጋራሉ።",
        success: "✅ <b>ሪፖርቱ ተመዝግቧል!</b>\n\nመለያ ቁጥር፡ <code>#REF</code>\nሚስጥራዊ ቁልፍ፡ <code>#KEY</code>\n\n<i>ይህንን ቁልፍ ያስቀምጡ! ስም ሳይጠቅሱ ለላኩት ሪፖርት ብቸኛው መከታተያ ነው::</i>",
        processing: "ሪፖርቱን በማስቀመጥ ላይ",
        evidence_added: "✅ ማስረጃ ተያይዟል!",
        continue: "➡️ ቀጥል",
        no_reports: "📝 ምንም የተመዘገበ ሪፖርት የለዎትም።",
        reports_list: "📋 <b>የእርስዎ ሪፖርቶች፡</b>\n\n",
        help_text: "🆘 <b>የመልሕቅ እርዳታ መመሪያ</b>\n\n" +
                  "• <b>አዲስ ሪፖርት፡</b> የጥበቃ ስጋቶችን ሪፖርት ለማድረግ ይጀምሩ::\n" +
                  "• <b>ማንነትን መደበቅ፡</b> ማንነትዎ አይታወቅም። ሚስጥራዊ ቁልፉን ያስቀምጡ!\n" +
                  "• <b>ማንነትን ማሳወቅ፡</b> ለቀጥታ ክትትል ስምዎን/ኢሜልዎን እናስቀምጣለን።\n" +
                  "• <b>የእኔ ሪፖርቶች፡</b> ስምዎን ጠቅሰው የላኳቸውን ሪፖርቶች እዚህ ያገኛሉ።\n" +
                  "• <b>ሪፖርት መከታተያ፡</b> ስም ሳይጠቅሱ የላኩትን ሪፖርት ለመከታተል <code>/check [SecretKey]</code> ይጠቀሙ::",
        response_from_admin: "💬 <b>የአስተዳዳሪ ምላሽ፡</b>",
        no_response_yet: "<i>እስካሁን ምንም ምላሽ አልተሰጠም።</i>",
        update_notification: "🔔 <b>በሪፖርት ቁጥር #${REF} ላይ የተሰጠ ምላሽ፡</b>\n\n${MSG}",
        resolved_notification: "✅ <b>የሪፖርት ቁጥር #${REF} ተፈቷል (Resolved)።</b>",
        cancel: "❌ ሰርዝ"
    }
};

// --- Middleware & Helpers ---
const t = (ctx, key) => STRINGS[ctx.session?.lang || 'en'][key];

const getUI = (ctx) => ({
    main: Markup.keyboard([
        [t(ctx, 'new_sub'), t(ctx, 'safety_info')],
        [t(ctx, 'profile'), t(ctx, 'help')]
    ]).resize(),
    
    types: Markup.inlineKeyboard([
        [Markup.button.callback('💬 Comment / አስተያየት', 'type_comment')],
        [Markup.button.callback('🚫 Complaint / ቅሬታ', 'type_complaint')]
    ]),

    anonymity: Markup.inlineKeyboard([
        [Markup.button.callback(t(ctx, 'anon_desc').split('\n')[0], 'anon_yes')],
        [Markup.button.callback(t(ctx, 'identified').split('\n')[0], 'anon_no')]
    ]),

    evidence: Markup.inlineKeyboard([
        [Markup.button.callback(t(ctx, 'continue'), 'evidence_done')],
        [Markup.button.callback(t(ctx, 'cancel'), 'cancel_report')]
    ]),

    anonymity: Markup.inlineKeyboard([
        [Markup.button.callback(t(ctx, 'anon_desc').split('\n')[0], 'anon_yes')],
        [Markup.button.callback(t(ctx, 'identified').split('\n')[0], 'anon_no')],
        [Markup.button.callback(t(ctx, 'cancel'), 'cancel_report')]
    ])
});

const isAdmin = (id) => ADMIN_IDS.includes(id.toString());

// --- Bot Logic ---

bot.start(async (ctx) => {
    console.log(`📥 [START] Command received from user: ${ctx.from.id}`);
    ctx.session = {};
    
    try {
        console.log('🛰️ Updating user profile in DB...');
        // Save user
        await User.findOneAndUpdate(
            { telegramId: ctx.from.id },
            { username: ctx.from.username, firstName: ctx.from.first_name },
            { upsert: true }
        );
        console.log('✅ User profile updated');
    } catch (dbErr) {
        console.error('❌ DB Update Failed inside /start:', dbErr.message);
    }

    console.log('📤 Sending welcome message...');
    await ctx.replyWithHTML(
        "⚓ <b>Melhiq | መልሕቅ</b>\n\n" + STRINGS.en.lang_choice,
        Markup.inlineKeyboard([
            [Markup.button.callback('English 🇺🇸', 'lang_en')],
            [Markup.button.callback('አማርኛ 🇪🇹', 'lang_am')]
        ])
    );
});

bot.action(/lang_(.+)/, async (ctx) => {
    const lang = ctx.match[1];
    ctx.session.lang = lang;
    await User.updateOne({ telegramId: ctx.from.id }, { language: lang });
    await ctx.answerCbQuery();
    await ctx.replyWithHTML(t(ctx, 'welcome'), getUI(ctx).main);
});

// Menu Handlers
bot.hears([STRINGS.en.new_sub, STRINGS.am.new_sub], (ctx) => {
    ctx.session.state = 'AWAITING_TYPE';
    ctx.replyWithHTML(t(ctx, 'step1'), getUI(ctx).types);
});

bot.hears([STRINGS.en.safety_info, STRINGS.am.safety_info], (ctx) => {
    ctx.replyWithHTML(t(ctx, 'safety_info') + "\n\n" + (ctx.session.lang === 'am' ? "ኢንጀንደር ሄልዝ ሁሉንም ተሳታፊዎች የመጠበቅ ሃላፊነት አለበት::" : "EngenderHealth is committed to protecting all participants."));
});

bot.hears([STRINGS.en.profile, STRINGS.am.profile], async (ctx) => {
    try {
        const reports = await Report.find({ userId: ctx.from.id }).sort({ createdAt: -1 }).limit(10);
        
        if (reports.length === 0) {
            return ctx.replyWithHTML(t(ctx, 'no_reports'));
        }

        let text = t(ctx, 'reports_list');
        reports.forEach(r => {
            const statusEmoji = r.status === 'resolved' ? '✅' : (r.status === 'reviewed' ? '👀' : '⏳');
            text += `• <code>#${r._id.toString().slice(-6)}</code> | ${r.type.toUpperCase()} | ${statusEmoji} <b>${r.status.toUpperCase()}</b>\n`;
            if (r.response) {
                text += `  ${t(ctx, 'response_from_admin')} ${r.response}\n`;
            }
            text += `  <i>${DateTime.fromJSDate(r.createdAt).toFormat('yyyy-MM-dd HH:mm')}</i>\n\n`;
        });

        
        text += (ctx.session.lang === 'am' ? 
            "<i>ማሳሰቢያ፡ ስም ሳይጠቀስ የተላከ ሪፖርትን ለመከታተል /check [ሚስጥራዊ_ቁልፍ] ይጠቀሙ::</i>" : 
            "<i>Note: For anonymous reports, use /check [SecretKey] to track status.</i>");

        ctx.replyWithHTML(text);
    } catch (err) {
        console.error('Error fetching reports:', err);
        ctx.reply("⚠️ Error loading reports.");
    }
});

bot.hears([STRINGS.en.help, STRINGS.am.help], (ctx) => {
    ctx.replyWithHTML(t(ctx, 'help_text'));
});


bot.action('cancel_report', async (ctx) => {
    ctx.session = { lang: ctx.session.lang };
    await ctx.answerCbQuery();
    await ctx.reply(t(ctx, 'main_menu'), getUI(ctx).main);
});

// Callback Action Handlers
bot.action(/type_(.+)/, async (ctx) => {
    ctx.session.type = ctx.match[1];
    ctx.session.state = 'AWAITING_DETAILS';
    ctx.session.evidence = [];
    await ctx.answerCbQuery();
    await ctx.editMessageText(t(ctx, 'step2'), { parse_mode: 'HTML' });
});

bot.action('evidence_done', async (ctx) => {
    ctx.session.state = 'AWAITING_ANONYMITY';
    await ctx.answerCbQuery();
    await ctx.replyWithHTML(t(ctx, 'step4'), getUI(ctx).anonymity);
});

bot.action('anon_yes', async (ctx) => {
    ctx.session.isAnonymous = true;
    ctx.session.secretKey = crypto.randomBytes(4).toString('hex').toUpperCase();
    await ctx.answerCbQuery();
    await finalizeReport(ctx);
});

bot.action('anon_no', async (ctx) => {
    ctx.session.isAnonymous = false;
    ctx.session.state = 'AWAITING_NAME';
    await ctx.answerCbQuery();
    await ctx.replyWithHTML(t(ctx, 'step5'));
});

// Universal Input Handler
bot.on(['text', 'photo', 'document'], async (ctx) => {
    const state = ctx.session?.state;
    if (!state) return;

    if (state === 'AWAITING_DETAILS' && ctx.message.text) {
        ctx.session.details = ctx.message.text;
        ctx.session.state = 'AWAITING_EVIDENCE';
        await ctx.replyWithHTML(t(ctx, 'step3'), getUI(ctx).evidence);
    } 
    else if (state === 'AWAITING_EVIDENCE') {
        const fileId = ctx.message.photo ? ctx.message.photo.pop().file_id : (ctx.message.document?.file_id);
        if (fileId) {
            ctx.session.evidence.push({ fileId, fileType: ctx.message.photo ? 'photo' : 'document' });
            await ctx.reply(t(ctx, 'evidence_added'), getUI(ctx).evidence);
        }
    }
    else if (state === 'AWAITING_NAME' && ctx.message.text) {
        ctx.session.name = ctx.message.text;
        ctx.session.state = 'AWAITING_EMAIL';
        await ctx.reply("Email / ኢሜል:");
    }
    else if (state === 'AWAITING_EMAIL' && ctx.message.text) {
        ctx.session.email = ctx.message.text;
        await finalizeReport(ctx);
    }
});

async function finalizeReport(ctx) {
    const { type, details, isAnonymous, name, email, evidence, secretKey, lang } = ctx.session;
    
    // UI Feedback
    let msg = await ctx.reply(`${t(ctx, 'processing')}... [■□□□□]`);

    try {
        const report = new Report({
            userId: isAnonymous ? 0 : ctx.from.id, // Zero out ID for true anonymity
            username: isAnonymous ? 'anonymous' : ctx.from.username,
            type,
            details,
            isAnonymous,
            secretKey,
            language: lang,
            evidence,
            reporterInfo: isAnonymous ? null : { name, email }
        });
        await report.save();

        // Notify Admins
        const adminMsg = 
            `🚨 <b>NEW REPORT [#${report._id.toString().slice(-6)}]</b>\n` +
            `Type: ${type.toUpperCase()}\n` +
            `Anon: ${isAnonymous ? 'YES' : 'NO'}\n` +
            `Key: ${secretKey || 'N/A'}\n\n` +
            `Details: ${details}`;
        
        for (const adminId of ADMIN_IDS) {
            await ctx.telegram.sendMessage(adminId, adminMsg, { parse_mode: 'HTML' }).catch(() => {});
            // Send evidence to admins
            for (const item of evidence) {
                if (item.fileType === 'photo') await ctx.telegram.sendPhoto(adminId, item.fileId);
                else await ctx.telegram.sendDocument(adminId, item.fileId);
            }
        }

        await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id);
        
        const successMsg = t(ctx, 'success')
            .replace('#REF', report._id.toString().slice(-6))
            .replace('#KEY', secretKey || 'N/A');
        
        await ctx.replyWithHTML(successMsg, getUI(ctx).main);

    } catch (err) {
        console.error(err);
        ctx.reply("⚠️ Error saving report.");
    }
    ctx.session = { lang: ctx.session.lang }; // Reset session but keep language
}

// --- Admin Commands ---

bot.command('broadcast', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    const msg = ctx.message.text.split(' ').slice(1).join(' ');
    if (!msg) return ctx.reply("Usage: /broadcast [message]");
    
    const users = await User.find();
    let count = 0;
    for (const user of users) {
        await ctx.telegram.sendMessage(user.telegramId, `📢 <b>Message from Melhiq:</b>\n\n${msg}`, { parse_mode: 'HTML' }).then(() => count++).catch(() => {});
    }
    ctx.reply(`Broadcast sent to ${count} users.`);
});

bot.command('check', async (ctx) => {
    const key = ctx.message.text.split(' ')[1];
    if (!key) return ctx.reply("Usage: /check [SecretKey]");
    
    try {
        const report = await Report.findOne({ secretKey: key.toUpperCase() });
        if (!report) return ctx.reply("❌ Invalid Secret Key.");
        
        const statusEmoji = report.status === 'resolved' ? '✅' : (report.status === 'reviewed' ? '👀' : '⏳');
        
        let text = `🔍 <b>Report Status</b>\n\n` +
            `ID: <code>#${report._id.toString().slice(-6)}</code>\n` +
            `Status: ${statusEmoji} <b>${report.status.toUpperCase()}</b>\n` +
            `Type: ${report.type.toUpperCase()}\n` +
            `Created: ${DateTime.fromJSDate(report.createdAt).toFormat('ff')}\n\n` +
            `📝 <b>Details:</b>\n${report.details}\n\n`;
            
        if (report.response) {
            text += `${t(ctx, 'response_from_admin')}\n${report.response}\n\n`;
        } else {
            text += `${t(ctx, 'no_response_yet')}\n\n`;
        }
        
        ctx.replyWithHTML(text);
    } catch (err) {
        ctx.reply("Error: " + err.message);
    }
});

// Admin Commands
bot.command('list', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    const reports = await Report.find({ status: 'pending' }).sort({ createdAt: 1 }).limit(10);
    if (reports.length === 0) return ctx.reply("No pending reports.");
    
    let text = "⏳ <b>Pending Reports:</b>\n\n";
    reports.forEach(r => {
        text += `• <code>${r._id.toString()}</code>\n` +
                `  Type: ${r.type.toUpperCase()}\n` +
                `  User: ${r.username}\n` +
                `  Snippet: <i>${r.details.substring(0, 50)}...</i>\n\n`;
    });
    ctx.replyWithHTML(text);
});

bot.command('stats', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    try {
        const totalReports = await Report.countDocuments();
        const pendingReports = await Report.countDocuments({ status: 'pending' });
        const resolvedReports = await Report.countDocuments({ status: 'resolved' });
        const totalUsers = await User.countDocuments();
        
        ctx.replyWithHTML(
            `📊 <b>Melhiq Stats</b>\n\n` +
            `Total Users: ${totalUsers}\n` +
            `Total Reports: ${totalReports}\n` +
            `Pending: ${pendingReports}\n` +
            `Resolved: ${resolvedReports}`
        );
    } catch (err) {
        ctx.reply("Error: " + err.message);
    }
});


bot.command('respond', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    const args = ctx.message.text.split(' ');
    if (args.length < 3) return ctx.reply("Usage: /respond [FullID] [Message]");
    
    const reportId = args[1];
    const responseText = args.slice(2).join(' ');
    
    try {
        const report = await Report.findById(reportId);
        if (!report) return ctx.reply("Report not found.");
        
        report.response = responseText;
        report.respondedAt = new Date();
        report.status = 'reviewed';
        await report.save();
        
        ctx.reply("✅ Response saved and status updated to REVIEWED.");
        
        // Notify user if identified
        if (report.userId !== 0) {
            const lang = report.language || 'en';
            const notification = STRINGS[lang].update_notification
                .replace('${REF}', report._id.toString().slice(-6))
                .replace('${MSG}', responseText);
            ctx.telegram.sendMessage(report.userId, notification, { parse_mode: 'HTML' }).catch(() => {});
        }
    } catch (err) {
        ctx.reply("Error: " + err.message);
    }
});

bot.command('resolve', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    const id = ctx.message.text.split(' ')[1];
    if (!id) return ctx.reply("Usage: /resolve [FullID]");
    
    try {
        const report = await Report.findByIdAndUpdate(id, { status: 'resolved' }, { new: true });
        if (!report) return ctx.reply("Report not found.");
        ctx.reply(`✅ Report #${report._id.toString().slice(-6)} marked as RESOLVED.`);
        
        if (report.userId !== 0) {
            const lang = report.language || 'en';
            const notification = STRINGS[lang].resolved_notification
                .replace('${REF}', report._id.toString().slice(-6));
            ctx.telegram.sendMessage(report.userId, notification, { parse_mode: 'HTML' }).catch(() => {});
        }
    } catch (err) {
        ctx.reply("Error: " + err.message);
    }
});


// Error handling & Launch
const startBot = async () => {
    try {
        await bot.launch();
        console.log('⚓ Melhiq Enhanced is sailing...');
    } catch (err) {
        if (err.message.includes('ETIMEDOUT')) {
            console.error('\n❌ TELEGRAM CONNECTION TIMEOUT');
            console.error('The bot cannot reach Telegram servers.');
            console.error('Please set a proxy in your .env file: HTTPS_PROXY=http://127.0.0.1:PORT\n');
        } else {
            console.error('🛑 Failed to launch bot:', err);
        }
        console.log('🔄 Retrying in 15 seconds...');
        setTimeout(startBot, 15000); 
    }
};

startBot();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
