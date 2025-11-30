const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');
const express = require('express');
const https = require('https');
const nodemailer = require('nodemailer');

// 🔐 متغيرات تخزين بيانات Gmail
let gmailConfig = {
  email: 'riwayatisupoort@gmail.com',
  password: 'dyzf lvst iygr wnpz', // هذا لن يعمل مع التحقق بخطوتين
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

// 📧 نظام إرسال الإيميلات المحسن
async function sendNotificationEmail(userEmail, notificationData) {
  if (!gmailConfig.isConfigured) {
    console.log('❌ نظام الإيميل غير مهيئ');
    return false;
  }

  try {
    // إعدادات Nodemailer المحسنة
    const transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: gmailConfig.email,
        pass: gmailConfig.password
      },
      tls: {
        rejectUnauthorized: false
      },
      debug: true // تفعيل وضع التصحيح
    });

    // التحقق من صحة الإتصال
    await transporter.verify();
    console.log('✅ اتصال Gmail صالح');

    const emailContent = `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2E86AB;">🔔 إشعار جديد - تعليق على منشورك</h2>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
          <h3 style="color: #333; margin-bottom: 10px;">👤 المستخدم الذي رد عليك:</h3>
          <p style="font-size: 18px; color: #2E86AB; font-weight: bold;">${notificationData.user_name || 'مستخدم'}</p>
          
          <h3 style="color: #333; margin-bottom: 10px;">📖 اسم المانجا:</h3>
          <p style="font-size: 16px; color: #555;">${notificationData.manga_name || 'مانجا'}</p>
          
          <h3 style="color: #333; margin-bottom: 10px;">💬 الرسالة:</h3>
          <div style="background: white; padding: 15px; border-radius: 8px; border-right: 4px solid #2E86AB;">
            <p style="margin: 0; color: #333; font-size: 16px;">${notificationData.reply || 'لا يوجد نص'}</p>
          </div>
          
          <h3 style="color: #333; margin-bottom: 10px;">⏰ الوقت:</h3>
          <p style="color: #666;">${new Date(parseInt(notificationData.updateAt) || Date.now()).toLocaleString('ar-EG')}</p>
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
          <a href="${notificationData.manga_link || '#'}" style="background: #2E86AB; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 5px;">
            📚 عرض المانجا
          </a>
          <a href="${notificationData.chapter_link || '#'}" style="background: #A23B72; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 5px;">
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
      from: `"منصة المانجا العربية" <${gmailConfig.email}>`,
      to: userEmail,
      subject: `🔔 رد جديد على تعليقك - ${notificationData.user_name || 'مستخدم'}`,
      html: emailContent,
      // إضافة نص عادي كبديل
      text: `إشعار جديد - تعليق على منشورك\n\nالمستخدم: ${notificationData.user_name}\nالرسالة: ${notificationData.reply}\nالوقت: ${new Date(parseInt(notificationData.updateAt)).toLocaleString('ar-EG')}`
    };

    console.log(`📤 محاولة إرسال إيميل إلى: ${userEmail}`);
    const result = await transporter.sendMail(mailOptions);
    console.log(`✅ تم إرسال إيميل إشعار إلى: ${userEmail}`, result.messageId);
    return true;

  } catch (error) {
    console.log('❌ خطأ في إرسال الإيميل:', error.message);
    
    // تحليل نوع الخطأ
    if (error.code === 'EAUTH') {
      console.log('🔐 خطأ في المصادقة - تحقق من كلمة السر');
    } else if (error.code === 'ECONNECTION') {
      console.log('🌐 خطأ في الاتصال بالإنترنت');
    } else {
      console.log('⚠️ خطأ غير معروف:', error);
    }
    
    return false;
  }
}

// 🔍 نظام مراقبة الإشعارات المحسن
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

  // متغير لتخزين الحالة السابقة لكل مستخدم
  const previousNotificationsState = new Map();

  // المراقبة على مستوى كل مستخدم
  const usersRef = db.ref('users');
  
  usersRef.on('child_changed', async (userSnapshot) => {
    if (isBotPaused) return;

    const userId = userSnapshot.key;
    const userData = userSnapshot.val();
    
    console.log(`🔍 فحص تحديثات للمستخدم: ${userId}`);
    
    if (userData && userData.notifications_users) {
      const currentNotifications = userData.notifications_users;
      const userEmail = userData.user_email;
      
      if (!userEmail) {
        console.log(`⚠️ المستخدم ${userId} لا يملك إيميل - تخطي الإشعارات`);
        return;
      }

      // الحصول على الحالة السابقة لهذا المستخدم
      const previousNotifications = previousNotificationsState.get(userId) || {};

      // اكتشاف الإشعارات الجديدة
      for (const notificationKey in currentNotifications) {
        if (!previousNotifications[notificationKey]) {
          // هذا إشعار جديد
          const notification = currentNotifications[notificationKey];
          console.log(`🔔 إشعار جديد للمستخدم: ${userId}`, notification);

          // التأكد من وجود البيانات الأساسية
          if (notification.reply && notification.user_name) {
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
              
              // إرسال تأكيد للتليجرام
              sendTelegramAlert(`📧 تم إرسال إشعار إيميل\n👤 إلى: ${userEmail}\n💬 من: ${notification.user_name}`);
            } else {
              console.log(`❌ فشل إرسال إشعار للمستخدم: ${userEmail}`);
              sendTelegramAlert(`❌ فشل إرسال إشعار إيميل\n👤 إلى: ${userEmail}\n💬 من: ${notification.user_name}`);
            }
          } else {
            console.log('⚠️ إشعار ناقص البيانات:', notification);
          }
        }
      }

      // تحديث الحالة السابقة
      previousNotificationsState.set(userId, { ...currentNotifications });
    }
  });

  // أيضًا مراقبة الإضافات الجديدة
  usersRef.on('child_added', (userSnapshot) => {
    const userId = userSnapshot.key;
    const userData = userSnapshot.val();
    
    if (userData && userData.notifications_users) {
      // تخزين الحالة الأولية
      previousNotificationsState.set(userId, { ...userData.notifications_users });
    }
  });
}

// 🆕 دالة لإنشاء كلمة سر التطبيقات
function generateAppPasswordInstructions() {
  return `
