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
        intro: "🛡️ <b>Our Privacy Promise</b>\n\nMelhiq is designed to be a safe, secure, and confidential platform. Whether you choose to remain anonymous or identify yourself, your information is handled with the utmost care by our safeguarding team.\n\n<i>Your voice matters. Let's make our community safer together.</i>",
        lang_choice: "Please select your language / እባክዎን ቋንቋዎን ይምረጡ፡",
        main_menu: "Main Menu",
        new_sub: "📝 New Submission",
        safety_info: "🛡️ Safety Info",
        help: "🆘 Help",
        profile: "👤 My Reports",
        step1: "<b>Step 1/5 [🔵⚪⚪⚪⚪]</b>\nWhat would you like to share?",
        step2: "<b>Step 2/5 [🔵🔵⚪⚪⚪]</b>\nPlease describe the situation in detail. What happened? When and where?",
        step3: "<b>Step 3/5 [🔵🔵🔵⚪⚪]</b>\nWould you like to attach any evidence (Photo/File)? If not, click 'Continue'.",
        step4: "<b>Step 4/5 [🔵🔵🔵🔵⚪]</b>\nHow should we handle your identity?",
        step5: "<b>Step 5/5 [🔵🔵🔵🔵🔵]</b>\nPlease provide your Name and Email for follow-up:",
        anon_desc: "👤 <b>Anonymous Mode:</b> We will NOT store your Telegram ID or name with the report. You will receive a <b>Secret Key</b> to track your report.",
        identified: "🆔 <b>Identified Mode:</b> Your name and email will be shared with the Safeguarding Team for direct follow-up.",
        success_anon: "✅ <b>Report Anchored Anonymously!</b>\n\n" +
                      "Reference ID: <code>#REF</code>\n" +
                      "Secret Key: <code>#KEY</code>\n\n" +
                      "⚠️ <b>SAVE THIS KEY!</b> It is the only way to track your report. We do not know who you are, so we cannot recover it for you.",
        success_id: "✅ <b>Report Anchored!</b>\n\n" +
                    "Reference ID: <code>#REF</code>\n\n" +
                    "You can track the status of this report in the <b>'My Reports'</b> menu.",
        summary: "📝 <b>Report Summary</b>\n\n" +
                 "Type: <b>#TYPE</b>\n" +
                 "Privacy: <b>#PRIVACY</b>\n\n" +
                 "<b>Details:</b>\n#DETAILS\n\n" +
                 "📎 <b>Evidence:</b> #EVIDENCE files\n\n" +
                 "Is this information correct?",
        confirm: "✅ Confirm & Submit",
        processing: "Securing Report",
        evidence_added: "✅ Evidence attached! (#COUNT files total)",
        continue: "➡️ Continue",
        no_reports: "📝 You have no identified reports.",
        reports_list: "📋 <b>Your Identified Reports:</b>\n\n",
        help_text: "🆘 <b>Melhiq Help Guide</b>\n\n" +
                  "• <b>📝 New Submission:</b> Start a report about safeguarding concerns.\n" +
                  "• <b>👤 Anonymous Mode:</b> Your identity is hidden. Save the Secret Key!\n" +
                  "• <b>🆔 Identified Mode:</b> We store your name/email for follow-up.\n" +
                  "• <b>📋 My Reports:</b> View and manage reports you sent in Identified Mode.\n" +
                  "• <b>🔍 Check Report:</b> Track anonymous reports with your Secret Key.",
        help_admin: "\n\n🛠️ <b>Admin Control Panel:</b>\n" +
                   "• <code>/list</code> - View pending reports\n" +
                   "• <code>/respond [ID] [Msg]</code> - Reply to a report\n" +
                   "• <code>/resolve [ID]</code> - Mark a report as finished\n" +
                   "• <code>/stats</code> - View system statistics\n" +
                   "• <code>/broadcast [Msg]</code> - Message all users",
        response_from_admin: "💬 <b>Admin Response:</b>",
        no_response_yet: "<i>Waiting for review.</i>",
        update_notification: "🔔 <b>Update on your report #${REF}:</b>\n\n${MSG}",
        resolved_notification: "✅ <b>Your report #${REF} has been resolved.</b>",
        cancel: "❌ Cancel",
        back: "⬅️ Back",
        view_details: "📄 View Details",
        delete_report: "🗑️ Withdraw Report",
        confirm_delete: "Are you sure you want to withdraw this report? This cannot be undone.",
        check_report_prompt: "🔍 Please enter your <b>Secret Key</b> to check your report status:",
        invalid_key: "❌ Invalid Secret Key. Please check and try again.",
        how_it_works: "❔ How it Works"
    },
    am: {
        welcome: "⚓ <b>እንኳን ወደ መልሕቅ በሰላም መጡ!</b>\n\nእኔ ለኢንጀንደር ሄልዝ (EngenderHealth) YAC የጥበቃ መልሕቅ ነኝ። ይህ ለእርስዎ አስተማማኝ ቦታ ነው።",
        intro: "🛡️ <b>የግላዊነት ቃል ኪዳናችን</b>\n\nመልሕቅ ደህንነቱ የተጠበቀ እና ሚስጥራዊነት ያለው መድረክ እንዲሆን ተደርጎ የተሰራ ነው። ማንነትዎን ቢደብቁም ባይደብቁም መረጃዎ በጥበቃ ቡድናችን በጥንቃቄ ይያዛል።\n\n<i>የእርስዎ ድምጽ ትልቅ ዋጋ አለው። ማህበረሰባችንን በጋራ ደህንነቱ የተጠበቀ እናድርግ።</i>",
        lang_choice: "እባክዎን ቋንቋ ይምረጡ፡",
        main_menu: "ዋና ማውጫ",
        new_sub: "📝 አዲስ ሪፖርት",
        safety_info: "🛡️ ስለ ጥበቃ",
        help: "🆘 እርዳታ",
        profile: "👤 የእኔ ሪፖርቶች",
        step1: "<b>ደረጃ 1/5 [🔵⚪⚪⚪⚪]፡ ዓይነት</b>\nምን ማጋራት ይፈልጋሉ?",
        step2: "<b>ደረጃ 2/5 [🔵🔵⚪⚪⚪]፡ ዝርዝር</b>\nእባክዎን ሁኔታውን በዝርዝር ይግለጹ። ምን ተፈጠረ? መቼ እና የት?",
        step3: "<b>ደረጃ 3/5 [🔵🔵🔵⚪⚪]፡ ማስረጃ</b>\nማስረጃ (ፎቶ/ፋይል) ማያያዝ ይፈልጋሉ? ካልፈለጉ 'ቀጥል' የሚለውን ይጫኑ።",
        step4: "<b>ደረጃ 4/5 [🔵🔵🔵🔵⚪]፡ ግላዊነት</b>\nማንነትዎ እንዴት ይያዝ?",
        step5: "<b>ደረጃ 5/5 [🔵🔵🔵🔵🔵]፡ አድራሻ</b>\nእባክዎን ለቀጣይ ክትትል ስምዎን እና ኢሜልዎን ያስገቡ፡",
        anon_desc: "👤 <b>ማንነትን መደበቅ፡</b> የእርስዎን የቴሌግራም መለያ ወይም ስም ከሪፖርቱ ጋር አንይዝም። ሪፖርቱን ለመከታተል <b>ሚስጥራዊ ቁልፍ</b> ይሰጥዎታል።",
        identified: "🆔 <b>ማንነትን ማሳወቅ፡</b> ለቀጥታ ክትትል ስምዎ እና ኢሜልዎ ለጥበቃ ቡድኑ ይጋራሉ።",
        success_anon: "✅ <b>ሪፖርቱ በምስጢር ተመዝግቧል!</b>\n\n" +
                      "መለያ ቁጥር፡ <code>#REF</code>\n" +
                      "ሚስጥራዊ ቁልፍ፡ <code>#KEY</code>\n\n" +
                      "⚠️ <b>ይህንን ቁልፍ ያስቀምጡ!</b> ሪፖርትዎን ለመከታተል ብቸኛው መንገድ ይህ ነው። ማንነትዎ ስለማይታወቅ ቁልፉ ቢጠፋ ልናገኘው አንችልም።",
        success_id: "✅ <b>ሪፖርቱ ተመዝግቧል!</b>\n\n" +
                    "መለያ ቁጥር፡ <code>#REF</code>\n\n" +
                    "የሪፖርቱን ሁኔታ <b>'የእኔ ሪፖርቶች'</b> በሚለው ማውጫ ውስጥ መከታተል ይችላሉ።",
        summary: "📝 <b>የሪፖርት ማጠቃለያ</b>\n\n" +
                 "ዓይነት፡ <b>#TYPE</b>\n" +
                 "ግላዊነት፡ <b>#PRIVACY</b>\n\n" +
                 "<b>ዝርዝር፡</b>\n#DETAILS\n\n" +
                 "📎 <b>ማስረጃ፡</b> #EVIDENCE ፋይሎች\n\n" +
                 "ትክክል ነው?",
        confirm: "✅ አረጋግጥና ላክ",
        processing: "ሪፖርቱን በማስቀመጥ ላይ",
        evidence_added: "✅ ማስረጃ ተያይዟል! (በጠቅላላ #COUNT ፋይሎች)",
        continue: "➡️ ቀጥል",
        no_reports: "📝 ምንም የተመዘገበ ሪፖርት የለዎትም።",
        reports_list: "📋 <b>የእርስዎ ሪፖርቶች፡</b>\n\n",
        help_text: "🆘 <b>የመልሕቅ እርዳታ መመሪያ</b>\n\n" +
                  "• <b>📝 አዲስ ሪፖርት፡</b> የጥበቃ ስጋቶችን ሪፖርት ለማድረግ ይጀምሩ::\n" +
                  "• <b>👤 ማንነትን መደበቅ፡</b> ማንነትዎ አይታወቅም። ሚስጥራዊ ቁልፉን ያስቀምጡ!\n" +
                  "• <b>🆔 ማንነትን ማሳወቅ፡</b> ለቀጥታ ክትትል ስምዎን/ኢሜልዎን እናስቀምጣለን።\n" +
                  "• <b>📋 የእኔ ሪፖርቶች፡</b> ስምዎን ጠቅሰው የላኳቸውን ሪፖርቶች እዚህ ያገኛሉ።\n" +
                  "• <b>🔍 ሪፖርት መከታተያ፡</b> በሚስጥራዊ ቁልፍዎ ሪፖርቶችን ይከታተሉ::",
        help_admin: "\n\n🛠️ <b>የአስተዳዳሪ መቆጣጠሪያ፡</b>\n" +
                   "• <code>/list</code> - በመጠባበቅ ላይ ያሉ ሪፖርቶችን ለማየት\n" +
                   "• <code>/respond [ID] [ምላሽ]</code> - ለሪፖርት ምላሽ ለመስጠት\n" +
                   "• <code>/resolve [ID]</code> - ሪፖርት ተጠናቋል ለማለት\n" +
                   "• <code>/stats</code> - አጠቃላይ መረጃ ለማየት\n" +
                   "• <code>/broadcast [መልዕክት]</code> - ለሁሉም ተጠቃሚዎች መልዕክት ለመላክ",
        response_from_admin: "💬 <b>የአስተዳዳሪ ምላሽ፡</b>",
        no_response_yet: "<i>ክለሳ በመጠባበቅ ላይ።</i>",
        update_notification: "🔔 <b>በሪፖርት ቁጥር #${REF} ላይ የተሰጠ ምላሽ፡</b>\n\n${MSG}",
        resolved_notification: "✅ <b>የሪፖርት ቁጥር #${REF} ተፈቷል (Resolved)።</b>",
        cancel: "❌ ሰርዝ",
        back: "⬅️ ተመለስ",
        view_details: "📄 ዝርዝር አሳይ",
        delete_report: "🗑️ ሪፖርቱን ሰርዝ",
        confirm_delete: "እርግጠኛ ነዎት ይህንን ሪፖርት መሰረዝ ይፈልጋሉ? ይህ ድርጊት ሊመለስ አይችልም።",
        check_report_prompt: "🔍 ሪፖርትዎን ለመከታተል እባክዎን <b>ሚስጥራዊ ቁልፉን</b> ያስገቡ፡",
        invalid_key: "❌ የተሳሳተ ሚስጥራዊ ቁልፍ። እባክዎን አረጋግጠው ድጋሚ ይሞክሩ።",
        how_it_works: "❔ እንዴት ነው የሚሰራው?"
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
        [Markup.button.callback('🛡️ Safeguarding / ጥበቃ', 'type_harassment')],
        [Markup.button.callback('🚫 Complaint / ቅሬታ', 'type_complaint')],
        [Markup.button.callback('💡 Suggestion / አስተያየት', 'type_feedback')],
        [Markup.button.callback(t(ctx, 'cancel'), 'cancel_report')]
    ]),

    details: Markup.inlineKeyboard([
        [Markup.button.callback(t(ctx, 'back'), 'back_to_step1')],
        [Markup.button.callback(t(ctx, 'cancel'), 'cancel_report')]
    ]),

    evidence: (count = 0) => Markup.inlineKeyboard([
        [Markup.button.callback(t(ctx, 'continue'), 'evidence_done')],
        [Markup.button.callback(t(ctx, 'back'), 'back_to_step2')],
        [Markup.button.callback(t(ctx, 'cancel'), 'cancel_report')]
    ]),

    anonymity: Markup.inlineKeyboard([
        [Markup.button.callback(t(ctx, 'anon_desc').split('\n')[0], 'anon_yes')],
        [Markup.button.callback(t(ctx, 'identified').split('\n')[0], 'anon_no')],
        [Markup.button.callback(t(ctx, 'back'), 'back_to_step3')],
        [Markup.button.callback(t(ctx, 'cancel'), 'cancel_report')]
    ]),

    contact: Markup.inlineKeyboard([
        [Markup.button.callback(t(ctx, 'back'), 'back_to_step4')],
        [Markup.button.callback(t(ctx, 'cancel'), 'cancel_report')]
    ]),

    confirmation: Markup.inlineKeyboard([
        [Markup.button.callback(t(ctx, 'confirm'), 'confirm_submit')],
        [Markup.button.callback(t(ctx, 'back'), 'back_to_anonymity')],
        [Markup.button.callback(t(ctx, 'cancel'), 'cancel_report')]
    ]),

    backOnly: Markup.inlineKeyboard([
        [Markup.button.callback(t(ctx, 'back'), 'back_to_main')]
    ])
});

