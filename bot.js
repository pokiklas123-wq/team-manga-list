const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');
const express = require('express');
const https = require('https');
const nodemailer = require('nodemailer');

// 🔐 متغيرات تخزين بيانات Gmail
let gmailConfig = {
  email: 'riwayatisupoort@gmail.com',
  password: 'dyzf lvst iygr wnpz',
  isConfigured: false
};

// بدء خادم ويب لـ UptimeRobot
const app = express();
const PORT = process.env.PORT || 3000;

// طرق UptimeRobot
app.get('/', (req, res) => {
  console.log('📍 طلب على الصفحة الرئيسية');
  res.json({ 
    status: 'active', 
    service: 'Firebase Protection Bot',
    timestamp: new Date().toLocaleString('ar-EG'),
    uptime: Math.floor(process.uptime()) + ' seconds',
    emailService: gmailConfig.isConfigured ? '✅ نشط' : '❌ غير نشط'
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

console.log('🚀 بدء تشغيل البوت مع الحماية النشطة والنسخ الاحتياطي ونظام الإشعارات...');

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

// إعدادات النسخ الاحتياطي - تم التعديل إلى 24 ساعة
const BACKUP_CHANNEL_ID = '-1003424582714';
const BACKUP_INTERVAL = 24 * 60 * 60 * 1000; // كل 24 ساعة بدلاً من كل ساعة

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

// 📧 نظام إرسال الإيميلات
async function sendNotificationEmail(userEmail, notificationData) {
  if (!gmailConfig.isConfigured) {
    console.log('❌ نظام الإيميل غير مهيئ');
    return false;
  }

  try {
    const transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: gmailConfig.email,
        pass: gmailConfig.password
      }
    });

    const emailContent = `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2E86AB;">🔔 إشعار جديد - تعليق على منشورك</h2>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
          <h3 style="color: #333; margin-bottom: 10px;">👤 المستخدم الذي رد عليك:</h3>
          <p style="font-size: 18px; color: #2E86AB; font-weight: bold;">${notificationData.user_name}</p>
          
          <h3 style="color: #333; margin-bottom: 10px;">📖 اسم المانجا:</h3>
          <p style="font-size: 16px; color: #555;">${notificationData.manga_name || 'غير محدد'}</p>
          
          <h3 style="color: #333; margin-bottom: 10px;">💬 الرسالة:</h3>
          <div style="background: white; padding: 15px; border-radius: 8px; border-right: 4px solid #2E86AB;">
            <p style="margin: 0; color: #333; font-size: 16px;">${notificationData.reply}</p>
          </div>
          
          <h3 style="color: #333; margin-bottom: 10px;">⏰ الوقت:</h3>
          <p style="color: #666;">${new Date(parseInt(notificationData.updateAt)).toLocaleString('ar-EG')}</p>
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
          <a href="${notificationData.manga_link}" style="background: #2E86AB; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            📚 عرض المانجا
          </a>
          <a href="${notificationData.chapter_link}" style="background: #A23B72; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin-right: 10px;">
            📖 عرض الفصل
          </a>
        </div>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
        <p style="color: #888; font-size: 12px; text-align: center;">
          تم إرسال هذا الإيميل تلقائياً من نظام إشعارات منصة المانجا العربية
        </p>
      </div>
    `;

    const mailOptions = {
      from: gmailConfig.email,
      to: userEmail,
      subject: `🔔 رد جديد على تعليقك - ${notificationData.user_name}`,
      html: emailContent
    };

    const result = await transporter.sendMail(mailOptions);
    console.log(`✅ تم إرسال إيميل إشعار إلى: ${userEmail}`);
    return true;

  } catch (error) {
    console.log('❌ خطأ في إرسال الإيميل:', error.message);
    return false;
  }
}

// 🔍 نظام مراقبة الإشعارات
function startNotificationsMonitoring() {
  if (isBotPaused) {
    console.log('⏸️ البوت متوقف مؤقتاً - تعطيل مراقبة الإشعارات');
    return;
  }

  if (!firebaseInitialized) {
    console.log('❌ Firebase غير متصل - تعطيل مراقبة الإشعارات');
    return;
  }

  if (!gmailConfig.isConfigured) {
    console.log('❌ نظام الإيميل غير مهيئ - تعطيل مراقبة الإشعارات');
    return;
  }

  console.log('🔔 بدء مراقبة إشعارات المستخدمين...');
  const db = admin.database();

  // مراقبة جميع المستخدمين
  const usersRef = db.ref('users');
  usersRef.on('child_changed', async (userSnapshot) => {
    if (isBotPaused) return;

    const userId = userSnapshot.key;
    const userData = userSnapshot.val();
    
    if (userData && userData.notifications_users) {
      const notifications = userData.notifications_users;
      const userEmail = userData.user_email;
      
      if (!userEmail) {
        console.log(`⚠️ المستخدم ${userId} لا يملك إيميل - تخطي الإشعارات`);
        return;
      }

      // الحصول على الإشعارات السابقة للمقارنة
      const previousSnapshot = await usersRef.child(userId).once('value');
      const previousData = previousSnapshot.val() || {};
      const previousNotifications = previousData.notifications_users || {};

      // اكتشاف الإشعارات الجديدة
      for (const notificationKey in notifications) {
        if (!previousNotifications[notificationKey]) {
          // هذا إشعار جديد
          const notification = notifications[notificationKey];
          console.log(`🔔 إشعار جديد للمستخدم: ${userId}`);

          // إرسال إيميل إشعار
          const emailSent = await sendNotificationEmail(userEmail, {
            user_name: notification.user_name,
            user_avatar: notification.user_avatar,
            reply: notification.reply,
            updateAt: notification.updateAt,
            manga_name: notification.manga_name || 'مانجا',
            manga_link: notification.manga_link || '#',
            chapter_link: notification.chapter_link || '#',
            comment_key: notification.comment_key || ''
          });

          if (emailSent) {
            console.log(`✅ تم إرسال إشعار بالبريد الإلكتروني للمستخدم: ${userEmail}`);
          } else {
            console.log(`❌ فشل إرسال إشعار للمستخدم: ${userEmail}`);
          }
        }
      }
    }
  });
}

// 🛡️ كود الحماية الأساسي (يبقى كما هو)
const ALLOWED_NODES = ['users', 'comments', 'views', 'update'];

// 📋 قائمة كلمات السب المحسنة (تبقى كما هي)
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

// 🛡️ نظام كشف الروابط المتقدم (يبقى كما هو)
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

// 🔄 نظام النسخ الاحتياطي المحسن (يبقى كما هو)
async function createBackup() {
    // ... (نفس الكود السابق)
}

// 🔍 دالة كشف الروابط المحسنة (تبقى كما هي)
function containsLinks(text) {
    // ... (نفس الكود السابق)
}

// 🔍 دالة للكشف عن السب (تبقى كما هي)
function containsBadWords(text) {
    // ... (نفس الكود السابق)
}

// 🛡️ دالة الفحص الرئيسية المحسنة (تبقى كما هي)
function containsBadWordsOrLinks(text) {
    // ... (نفس الكود السابق)
}

// 🗑️ دالة حذف التعليق/الرد مع تحديث العداد (تبقى كما هي)
async function deleteOffensiveContent(commentKey, replyKey = null) {
    // ... (نفس الكود السابق)
}

// ⚠️ دالة إضافة تحذير للمستخدم (تبقى كما هي)
async function addUserWarning(userId, commentData = null, replyData = null) {
    // ... (نفس الكود السابق)
}

// 🔄 نظام المراقبة التلقائية المحسن (تبقى كما هي)
function startCommentMonitoring() {
    // ... (نفس الكود السابق)
}

// 📨 دالة إرسال تنبيهات التليجرام (تبقى كما هي)
function sendTelegramAlert(message) {
    // ... (نفس الكود السابق)
}

// 🔍 دورة فحص التعليقات الحالية (تبقى كما هي)
async function scanExistingComments() {
    // ... (نفس الكود السابق)
}

// 🛡️ دورة الحماية الرئيسية (تبقى كما هي)
async function protectionCycle() {
    // ... (نفس الكود السابق)
}

// 💬 أوامر التليجرام الكاملة - مع إضافة الأوامر الجديدة

// أمر /start محدث
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  console.log('📩 /start من: ' + chatId);
  
  const botStatus = isBotPaused ? '⏸️ متوقف مؤقتاً' : '✅ نشط';
  const emailStatus = gmailConfig.isConfigured ? '✅ مهيئ' : '❌ غير مهيئ';
  
  bot.sendMessage(chatId, `🛡️ *بوت حماية Firebase - ${botStatus}*

${isBotStatus ? '⏸️ البوت متوقف مؤقتاً' : '✅ البوت يعمل بشكل طبيعي'}
📧 نظام الإيميل: ${emailStatus}

*أوامر التحكم:*
/pause - إيقاف مؤقت
/resume - استئناف العمل
/status - حالة النظام

*أوامر الإيميل:*
/change_email [إيميل] - تغيير إيميل Gmail
/change_pass [كلمة سر] - تغيير كلمة السر
/email_status - حالة نظام الإيميل
/test_email - اختبار إرسال إيميل

*الأوامر الأخرى:*
/protect - تشغيل حماية فورية
/backup - نسخ احتياطي فوري
/test - اختبار النظام
/scan_comments - فحص التعليقات الحالية
/badwords_list - عرض الكلمات الممنوعة
/test_filter [نص] - اختبار الفلتر
/test_links [نص] - اختبار كشف الروابط
/add_word [كلمة] - إضافة كلمة ممنوعة
/remove_word [كلمة] - إزالة كلمة ممنوعة`, { parse_mode: 'Markdown' });
});

