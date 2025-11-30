const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');
const express = require('express');
const https = require('https');
const nodemailer = require('nodemailer'); // 📧 مكتبة إرسال البريد

// بدء خادم ويب لـ UptimeRobot
const app = express();
const PORT = process.env.PORT || 3000;

// طرق UptimeRobot
app.get('/', (req, res) => {
  console.log('📍 طلب على الصفحة الرئيسية');
  res.json({ 
    status: 'active', 
    service: 'Firebase Protection & Notification Bot',
    timestamp: new Date().toLocaleString('ar-EG'),
    uptime: Math.floor(process.uptime()) + ' seconds'
  });
});

app.get('/health', (req, res) => {
  console.log('❤️ طلب health check');
  res.status(200).send('OK - ' + new Date().toLocaleTimeString('ar-EG'));
});

app.get('/ping', (req, res) => {
  console.log('🏓 طلب ping');
  res.send('PONG - ' + new Date().toLocaleTimeString('ar-EG'));
});

// بدء الخادم
app.listen(PORT, '0.0.0.0', () => {
  console.log('✅ خادم ويب يعمل على المنفذ: ' + PORT);
});

console.log('🚀 بدء تشغيل البوت مع الحماية ونظام الإشعارات...');

// 🔥 الجزء الأساسي: البوت والحماية
const token = process.env.BOT_TOKEN;
if (!token) {
  console.log('❌ BOT_TOKEN غير موجود');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });
console.log('✅ بوت التليجرام متصل');

// 🔒 متغير للتحكم في حالة البوت
let isBotPaused = false;

// 📧 إعدادات البريد الإلكتروني (متغيرات في الذاكرة)
let emailConfig = {
    email: '',
    password: ''
};

// إعدادات النسخ الاحتياطي
const BACKUP_CHANNEL_ID = '-1003424582714';
const BACKUP_INTERVAL = 24 * 60 * 60 * 1000; 

// تهيئة Firebase
let firebaseInitialized = false;
try {
  if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
    admin.initializeApp({
      credential: admin.credential.cert({
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key: privateKey,
        client_email: process.env.FIREBASE_CLIENT_EMAIL
      }),
      databaseURL: 'https://manga-arabic-default-rtdb.europe-west1.firebasedatabase.app'
    });
    firebaseInitialized = true;
    console.log('✅ تم الاتصال بـ Firebase بنجاح');
  } else {
    console.log('❌ متغيرات Firebase مفقودة');
  }
} catch (firebaseError) {
  console.log('❌ خطأ في Firebase:', firebaseError.message);
}

// 🛡️ كود الحماية الأساسي
const ALLOWED_NODES = ['users', 'comments', 'views', 'update'];

// 📋 قائمة كلمات السب 
const BAD_WORDS = [
    'كس', 'عرص', 'قحبة', 'شرموطة', 'زق', 'طيز', 'كسم', 'منيوك',
    'خول', 'فاجر', 'عاهر', 'دعارة', 'شرموط', 'قحاب', 'شراميط',
    'قحبه', 'كحبة', 'كحبة', 'زبي', 'قضيب', 'مهبل', 'فرج', 'منيوكة',
    'منيوكه', 'داشر', 'داشرة', 'داشرر', 'داعر', 'داعره', 'داعرر',
    'سافل', 'سافلة', 'سافلل', 'سكس', 'sex', 'porn', 'قحب', 'قحبة',
    'قحبه', 'قحبو', 'نيك امك', 'نيكك', 'عطاي', 'نيك', 'nik',
    'Nik', 'NIK', 'Nik mok', 'nik mok', 'بنت القحبة', 
    'https-pokiklas123-wq-github-io-chapter-html', 'nikmok',
    'زكي', 'nikk', 'Nikk', 'NIKK', 'نيكسوة تاع مد', 
    'نيكسوة تاع ختك', 'نيكطيز', 'نيككس.امك', 'نيك.كس.امك', 
    'نيك.طيز.امك', 'نيك', 'سوة', 'قحبة', 'قحبا'
];

// 🛡️ نظام كشف الروابط
const LINK_PATTERNS = [
    /https?:\/\/[^\s]+/g,
    /www\.[^\s]+\.[^\s]+/g,
    /[^\s]+\.[a-z]{2,}(\/[^\s]*)?/gi,
    /t\.me\/[^\s]+/g,
    /bit\.ly\/[^\s]+/g,
    /youtu\.be\/[^\s]+/g,
    /youtube\.com\/[^\s]+/g,
    /instagram\.com\/[^\s]+/g,
    /facebook\.com\/[^\s]+/g,
    /twitter\.com\/[^\s]+/g,
    /discord\.gg\/[^\s]+/g
];

// 📧 دالة إعداد ناقل البريد
function createTransporter() {
    if (!emailConfig.email || !emailConfig.password) {
        return null;
    }
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: emailConfig.email,
            pass: emailConfig.password
        }
    });
}