const isAdmin = (id) => {
    if (!id) return false;
    const userId = id.toString().trim();
    const is = ADMIN_IDS.includes(userId);
    if (!is) {
        console.log(`🚫 [ADMIN CHECK] User ${userId} is NOT in list: [${ADMIN_IDS.join(', ')}]`);
    }
    return is;
};

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
    
    await ctx.replyWithHTML(
        t(ctx, 'intro'),
        Markup.inlineKeyboard([
            [Markup.button.callback(t(ctx, 'main_menu') + " ➡️", 'back_to_main')],
            [Markup.button.callback(t(ctx, 'how_it_works'), 'show_help_intro')]
        ])
    );
});

bot.action('show_help_intro', async (ctx) => {
    await ctx.answerCbQuery();
    await showHelp(ctx);
    await ctx.reply(t(ctx, 'main_menu'), getUI(ctx).main);
});

// Navigation Handlers
bot.action('back_to_step1', async (ctx) => {
    ctx.session.state = 'AWAITING_TYPE';
    await ctx.answerCbQuery();
    await ctx.editMessageText(t(ctx, 'step1'), { parse_mode: 'HTML', ...getUI(ctx).types });
});

bot.action('back_to_step2', async (ctx) => {
    ctx.session.state = 'AWAITING_DETAILS';
    await ctx.answerCbQuery();
    await ctx.editMessageText(t(ctx, 'step2'), { parse_mode: 'HTML', ...getUI(ctx).details });
});