// 🆕 أمر تغيير الإيميل
bot.onText(/\/change_email (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const email = match[1].trim();
  
  // التحقق من صحة الإيميل
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    bot.sendMessage(chatId, '❌ صيغة الإيميل غير صحيحة!');
    return;
  }
  
  gmailConfig.email = email;
  bot.sendMessage(chatId, `✅ تم تعيين الإيميل: ${email}\n\nالآن استخدم /change_pass لإضافة كلمة السر`);
});

// 🆕 أمر تغيير كلمة السر
bot.onText(/\/change_pass (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const password = match[1].trim();
  
  if (!gmailConfig.email) {
    bot.sendMessage(chatId, '❌ يجب تعيين الإيميل أولاً باستخدام /change_email');
    return;
  }
  
  gmailConfig.password = password;
  gmailConfig.isConfigured = true;
  
  bot.sendMessage(chatId, `✅ تم تهيئة نظام الإيميل بنجاح!\n\n📧 الإيميل: ${gmailConfig.email}\n\nسيتم الآن مراقبة الإشعارات وإرسال الإيميلات تلقائياً.`);
  console.log('✅ تم تهيئة نظام الإيميل بنجاح');
  
  // بدء مراقبة الإشعارات بعد تهيئة الإيميل
  setTimeout(() => {
    startNotificationsMonitoring();
  }, 2000);
});