// 📧 دالة إرسال إشعار بالبريد الإلكتروني
async function sendEmailNotification(targetEmail, notificationData, userName) {
    const transporter = createTransporter();
    
    if (!transporter) {
        console.log('⚠️ لم يتم إعداد البريد الإلكتروني. استخدم /change_email و /change_pass');
        return false;
    }

    // تجهيز محتوى الرسالة (HTML)
    const htmlContent = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; text-align: right; background-color: #f4f4f4; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
            <div style="background-color: #0D8ABC; color: #ffffff; padding: 20px; text-align: center;">
                <h2 style="margin: 0;">🔔 إشعار رد جديد</h2>
            </div>
            <div style="padding: 20px;">
                <p>مرحباً <strong>${userName}</strong>،</p>
                <p>قام <strong>${notificationData.user_name}</strong> بالرد على تعليقك.</p>
                
                <div style="background-color: #f9f9f9; border-right: 4px solid #0D8ABC; padding: 15px; margin: 20px 0;">
                    <div style="display: flex; align-items: center; margin-bottom: 10px;">
                        <img src="${notificationData.user_avatar}" alt="avatar" style="width: 40px; height: 40px; border-radius: 50%; margin-left: 10px;">
                        <strong>${notificationData.user_name}</strong>
                    </div>
                    <p style="margin: 0; color: #555;">${notificationData.reply}</p>
                </div>

                <div style="margin-top: 20px; border-top: 1px solid #eee; padding-top: 15px;">
                    <p><strong>📖 المانجا:</strong> ${notificationData.manga_name || 'غير محدد'}</p>
                    <p><strong>⌚ الوقت:</strong> ${new Date(parseInt(notificationData.updateAt)).toLocaleString('ar-EG')}</p>
                </div>

                <div style="text-align: center; margin-top: 30px;">
                    <a href="${notificationData.chapter_link}" style="background-color: #0D8ABC; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 5px; font-weight: bold;">عرض الرد</a>
                </div>
            </div>
            <div style="background-color: #eee; padding: 10px; text-align: center; font-size: 12px; color: #777;">
                هذه رسالة تلقائية من تطبيق المانجا
            </div>
        </div>
    </div>
    `;

    try {
        await transporter.sendMail({
            from: `"Manga Notifications" <${emailConfig.email}>`,
            to: targetEmail,
            subject: `رد جديد من ${notificationData.user_name}`,
            html: htmlContent
        });
        console.log(`📧 تم إرسال بريد إلكتروني إلى ${targetEmail}`);
        return true;
    } catch (error) {
        console.log(`❌ فشل إرسال البريد إلى ${targetEmail}:`, error.message);
        return false;
    }
}

// 🔄 نظام مراقبة الإشعارات (Notifications Monitor)
// ذاكرة مؤقتة لتجنب تكرار الإرسال لنفس الإشعار في فترة قصيرة
const processedNotifications = new Set();

function startNotificationMonitoring() {
    if (isBotPaused || !firebaseInitialized) return;

    console.log('🔔 بدء مراقبة الإشعارات الجديدة...');
    const db = admin.database();
    const usersRef = db.ref('users');

    // نستمع لأي تغيير في عقدة المستخدمين
    usersRef.on('child_changed', async (snapshot) => {
        if (isBotPaused) return;

        const userId = snapshot.key;
        const userData = snapshot.val();

        // التحقق من وجود عقدة الإشعارات
        if (userData && userData.notifications_users) {
            const notifications = userData.notifications_users;
            
            // نتحقق من كل إشعار
            for (const notifId in notifications) {
                const notification = notifications[notifId];
                
                // مفتاح فريد للإشعار لتجنب التكرار
                const uniqueNotifKey = `${userId}_${notifId}`;

                // التحقق مما إذا كان الإشعار جديداً (مثلاً خلال آخر دقيقة)
                // ولم يتم معالجته من قبل
                const currentTime = Date.now();
                const notifTime = parseInt(notification.updateAt);
                
                // نعتبره جديداً إذا كان وقته ضمن آخر 60 ثانية
                // هذا يمنع إرسال إيميلات للإشعارات القديمة عند إعادة تشغيل البوت
                const isRecent = (currentTime - notifTime) < 60000; 

                if (isRecent && !processedNotifications.has(uniqueNotifKey)) {
                    console.log(`🔔 إشعار جديد للمستخدم ${userId}`);
                    
                    // إضافة للمجموعة المعالجة
                    processedNotifications.add(uniqueNotifKey);
                    
                    // تنظيف الذاكرة بعد فترة
                    setTimeout(() => processedNotifications.delete(uniqueNotifKey), 120000);

                    // إرسال البريد الإلكتروني
                    if (userData.user_email) {
                        await sendEmailNotification(userData.user_email, notification, userData.user_name);
                    } else {
                        console.log(`⚠️ المستخدم ${userId} ليس لديه بريد إلكتروني مسجل`);
                    }
                }
            }
        }
    });
}

// ... [باقي دوال النسخ الاحتياطي والحماية كما هي في الكود الأصلي] ...
// 🔄 نظام النسخ الاحتياطي المحسن
async function createBackup() {
    if (isBotPaused || !firebaseInitialized) return false;
    try {
        console.log('💾 بدء إنشاء نسخة احتياطية...');
        const db = admin.database();
        const snapshot = await db.ref('/').once('value');
        const allData = snapshot.val() || {};
        const filteredData = {};
        let totalNodes = 0;
        let totalRecords = 0;

        for (const nodeName in allData) {
            if (ALLOWED_NODES.includes(nodeName)) {
                filteredData[nodeName] = allData[nodeName];
                totalNodes++;
                if (allData[nodeName] && typeof allData[nodeName] === 'object') {
                    totalRecords += Object.keys(allData[nodeName]).length;
                }
            }
        }

        const stats = {
            totalNodes: totalNodes,
            totalRecords: totalRecords,
            backupTime: new Date().toLocaleString('ar-EG')
        };

        let backupText = `💾 *نسخة احتياطية شاملة - ${stats.backupTime}*\n\n📊 *الإحصائيات:*\n📦 عدد العقد: ${stats.totalNodes}\n📝 إجمالي السجلات: ${stats.totalRecords}\n`;

        await bot.sendMessage(BACKUP_CHANNEL_ID, backupText, { parse_mode: 'Markdown' });

        const jsonData = JSON.stringify({ metadata: stats, data: filteredData }, null, 2);
        await bot.sendDocument(BACKUP_CHANNEL_ID, Buffer.from(jsonData), {}, {
            filename: `backup-${Date.now()}.json`,
            contentType: 'application/json'
        });

        return true;
    } catch (error) {
        console.log('❌ خطأ في النسخ الاحتياطي:', error.message);
        return false;
    }
}

// دوال الفحص المساعدة
function containsLinks(text) {
    if (!text || typeof text !== 'string') return false;
    for (const pattern of LINK_PATTERNS) {
        if (text.match(pattern)) return true;
    }
    return text.includes('%2F%2F') || text.includes('http%3A');
}

function containsBadWords(text) {
    if (!text || typeof text !== 'string') return false;
    const words = text.toLowerCase().split(/\s+/);
    for (const word of words) {
        const cleanWord = word.replace(/[.,!?;:()]/g, '');
        if (BAD_WORDS.includes(cleanWord)) return true;
    }
    return false;
}

function containsBadWordsOrLinks(text) {
    return containsBadWords(text) || containsLinks(text);
}

async function deleteOffensiveContent(commentKey, replyKey = null) {
    if (isBotPaused || !firebaseInitialized) return false;
    try {
        const db = admin.database();
        if (replyKey) {
            await db.ref(`comments/${commentKey}/reply/${replyKey}`).remove();
            return true;
        } else {
            await db.ref(`comments/${commentKey}`).remove();
            return true;
        }
    } catch (error) {
        console.log('❌ خطأ حذف:', error.message);
        return false;
    }
}

async function addUserWarning(userId, commentData = null, replyData = null) {
    if (isBotPaused || !firebaseInitialized) return false;
    try {
        const db = admin.database();
        const userRef = db.ref(`users/${userId}`);
        const snapshot = await userRef.once('value');
        const userData = snapshot.val() || {};
        const newWarnings = (parseInt(userData.warning_comment) || 0) + 1;
        
        await userRef.update({
            warning_comment: newWarnings.toString(),
            last_warning: new Date().getTime().toString()
        });

        if (commentData || replyData) {
            const warningRef = db.ref(`users/${userId}/warning_comment_${newWarnings}`);
            await warningRef.set({
                timestamp: new Date().getTime().toString(),
                chapter_id: commentData?.chapter_id || 'غير محدد',
                deleted_message: replyData ? replyData.text_rep : commentData.user_comment,
                type: replyData ? 'reply' : 'comment'
            });
        }
        return newWarnings;
    } catch (error) {
        console.log('❌ خطأ تحذير:', error.message);
        return false;
    }
}

function startCommentMonitoring() {
    if (isBotPaused || !firebaseInitialized) return;
    
    const db = admin.database();
    const commentsRef = db.ref('comments');
    
    commentsRef.on('child_added', async (snapshot) => {
        if (isBotPaused) return;
        const comment = snapshot.val();
        if (comment?.user_comment && containsBadWordsOrLinks(comment.user_comment)) {
            if (await deleteOffensiveContent(snapshot.key)) {
                await addUserWarning(comment.user_id, comment, null);
            }
        }
    });
    
    commentsRef.on('child_changed', async (snapshot) => {
        if (isBotPaused) return;
        const comment = snapshot.val();
        if (comment?.reply) {
            for (const replyKey in comment.reply) {
                const reply = comment.reply[replyKey];
                if (reply?.text_rep && containsBadWordsOrLinks(reply.text_rep)) {
                    if (await deleteOffensiveContent(snapshot.key, replyKey)) {
                        await addUserWarning(reply.user_id, comment, reply);
                    }
                }
            }
        }
    });
}

async function protectionCycle() {
    if (isBotPaused || !firebaseInitialized) return { deletedNodes: 0, deletedUsers: 0 };
    try {
        const db = admin.database();
        const snapshot = await db.ref('/').once('value');
        const data = snapshot.val();
        let deletedNodes = 0;

        if (data) {
            for (const key in data) {
                if (!ALLOWED_NODES.includes(key)) {
                    await db.ref(key).remove();
                    deletedNodes++;
                }
            }
        }
        return { deletedNodes, deletedUsers: 0 };
    } catch (error) {
        return { deletedNodes: 0, deletedUsers: 0 };
    }
}

// 💬 أوامر التليجرام الجديدة (إعدادات البريد)

// أمر /change_email
bot.onText(/\/change_email (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    // تحقق بسيط من صلاحية الأدمن (يمكنك إضافة تحقق من ID الخاص بك هنا)
    // if (chatId.toString() !== process.env.ADMIN_CHAT_ID) return;

    const newEmail = match[1].trim();
    emailConfig.email = newEmail;
    
    bot.sendMessage(chatId, `✅ تم تحديث البريد الإلكتروني للمرسل إلى:\n${newEmail}`);
    console.log(`📧 تم تحديث إيميل المرسل`);
});

// أمر /change_pass
bot.onText(/\/change_pass (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const newPass = match[1].trim();
    emailConfig.password = newPass;
    
    // نقوم بحذف الرسالة للحفاظ على السرية
    bot.deleteMessage(chatId, msg.message_id).catch(() => {});
    
    bot.sendMessage(chatId, `✅ تم تحديث كلمة المرور بنجاح.`);
    console.log(`🔑 تم تحديث كلمة مرور المرسل`);
});

// أمر /check_email_config
bot.onText(/\/check_email_config/, (msg) => {
    const chatId = msg.chat.id;
    const status = (emailConfig.email && emailConfig.password) ? '✅ مهيأ' : '❌ غير مهيأ';
    bot.sendMessage(chatId, `📧 حالة إعدادات البريد: ${status}\nالبريد الحالي: ${emailConfig.email || 'لا يوجد'}`);
});

// باقي الأوامر الأساسية
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, `🛡️ *بوت الحماية والإشعارات*\n\nاستخدم /change_email و /change_pass لضبط إعدادات البريد.`, { parse_mode: 'Markdown' });
});

bot.onText(/\/pause/, (msg) => { isBotPaused = true; bot.sendMessage(msg.chat.id, '⏸️ تم الإيقاف'); });
bot.onText(/\/resume/, (msg) => { isBotPaused = false; bot.sendMessage(msg.chat.id, '▶️ تم الاستئناف'); });

bot.onText(/\/status/, (msg) => {
    bot.sendMessage(msg.chat.id, 
        `📊 *الحالة*\nFirebase: ${firebaseInitialized ? '✅' : '❌'}\nBot: ${isBotPaused ? '⏸️' : '✅'}\nEmail: ${emailConfig.email ? '✅' : '❌'}`, 
        { parse_mode: 'Markdown' }
    );
});

bot.onText(/\/protect/, async (msg) => {
    const res = await protectionCycle();
    bot.sendMessage(msg.chat.id, `✅ تم التنظيف. حذف ${res.deletedNodes} عقدة.`);
});

bot.onText(/\/backup/, async (msg) => {
    await createBackup();
    bot.sendMessage(msg.chat.id, '✅ تم طلب النسخ الاحتياطي.');
});

// معالجة الأخطاء
bot.on('polling_error', (error) => console.log('🔴 خطأ بوت:', error.message));

// ⚡ التشغيل التلقائي
setTimeout(() => {
    startCommentMonitoring();
    startNotificationMonitoring(); // تشغيل مراقب الإشعارات
    
    // دورة الحماية كل ثانية
    setInterval(() => protectionCycle().catch(e => console.log(e.message)), 1000);
    
    // النسخ الاحتياطي
    setInterval(createBackup, BACKUP_INTERVAL);
    
    // Ping للحفاظ على الحياة
    setInterval(() => {
        https.get('https://team-manga-list.onrender.com/ping', () => {}).on('error', () => {});
    }, 4 * 60 * 1000);

}, 1000);

console.log('✅ النظام يعمل بالكامل');