bot.action('back_to_step3', async (ctx) => {
    ctx.session.state = 'AWAITING_EVIDENCE';
    await ctx.answerCbQuery();
    await ctx.editMessageText(t(ctx, 'step3'), { parse_mode: 'HTML', ...getUI(ctx).evidence(ctx.session.evidence?.length) });
});

bot.action('back_to_step4', async (ctx) => {
    ctx.session.state = 'AWAITING_ANONYMITY';
    await ctx.answerCbQuery();
    await ctx.editMessageText(t(ctx, 'step4'), { parse_mode: 'HTML', ...getUI(ctx).anonymity });
});

// Admin Button Handlers
bot.action(/admin_respond_(.+)/, async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery("Unauthorized.");
    const reportId = ctx.match[1];
    ctx.session.adminState = { state: 'REPLYING', reportId };
    await ctx.answerCbQuery();
    await ctx.reply(`✍️ Type your response for report #${reportId.slice(-6)}:`);
});

bot.action(/admin_resolve_(.+)/, async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery("Unauthorized.");
    const id = ctx.match[1];
    await ctx.answerCbQuery();
    
    try {
        const report = await Report.findByIdAndUpdate(id, { status: 'resolved' }, { new: true });
        if (!report) return ctx.reply("Report not found.");
        
        await ctx.reply(`✅ Report #${report._id.toString().slice(-6)} marked as RESOLVED.`);
        
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
        const buttons = reports.map(r => {
            const statusEmoji = r.status === 'resolved' ? '✅' : (r.status === 'reviewed' ? '👀' : '⏳');
            return [Markup.button.callback(`${statusEmoji} #${r._id.toString().slice(-6)}`, `view_${r._id}`)];
        });
        
        ctx.replyWithHTML(text, Markup.inlineKeyboard(buttons));
    } catch (err) {
        console.error('Error fetching reports:', err);
        ctx.reply("⚠️ Error loading reports.");
    }
});