🔐 *تعليمات إنشاء كلمة سر التطبيقات في Gmail*

لإرسال الإيميلات من خلال Gmail، تحتاج إلى استخدام "كلمة سر التطبيقات" بدلاً من كلمة السر العادية:

1. ⚙️ انتقل إلى [إدارة حساب Google](https://myaccount.google.com/)
2. 🔒 اضغط على "الأمان"
3. 🔑 في قسم "تسجيل الدخول إلى Google"، اضغط على "كلمات مرور التطبيقات"
4. 📱 اختر "البريد" و "جهاز الكمبيوتر" ثم انقر على "إنشاء"
5. 📋 انسخ كلمة السر المكونة من 16 حرفاً
6. 💬 استخدم الأمر: /change_pass [كلمة_السر_الجديدة]

ملاحظة: يجب تفعيل التحقق بخطوتين أولاً!
  `;
}

// 🛡️ باقي الكود (الحماية والتعليقات) يبقى كما هو
// ... [نفس كود الحماية والتعليقات السابق]

// 💬 أوامر التليجرام المحدثة

// أمر /start محدث
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  console.log('📩 /start من: ' + chatId);
  
  const botStatus = isBotPaused ? '⏸️ متوقف مؤقتاً' : '✅ نشط';
  const emailStatus = gmailConfig.isConfigured ? '✅ مهيئ' : '❌ غير مهيئ';
  
  bot.sendMessage(chatId, `🛡️ *بوت حماية Firebase - ${botStatus}*

${isBotPaused ? '⏸️ البوت متوقف مؤقتاً' : '✅ البوت يعمل بشكل طبيعي'}
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
/app_password - تعليمات كلمة سر التطبيقات

*الأوامر الأخرى:*
/protect - تشغيل حماية فورية
/backup - نسخ احتياطي فوري
/test - اختبار النظام
/scan_comments - فحص التعليقات الحالية`, { parse_mode: 'Markdown' });
});

// 🆕 أمر تعليمات كلمة سر التطبيقات
bot.onText(/\/app_password/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, generateAppPasswordInstructions(), { parse_mode: 'Markdown' });
});

// أمر تغيير الإيميل
bot.onText(/\/change_email (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const email = match[1].trim();
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    bot.sendMessage(chatId, '❌ صيغة الإيميل غير صحيحة!');
    return;
  }
  
  gmailConfig.email = email;
  gmailConfig.isConfigured = false; // إعادة التعيين حتى يتم تعيين كلمة السر
  
  bot.sendMessage(chatId, `✅ تم تعيين الإيميل: ${email}\n\nالآن استخدم /change_pass لإضافة كلمة سر التطبيقات\n\nاستخدم /app_password لمعرفة كيفية إنشاء كلمة سر التطبيقات`);
});

// أمر تغيير كلمة السر
bot.onText(/\/change_pass (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const password = match[1].trim();
  
  if (!gmailConfig.email) {
    bot.sendMessage(chatId, '❌ يجب تعيين الإيميل أولاً باستخدام /change_email');
    return;
  }
  
  gmailConfig.password = password;
  
  // اختبار الإيميل فوراً
  bot.sendMessage(chatId, '🔐 جاري اختبار إعدادات Gmail...');
  
  testGmailConnection().then(success => {
    if (success) {
      gmailConfig.isConfigured = true;
      bot.sendMessage(chatId, `✅ تم تهيئة نظام الإيميل بنجاح!\n\n📧 الإيميل: ${gmailConfig.email}\n\nسيتم الآن مراقبة الإشعارات وإرسال الإيميلات تلقائياً.`);
      console.log('✅ تم تهيئة نظام الإيميل بنجاح');
      
      // بدء مراقبة الإشعارات بعد تهيئة الإيميل
      setTimeout(() => {
        startNotificationsMonitoring();
      }, 2000);
    } else {
      gmailConfig.isConfigured = false;
      bot.sendMessage(chatId, `❌ فشل في تهيئة Gmail!\n\n⚠️ قد تحتاج إلى استخدام "كلمة سر التطبيقات"\n\nاستخدم /app_password للتعليمات`);
    }
  });
});

// 🆕 دالة اختبار اتصال Gmail
async function testGmailConnection() {
  try {
    const transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: gmailConfig.email,
        pass: gmailConfig.password
      }
    });

    await transporter.verify();
    console.log('✅ اختبار اتصال Gmail ناجح');
    return true;
  } catch (error) {
    console.log('❌ فشل اختبار اتصال Gmail:', error.message);
    return false;
  }
}

// أمر اختبار الإيميل
bot.onText(/\/test_email/, async (msg) => {
  const chatId = msg.chat.id;
  
  if (!gmailConfig.isConfigured) {
    bot.sendMessage(chatId, '❌ نظام الإيميل غير مهيئ!');
    return;
  }
  
  bot.sendMessage(chatId, '📧 جاري اختبار إرسال الإيميل...');
  
  const testData = {
    user_name: 'مستخدم تجريبي',
    reply: 'هذا رسالة تجريبية لاختبار نظام الإشعارات. إذا استلمت هذا الإيميل، فهذا يعني أن النظام يعمل بشكل صحيح! 🎉',
    updateAt: Date.now().toString(),
    manga_name: 'مانجا تجريبية',
    manga_link: 'https://example.com',
    chapter_link: 'https://example.com/chapter'
  };
  
  const success = await sendNotificationEmail(gmailConfig.email, testData);
  
  if (success) {
    bot.sendMessage(chatId, `✅ تم إرسال إيميل اختبار بنجاح إلى: ${gmailConfig.email}`);
  } else {
    bot.sendMessage(chatId, '❌ فشل إرسال إيميل الاختبار. تحقق من كلمة السر أو استخدم /app_password للتعليمات.');
  }
});

// ... [باقي الأوامر بدون تغيير]

// ⚡ بدء التشغيل التلقائي
console.log('⚡ تفعيل الحماية التلقائية كل 1 ثانية...');

// بدء مراقبة الإشعارات بعد تهيئة النظام
setTimeout(() => {
  if (gmailConfig.isConfigured) {
    startNotificationsMonitoring();
    console.log('🔔 نظام مراقبة الإشعارات مفعل');
  } else {
    console.log('⚠️ نظام الإيميل غير مهيئ - سيتم تفعيل مراقبة الإشعارات عند التهيئة');
  }
}, 5000);

// ... [باقي الكود بدون تغيير]