// 🆕 أمر حالة الإيميل
bot.onText(/\/email_status/, (msg) => {
  const chatId = msg.chat.id;
  
  const status = gmailConfig.isConfigured ? 
    `✅ *نظام الإيميل نشط*\n\n📧 الإيميل: ${gmailConfig.email}\n\nجميع الإشعارات الجديدة سيتم إرسالها تلقائياً.` :
    '❌ *نظام الإيميل غير مهيئ*\n\nاستخدم /change_email و /change_pass لتهيئة النظام.';
  
  bot.sendMessage(chatId, status, { parse_mode: 'Markdown' });
});

// 🆕 أمر اختبار الإيميل
bot.onText(/\/test_email/, async (msg) => {
  const chatId = msg.chat.id;
  
  if (!gmailConfig.isConfigured) {
    bot.sendMessage(chatId, '❌ نظام الإيميل غير مهيئ!');
    return;
  }
  
  bot.sendMessage(chatId, '📧 جاري اختبار إرسال الإيميل...');
  
  const testData = {
    user_name: 'مستخدم تجريبي',
    reply: 'هذا رسالة تجريبية لاختبار نظام الإشعارات',
    updateAt: Date.now().toString(),
    manga_name: 'مانجا تجريبية',
    manga_link: 'https://example.com',
    chapter_link: 'https://example.com/chapter'
  };
  
  const success = await sendNotificationEmail(gmailConfig.email, testData);
  
  if (success) {
    bot.sendMessage(chatId, `✅ تم إرسال إيميل اختبار بنجاح إلى: ${gmailConfig.email}`);
  } else {
    bot.sendMessage(chatId, '❌ فشل إرسال إيميل الاختبار. راجع السجلات للتفاصيل.');
  }
});

