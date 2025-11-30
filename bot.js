const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');
const express = require('express');
const https = require('https');
const nodemailer = require('nodemailer'); // 📧 مكتبة إرسال الإيميلات

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
// تمت إضافة 'notifications_users' و 'bot_config' للعقد المسموحة
const ALLOWED_NODES = ['users', 'comments', 'views', 'update', 'notifications_users', 'bot_config'];

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

// 📧 دالة إعداد وحفظ بيانات البريد الإلكتروني
async function saveBotConfig(key, value) {
    if (!firebaseInitialized) return false;
    try {
        await admin.database().ref(`bot_config/${key}`).set(value);
        return true;
    } catch (error) {
        console.log(`❌ خطأ في حفظ إعدادات البوت (${key}):`, error.message);
        return false;
    }
}

// 📧 دالة جلب إعدادات البريد الإلكتروني
async function getBotConfig() {
    if (!firebaseInitialized) return null;
    try {
        const snapshot = await admin.database().ref('bot_config').once('value');
        return snapshot.val();
    } catch (error) {
        return null;
    }
}

// 📧 دالة إرسال البريد الإلكتروني
async function sendEmailNotification(targetUserEmail, notificationData) {
    const config = await getBotConfig();
    
    if (!config || !config.email || !config.password) {
        console.log('⚠️ لم يتم إعداد بيانات البريد الإلكتروني. استخدم /change_email و /change_pass');
        return;
    }

    // إعداد الناقل
    let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: config.email,
            pass: config.password // كلمة مرور التطبيق
        }
    });

    // تنسيق محتوى الرسالة HTML
    const htmlContent = `
    <div style="direction: rtl; font-family: Arial, sans-serif; color: #333; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
        <h2 style="color: #d32f2f; text-align: center;">🔔 رد جديد على تعليقك!</h2>
        <hr style="border: 0; border-top: 1px solid #eee;">
        
        <div style="margin-bottom: 15px;">
            <p><strong>👤 الاسم الذي رد عليك:</strong> ${notificationData.replierName || 'مجهول'}</p>
            <p><strong>📖 اسم المانجا:</strong> ${notificationData.mangaName || 'غير محدد'}</p>
            <p><strong>💬 الرسالة:</strong></p>
            <blockquote style="background: #f9f9f9; border-right: 4px solid #d32f2f; margin: 0; padding: 10px;">
                ${notificationData.message || 'لا يوجد نص'}
            </blockquote>
            <p><strong>🕒 الوقت:</strong> ${notificationData.time || new Date().toLocaleString('ar-EG')}</p>
        </div>

        <div style="text-align: center; margin-top: 20px;">
            <a href="${notificationData.chapterLink || '#'}" style="background-color: #d32f2f; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 5px;">🔗 رابط الفصل</a>
            <a href="${notificationData.mangaLink || '#'}" style="background-color: #333; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 5px;">📚 رابط المانجا</a>
        </div>
        
        <hr style="border: 0; border-top: 1px solid #eee; margin-top: 20px;">
        <p style="font-size: 12px; color: #777; text-align: center;">تم إرسال هذا الإشعار تلقائياً من تطبيق مانجا عربية.</p>
    </div>
    `;

    let mailOptions = {
        from: `"Manga Arabic Bot" <${config.email}>`,
        to: targetUserEmail,
        subject: `💬 رد جديد من ${notificationData.replierName} في ${notificationData.mangaName}`,
        html: htmlContent
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`📧 تم إرسال إيميل بنجاح إلى: ${targetUserEmail}`);
    } catch (error) {
        console.log('❌ فشل إرسال الإيميل:', error.message);
    }
}