bot.command('myid', (ctx) => {
    ctx.replyWithHTML(`Your Telegram ID is: <code>${ctx.from.id}</code>`);
});

bot.hears([STRINGS.en.help, STRINGS.am.help], (ctx) => {
    return showHelp(ctx);
});

bot.command('help', (ctx) => {
    return showHelp(ctx);
});

async function showHelp(ctx) {
    let text = t(ctx, 'help_text');
    if (isAdmin(ctx.from.id)) {
        text += t(ctx, 'help_admin');
    }
    const buttons = [[Markup.button.callback('🔍 Track Anonymous Report', 'prompt_check')]];
    await ctx.replyWithHTML(text, Markup.inlineKeyboard(buttons));
}

bot.action('prompt_check', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.replyWithHTML(t(ctx, 'check_report_prompt'));
});




bot.action('cancel_report', async (ctx) => {
    ctx.session = { lang: ctx.session.lang };
    await ctx.answerCbQuery();
    await ctx.reply(t(ctx, 'main_menu'), getUI(ctx).main);
});

bot.action('back_to_main', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply(t(ctx, 'main_menu'), getUI(ctx).main);
});

bot.action('back_to_anonymity', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.replyWithHTML(t(ctx, 'step4'), getUI(ctx).anonymity);
});