// الأوامر الأخرى تبقى كما هي (لا تغيير)
bot.onText(/\/pause/, (msg) => {
  // ... (نفس الكود السابق)
});

bot.onText(/\/resume/, (msg) => {
  // ... (نفس الكود السابق)
});

bot.onText(/\/status/, (msg) => {
  // ... (نفس الكود السابق)
});

// ... باقي الأوامر بدون تغيير

// معالجة أخطاء البوت
bot.on('polling_error', (error) => {
  console.log('🔴 خطأ في البوت: ' + error.message);
});

// ⚡ التشغيل التلقائي كل 1 ثانية - محسن
console.log('⚡ تفعيل الحماية التلقائية كل 1 ثانية...');

function startProtectionCycle() {
  setTimeout(async () => {
    try {
      await protectionCycle();
    } catch (error) {
      console.log('❌ خطأ في دورة الحماية: ' + error.message);
    } finally {
      // تشغيل الدورة التالية بعد ثانية واحدة من انتهاء الدورة الحالية
      startProtectionCycle();
    }
  }, 1000); // 1 ثانية
}

// بدء دورة الحماية
startProtectionCycle();

// تفعيل نظام مراقبة التعليقات بعد 5 ثواني من التشغيل
setTimeout(() => {
    startCommentMonitoring();
    setTimeout(() => {
        scanExistingComments();
    }, 3000);
}, 1000);

// 🕒 نظام النسخ الاحتياطي التلقائي - تم التعديل إلى 24 ساعة
console.log('💾 تفعيل النسخ الاحتياطي التلقائي كل 24 ساعة...');
setInterval(() => {
    createBackup();
}, BACKUP_INTERVAL);

// بدء النسخ الاحتياطي الأول بعد 1 ثانية من التشغيل
setTimeout(() => {
    createBackup();
}, 1000);

// 🎯 الحفاظ على الاستيقاظ
function keepServiceAlive() {
  console.log('🔧 تفعيل الحفاظ على الاستيقاظ...');
  
  setInterval(() => {
    https.get('https://team-manga-list.onrender.com/ping', (res) => {
      console.log('🔄 ping ناجح: ' + new Date().toLocaleTimeString('ar-EG'));
    }).on('error', (err) => {
      console.log('⚠️ خطأ في ping: ' + err.message);
    });
  }, 4 * 60 * 1000);
}

// بدء الحفاظ على الاستيقاظ بعد 1 ثانية
setTimeout(keepServiceAlive, 1000);

console.log('✅ النظام جاهز! الحماية التلقائية تعمل كل ثانية وجميع الأوامر نشطة.');