// 🔔 نظام مراقبة الإشعارات الجديد
function startNotificationMonitoring() {
    if (isBotPaused || !firebaseInitialized) return;

    console.log('📨 بدء مراقبة الإشعارات الجديدة...');
    const db = admin.database();
    const notificationsRef = db.ref('notifications_users');

    // الاستماع للإشعارات الجديدة المضافة لكل مستخدم
    // ملاحظة: هذا يستمع لأي تغيير في العقدة الرئيسية، قد يكون ثقيلاً إذا كان العدد ضخماً جداً
    // الحل الأمثل هو الاستماع للأطفال المضافين حديثاً
    
    notificationsRef.on('child_changed', async (userSnapshot) => {
        if (isBotPaused) return;
        
        const userId = userSnapshot.key; // معرف المستخدم الذي تلقى الإشعار
        const notifications = userSnapshot.val();
        
        // نحتاج للحصول على آخر إشعار تم إضافته
        // بما أن child_changed يعيد الكائن كاملاً، سنأخذ آخر مفتاح
        const notificationKeys = Object.keys(notifications);
        const lastNotificationKey = notificationKeys[notificationKeys.length - 1];
        const lastNotification = notifications[lastNotificationKey];

        // التأكد من أن الإشعار جديد ولم يمر عليه وقت طويل (مثلاً دقيقة واحدة) لتجنب التكرار عند إعادة التشغيل
        // هذا يتطلب وجود حقل timestamp في الإشعار، سنفترض وجوده أو نعالج فوراً
        
        console.log(`🔔 إشعار جديد للمستخدم: ${userId}`);

        // جلب بيانات المستخدم للحصول على الإيميل
        try {
            const userRef = db.ref(`users/${userId}`);
            const userSnap = await userRef.once('value');
            const userData = userSnap.val();

            if (userData && userData.email) {
                // تجهيز بيانات الإشعار للإيميل
                // تعتمد الأسماء هنا على ما ذكرته في سؤالك
                const emailData = {
                    replierName: lastNotification.userName || lastNotification.senderName || 'مستخدم', // اسم الذي رد
                    mangaName: lastNotification.mangaName || 'مانجا',
                    message: lastNotification.message || lastNotification.comment || '',
                    time: lastNotification.time || new Date().toLocaleTimeString('ar-EG'),
                    chapterLink: lastNotification.chapterLink || '',
                    mangaLink: lastNotification.mangaLink || '',
                    avatar: lastNotification.userImage || ''
                };

                // إرسال الإيميل
                await sendEmailNotification(userData.email, emailData);
            } else {
                console.log(`⚠️ المستخدم ${userId} ليس لديه بريد إلكتروني مسجل.`);
            }
        } catch (err) {
            console.log('❌ خطأ في معالجة الإشعار:', err.message);
        }
    });
    
    // معالجة الحالة التي يكون فيها المستخدم جديداً في قائمة الإشعارات (child_added على الجذر)
    notificationsRef.on('child_added', async (userSnapshot) => {
        // نفس المنطق تقريباً، ولكن هنا المستخدم يتلقى أول إشعار له
        // لتجنب إرسال إيميلات للإشعارات القديمة عند تشغيل البوت، يمكن إضافة شرط للوقت إذا توفر
    });
}

// ... (باقي دوال النسخ الاحتياطي والحماية كما هي) ...
async function createBackup() {
    if (isBotPaused || !firebaseInitialized) return false;
    try {
        const db = admin.database();
        const snapshot = await db.ref('/').once('value');
        const allData = snapshot.val() || {};
        const filteredData = {};
        let totalNodes = 0;

        for (const nodeName in allData) {
            if (ALLOWED_NODES.includes(nodeName)) {
                filteredData[nodeName] = allData[nodeName];
                totalNodes++;
            }
        }

        const jsonData = JSON.stringify(filteredData, null, 2);
        const fileName = `backup-${Date.now()}.json`;
        
        await bot.sendDocument(BACKUP_CHANNEL_ID, Buffer.from(jsonData), {}, {
            filename: fileName,
            contentType: 'application/json'
        });
        return true;
    } catch (error) {
        console.log('❌ خطأ النسخ الاحتياطي:', error.message);
        return false;
    }
}

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
        return false;
    }
}