bot.action(/view_(.+)/, async (ctx) => {
    const id = ctx.match[1];
    try {
        const report = await Report.findById(id);
        if (!report) return ctx.answerCbQuery("Report not found.");
        
        const statusEmoji = report.status === 'resolved' ? '✅' : (report.status === 'reviewed' ? '👀' : '⏳');
        let text = `📄 <b>Report Details</b>\n\n` +
            `ID: <code>#${report._id.toString().slice(-6)}</code>\n` +
            `Status: ${statusEmoji} <b>${report.status.toUpperCase()}</b>\n` +
            `Type: ${report.type.toUpperCase()}\n\n` +
            `📝 <b>Details:</b>\n${report.details}\n\n`;
            
        if (report.response) {
            text += `${t(ctx, 'response_from_admin')}\n${report.response}\n\n`;
        }

        const buttons = [
            [Markup.button.callback(t(ctx, 'back'), 'back_to_reports')],
            [Markup.button.callback(t(ctx, 'delete_report'), `delete_${id}`)]
        ];

        await ctx.editMessageText(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
    } catch (err) {
        ctx.answerCbQuery("Error loading report.");
    }
});

bot.action('back_to_reports', async (ctx) => {
    await ctx.answerCbQuery();
    // Re-trigger the profile view logic
    const reports = await Report.find({ userId: ctx.from.id }).sort({ createdAt: -1 }).limit(10);
    const buttons = reports.map(r => {
        const statusEmoji = r.status === 'resolved' ? '✅' : (r.status === 'reviewed' ? '👀' : '⏳');
        return [Markup.button.callback(`${statusEmoji} #${r._id.toString().slice(-6)}`, `view_${r._id}`)];
    });
    await ctx.editMessageText(t(ctx, 'reports_list'), { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
});

bot.action(/delete_(.+)/, async (ctx) => {
    const id = ctx.match[1];
    const buttons = [
        [Markup.button.callback("⚠️ YES, Delete", `confirm_del_${id}`)],
        [Markup.button.callback("No, Cancel", `view_${id}`)]
    ];
    await ctx.editMessageText(t(ctx, 'confirm_delete'), Markup.inlineKeyboard(buttons));
});

bot.action(/confirm_del_(.+)/, async (ctx) => {
    const id = ctx.match[1];
    await Report.findByIdAndDelete(id);
    await ctx.answerCbQuery("Report withdrawn.");
    await ctx.editMessageText("✅ Report has been withdrawn.", Markup.inlineKeyboard([[Markup.button.callback(t(ctx, 'back'), 'back_to_reports')]]));
});

// Callback Action Handlers
bot.action(/type_(.+)/, async (ctx) => {
    ctx.session.type = ctx.match[1];
    ctx.session.state = 'AWAITING_DETAILS';
    ctx.session.evidence = [];
    await ctx.answerCbQuery();
    await ctx.editMessageText(t(ctx, 'step2'), { parse_mode: 'HTML', ...getUI(ctx).details });
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
    await showSummary(ctx);
});

bot.action('anon_no', async (ctx) => {
    ctx.session.isAnonymous = false;
    ctx.session.state = 'AWAITING_NAME';
    await ctx.answerCbQuery();
    await ctx.replyWithHTML(t(ctx, 'step5'));
});

bot.action('confirm_submit', async (ctx) => {
    await ctx.answerCbQuery();
    await finalizeReport(ctx);
});

async function showSummary(ctx) {
    const { type, details, isAnonymous, evidence, name, lang } = ctx.session;
    
    const privacyText = isAnonymous ? 
        (lang === 'am' ? '👥 ምስጢራዊ (Anonymous)' : '👥 Anonymous') : 
        (lang === 'am' ? `🆔 ማንነት የታወቀ (${name})` : `🆔 Identified (${name})`);

    const summaryMsg = t(ctx, 'summary')
        .replace('#TYPE', type.toUpperCase())
        .replace('#PRIVACY', privacyText)
        .replace('#DETAILS', details.substring(0, 1000))
        .replace('#EVIDENCE', evidence?.length || 0);

    await ctx.replyWithHTML(summaryMsg, getUI(ctx).confirmation);
}

// Universal Input Handler


async function finalizeReport(ctx) {
    const { type, details, isAnonymous, name, email, evidence, secretKey, lang } = ctx.session;
    
    // UI Feedback
    let msg = await ctx.reply(`${t(ctx, 'processing')}... [■■■■□]`);

    try {
        const report = new Report({
            userId: isAnonymous ? 0 : ctx.from.id,
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

        // Notify Admins with interactive buttons
        const adminMsg = 
            `🚨 <b>NEW REPORT: ${type.toUpperCase()}</b>\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `🆔 ID: <code>${report._id.toString()}</code>\n` +
            `👤 User: ${isAnonymous ? '<i>Anonymous</i>' : '@' + (ctx.from.username || 'N/A')}\n` +
            `🔑 Key: <code>${secretKey || 'N/A'}</code>\n\n` +
            `📝 <b>Details:</b>\n${details}\n` +
            `📎 <b>Evidence:</b> ${evidence.length} files`;
        
        const adminKeyboard = Markup.inlineKeyboard([
            [Markup.button.callback('💬 Respond', `admin_respond_${report._id}`)],
            [Markup.button.callback('✅ Resolve', `admin_resolve_${report._id}`)]
        ]);

        for (const adminId of ADMIN_IDS) {
            await ctx.telegram.sendMessage(adminId, adminMsg, { parse_mode: 'HTML', ...adminKeyboard }).catch(() => {});
            // Send evidence
            for (const item of evidence) {
                if (item.fileType === 'photo') await ctx.telegram.sendPhoto(adminId, item.fileId);
                else await ctx.telegram.sendDocument(adminId, item.fileId);
            }
        }

        await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id).catch(() => {});
        
        const successStr = isAnonymous ? t(ctx, 'success_anon') : t(ctx, 'success_id');
        const finalMsg = successStr
            .replace('#REF', report._id.toString().slice(-6))
            .replace('#KEY', secretKey || 'N/A');
        
        await ctx.replyWithHTML(finalMsg, getUI(ctx).main);

    } catch (err) {
        console.error(err);
        ctx.reply("⚠️ Error saving report.");
    }
    ctx.session = { lang: ctx.session.lang }; // Reset session
}

// --- Admin Commands ---

bot.command('broadcast', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    const msg = ctx.message.text.split(' ').slice(1).join(' ');
    if (!msg) return ctx.reply("Usage: /broadcast [message]");
    
    const users = await User.find();
    if (users.length === 0) return ctx.reply("No users found.");

    let success = 0;
    let failed = 0;
    
    const statusMsg = await ctx.reply(`🚀 Broadcasting to ${users.length} users...`);
    
    for (const user of users) {
        try {
            await ctx.telegram.sendMessage(user.telegramId, `📢 <b>Message from Melhiq:</b>\n\n${msg}`, { parse_mode: 'HTML' });
            success++;
        } catch (err) {
            failed++;
            console.log(`❌ Broadcast failed for ${user.telegramId}: ${err.message}`);
        }
    }
    
    await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
    
    ctx.replyWithHTML(
        `🏁 <b>Broadcast Report</b>\n\n` +
        `✅ Successfully Delivered: <b>${success}</b>\n` +
        `❌ Failed / Blocked: <b>${failed}</b>\n` +
        `📈 Success Rate: <b>${Math.round((success / users.length) * 100)}%</b>\n\n` +
        `<i>Note: Users who blocked the bot are counted as failed.</i>`
    );
});


bot.command('check', async (ctx) => {
    const key = ctx.message.text.split(' ')[1];
    if (!key) return ctx.replyWithHTML(t(ctx, 'check_report_prompt'));
    
    try {
        const report = await Report.findOne({ secretKey: key.toUpperCase() });
        if (!report) return ctx.reply(t(ctx, 'invalid_key'));
        
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
        
        ctx.replyWithHTML(text, getUI(ctx).backOnly);
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
                `  Type: ${r.type.toUpperCase()} | User: ${r.username}\n` +
                `  Snippet: <i>${r.details.substring(0, 50)}...</i>\n\n`;
    });
    text += "<i>Click the ID to copy, then use /respond [ID] [Message]</i>";
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

// Universal Input Handler (Registered last to avoid swallowing commands)
bot.on(['text', 'photo', 'document'], async (ctx) => {
    // 1. Handle Admin Responses
    if (ctx.session?.adminState?.state === 'REPLYING' && ctx.message.text) {
        const { reportId } = ctx.session.adminState;
        try {
            const report = await Report.findById(reportId);
            if (!report) return ctx.reply("Report not found.");

            report.response = ctx.message.text;
            report.respondedAt = new Date();
            report.status = 'reviewed';
            await report.save();

            ctx.reply("✅ Response sent to user.");
            ctx.session.adminState = null;

            if (report.userId !== 0) {
                const lang = report.language || 'en';
                const notification = STRINGS[lang].update_notification
                    .replace('${REF}', report._id.toString().slice(-6))
                    .replace('${MSG}', ctx.message.text);
                ctx.telegram.sendMessage(report.userId, notification, { parse_mode: 'HTML' }).catch(() => {});
            }
        } catch (err) {
            ctx.reply("Error sending response.");
        }
        return;
    }

    const state = ctx.session?.state;
    if (!state) return;

    // Skip if it looks like a command
    if (ctx.message.text?.startsWith('/')) return;

    if (state === 'AWAITING_DETAILS' && ctx.message.text) {
        ctx.session.details = ctx.message.text;
        ctx.session.state = 'AWAITING_EVIDENCE';
        await ctx.replyWithHTML(t(ctx, 'step3'), getUI(ctx).evidence(0));
    } 
    else if (state === 'AWAITING_EVIDENCE') {
        const fileId = ctx.message.photo ? ctx.message.photo.pop().file_id : (ctx.message.document?.file_id);
        if (fileId) {
            ctx.session.evidence = ctx.session.evidence || [];
            ctx.session.evidence.push({ fileId, fileType: ctx.message.photo ? 'photo' : 'document' });
            const count = ctx.session.evidence.length;
            await ctx.reply(t(ctx, 'evidence_added').replace('#COUNT', count), getUI(ctx).evidence(count));
        }
    }
    else if (state === 'AWAITING_NAME' && ctx.message.text) {
        ctx.session.name = ctx.message.text;
        ctx.session.state = 'AWAITING_EMAIL';
        await ctx.reply("Email / ኢሜል:", getUI(ctx).contact);
    }
    else if (state === 'AWAITING_EMAIL' && ctx.message.text) {
        ctx.session.email = ctx.message.text;
        await showSummary(ctx);
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