async function addUserWarning(userId) {
    if (isBotPaused || !firebaseInitialized) return false;
    try {
        const db = admin.database();
        const userRef = db.ref(`users/${userId}`);
        const snapshot = await userRef.once('value');
        const userData = snapshot.val() || {};
        const newWarnings = (parseInt(userData.warning_comment) || 0) + 1;
        await userRef.update({ warning_comment: newWarnings.toString() });
        return newWarnings;
    } catch (error) {
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
        if (comment && comment.user_comment && containsBadWordsOrLinks(comment.user_comment)) {
            await deleteOffensiveContent(snapshot.key);
            await addUserWarning(comment.user_id);
        }
    });
    
    commentsRef.on('child_changed', async (snapshot) => {
        if (isBotPaused) return;
        const comment = snapshot.val();
        if (comment && comment.reply) {
            for (const replyKey in comment.reply) {
                const reply = comment.reply[replyKey];
                if (reply && reply.text_rep && containsBadWordsOrLinks(reply.text_rep)) {
                    await deleteOffensiveContent(snapshot.key, replyKey);
                    await addUserWarning(reply.user_id);
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

// 💬 أوامر التليجرام

// أوامر إعداد الإيميل الجديدة
bot.onText(/\/change_email (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    // تحقق من أن المرسل هو الأدمن (يمكنك إضافة تحقق من ID هنا)
    const email = match[1].trim();
    const success = await saveBotConfig('email', email);
    if (success) {
        bot.sendMessage(chatId, `✅ تم حفظ الإيميل بنجاح:\n${email}`);
    } else {
        bot.sendMessage(chatId, '❌ حدث خطأ أثناء حفظ الإيميل.');
    }
});

bot.onText(/\/change_pass (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const pass = match[1].trim();
    const success = await saveBotConfig('password', pass);
    if (success) {
        bot.sendMessage(chatId, `✅ تم حفظ كلمة المرور بنجاح.`);
    } else {
        bot.sendMessage(chatId, '❌ حدث خطأ أثناء حفظ كلمة المرور.');
    }
});

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, `🛡️ *بوت حماية وإشعارات Manga Arabic*
  
*أوامر الإعداد:*
/change_email [email] - تعيين إيميل الإرسال
/change_pass [app_password] - تعيين كلمة المرور

*الأوامر الأخرى:*
/status - حالة النظام
/pause - إيقاف مؤقت
/resume - استئناف`, { parse_mode: 'Markdown' });
});

bot.onText(/\/pause/, (msg) => {
  isBotPaused = true;
  bot.sendMessage(msg.chat.id, '⏸️ تم إيقاف البوت مؤقتاً');
});

bot.onText(/\/resume/, (msg) => {
  isBotPaused = false;
  bot.sendMessage(msg.chat.id, '▶️ تم استئناف عمل البوت');
});

bot.onText(/\/status/, async (msg) => {
    const config = await getBotConfig();
    const emailStatus = (config && config.email && config.password) ? '✅ مهيأ' : '❌ غير مهيأ';
    
    bot.sendMessage(msg.chat.id, 
    `📊 *حالة النظام*\n` +
    `🤖 البوت: ${isBotPaused ? '⏸️ متوقف' : '✅ نشط'}\n` +
    `📧 نظام الإيميل: ${emailStatus}\n` +
    `🛡️ الحماية: نشطة`, { parse_mode: 'Markdown' });
});

bot.onText(/\/backup/, async (msg) => {
  bot.sendMessage(msg.chat.id, '💾 جاري إنشاء نسخة احتياطية...');
  await createBackup();
  bot.sendMessage(msg.chat.id, '✅ تم.');
});

// معالجة الأخطاء
bot.on('polling_error', (error) => console.log('🔴 خطأ في البوت: ' + error.message));

// ⚡ التشغيل التلقائي
function startProtectionCycle() {
  setTimeout(async () => {
    try { await protectionCycle(); } 
    catch (error) { console.log('❌ خطأ الحماية:', error.message); } 
    finally { startProtectionCycle(); }
  }, 1000);
}

startProtectionCycle();

setTimeout(() => {
    startCommentMonitoring();
    startNotificationMonitoring(); // 🔔 تشغيل مراقبة الإشعارات
}, 1000);

setInterval(() => { createBackup(); }, BACKUP_INTERVAL);

// 🎯 الحفاظ على الاستيقاظ
setInterval(() => {
    https.get('https://team-manga-list.onrender.com/ping', (res) => {}).on('error', (err) => {});
}, 4 * 60 * 1000);

console.log('✅ النظام جاهز بالكامل!');
