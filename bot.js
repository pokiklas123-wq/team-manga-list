const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');
const express = require('express');
const https = require('https');
const nodemailer = require('nodemailer');

// 🔐 متغيرات تخزين بيانات Gmail
let gmailConfig = {
  email: '',
  password: '',
  isConfigured: false
};

// بدء خادم ويب لـ UptimeRobot
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// طرق UptimeRobot
app.get('/', (req, res) => {
  res.json({ 
    status: 'active', 
    service: 'Firebase Protection Bot',
    timestamp: new Date().toLocaleString('ar-EG'),
    emailService: gmailConfig.isConfigured ? '✅ نشط' : '❌ غير نشط'
  });
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.get('/ping', (req, res) => {
  res.send('PONG');
});

// بدء الخادم
app.listen(PORT, '0.0.0.0', () => {
  console.log('✅ خادم ويب يعمل على المنفذ: ' + PORT);
});

console.log('🚀 بدء تشغيل البوت...');

// 🔥 البوت الأساسي
const token = process.env.BOT_TOKEN;
if (!token) {
  console.log('❌ BOT_TOKEN غير موجود');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });
console.log('✅ بوت التليجرام متصل');

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
    console.log(`📤 جاري إرسال إيميل إلى: ${userEmail}`);
    
    const transporter = nodemailer.createTransporter({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: gmailConfig.email,
        pass: gmailConfig.password
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    console.log('🔐 جاري اختبار اتصال SMTP...');
    await transporter.verify();
    console.log('✅ اتصال SMTP ناجح');

    const emailContent = `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2E86AB;">🔔 إشعار جديد - تعليق على منشورك</h2>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
          <h3 style="color: #333; margin-bottom: 10px;">👤 المستخدم الذي رد عليك:</h3>
          <p style="font-size: 18px; color: #2E86AB; font-weight: bold;">${notificationData.user_name || 'مستخدم'}</p>
          
          <h3 style="color: #333; margin-bottom: 10px;">💬 الرسالة:</h3>
          <div style="background: white; padding: 15px; border-radius: 8px; border-right: 4px solid #2E86AB;">
            <p style="margin: 0; color: #333; font-size: 16px;">${notificationData.reply || 'لا يوجد نص'}</p>
          </div>
          
          <h3 style="color: #333; margin-bottom: 10px;">⏰ الوقت:</h3>
          <p style="color: #666;">${new Date(parseInt(notificationData.updateAt) || Date.now()).toLocaleString('ar-EG')}</p>
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
          <a href="${notificationData.chapter_link || '#'}" style="background: #2E86AB; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            📖 عرض التعليقات
          </a>
        </div>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
        <p style="color: #888; font-size: 12px; text-align: center;">
          تم إرسال هذا الإيميل تلقائياً من نظام إشعارات منصة المانجا العربية
        </p>
      </div>
    `;

    const mailOptions = {
      from: `"منصة المانجا" <${gmailConfig.email}>`,
      to: userEmail,
      subject: `🔔 رد جديد من ${notificationData.user_name || 'مستخدم'}`,
      html: emailContent,
      text: `إشعار جديد\nالمستخدم: ${notificationData.user_name}\nالرسالة: ${notificationData.reply}\nالوقت: ${new Date(parseInt(notificationData.updateAt) || Date.now()).toLocaleString('ar-EG')}`
    };

    console.log('📨 جاري إرسال الإيميل...');
    const result = await transporter.sendMail(mailOptions);
    console.log(`✅ تم إرسال إيميل بنجاح إلى: ${userEmail}`);
    console.log(`📫 معرف الرسالة: ${result.messageId}`);
    return true;

  } catch (error) {
    console.log('❌ خطأ في إرسال الإيميل:', error.message);
    
    if (error.code === 'EAUTH') {
      console.log('🔐 المشكلة في المصادقة - تأكد من كلمة مرور التطبيقات');
    }
    
    return false;
  }
}

// 🆕 دالة اختبار اتصال Gmail
async function testGmailConnection() {
  if (!gmailConfig.email || !gmailConfig.password) {
    console.log('❌ بيانات Gmail غير مضبوطة');
    return false;
  }

  try {
    console.log('🔐 جاري اختبار اتصال Gmail...');
    
    const transporter = nodemailer.createTransporter({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
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

// 🔍 نظام مراقبة الإشعارات المحسن
function startNotificationsMonitoring() {
  if (isBotPaused) return;
  if (!firebaseInitialized) return;
  if (!gmailConfig.isConfigured) return;

  console.log('🔔 بدء مراقبة إشعارات المستخدمين...');
  const db = admin.database();

  const previousNotificationsState = new Map();

  const usersRef = db.ref('users');
  
  usersRef.on('child_changed', async (userSnapshot) => {
    if (isBotPaused) return;

    const userId = userSnapshot.key;
    const userData = userSnapshot.val();
    
    if (userData && userData.notifications_users) {
      const currentNotifications = userData.notifications_users;
      const userEmail = userData.user_email;
      
      if (!userEmail) {
        console.log(`⚠️ المستخدم ${userId} لا يملك إيميل`);
        return;
      }

      const previousNotifications = previousNotificationsState.get(userId) || {};

      for (const notificationKey in currentNotifications) {
        if (!previousNotifications[notificationKey]) {
          const notification = currentNotifications[notificationKey];
          console.log(`🔔 إشعار جديد للمستخدم: ${userId}`);
          console.log(`📧 الإيميل: ${userEmail}`);
          console.log(`👤 المرسل: ${notification.user_name}`);
          console.log(`💬 الرسالة: ${notification.reply}`);

          const emailSent = await sendNotificationEmail(userEmail, {
            user_name: notification.user_name,
            reply: notification.reply,
            updateAt: notification.updateAt,
            manga_name: notification.manga_name || 'مانجا',
            chapter_link: notification.chapter_link || '#'
          });

          if (emailSent) {
            console.log(`✅ تم إرسال إشعار إلى: ${userEmail}`);
          } else {
            console.log(`❌ فشل إرسال إشعار إلى: ${userEmail}`);
          }
        }
      }

      previousNotificationsState.set(userId, { ...currentNotifications });
    }
  });

  usersRef.on('child_added', (userSnapshot) => {
    const userId = userSnapshot.key;
    const userData = userSnapshot.val();
    
    if (userData && userData.notifications_users) {
      previousNotificationsState.set(userId, { ...userData.notifications_users });
    }
  });

  console.log('✅ نظام مراقبة الإشعارات يعمل');
}

// 💬 أوامر التليجرام
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  
  const botStatus = isBotPaused ? '⏸️ متوقف' : '✅ نشط';
  const emailStatus = gmailConfig.isConfigured ? '✅ مهيئ' : '❌ غير مهيئ';
  
  let message = `🛡️ *بوت الحماية - ${botStatus}*\n\n`;
  message += `📧 نظام الإيميل: ${emailStatus}\n`;
  
  if (gmailConfig.email) {
    message += `📧 الإيميل: ${gmailConfig.email}\n\n`;
  }
  
  message += `*الأوامر:*\n`;
  message += `/change_email [إيميل] - تعيين الإيميل\n`;
  message += `/change_pass [كلمة_السر] - تعيين كلمة السر\n`;
  message += `/test_gmail - اختبار اتصال Gmail\n`;
  message += `/test_email - اختبار إرسال إيميل\n`;
  message += `/email_status - حالة الإيميل\n`;
  message += `/debug_email - تشخيص مشاكل الإيميل`;

  bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
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
  bot.sendMessage(chatId, `✅ تم تعيين الإيميل: ${email}\n\nالآن استخدم /change_pass [كلمة_السر]`);
});

// أمر تغيير كلمة السر
bot.onText(/\/change_pass (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const password = match[1].trim();
  
  if (!gmailConfig.email) {
    bot.sendMessage(chatId, '❌ يجب تعيين الإيميل أولاً باستخدام /change_email');
    return;
  }
  
  gmailConfig.password = password;
  
  bot.sendMessage(chatId, '🔐 جاري اختبار اتصال Gmail...');
  
  const connectionTest = await testGmailConnection();
  if (connectionTest) {
    gmailConfig.isConfigured = true;
    bot.sendMessage(chatId, `✅ تم تهيئة نظام الإيميل بنجاح!\n\n📧 ${gmailConfig.email}\n\n🔔 تم تفعيل مراقبة الإشعارات.`);
    
    // بدء المراقبة
    setTimeout(() => {
      startNotificationsMonitoring();
    }, 2000);
  } else {
    gmailConfig.isConfigured = false;
    bot.sendMessage(chatId, `❌ فشل في الاتصال بـ Gmail!\n\n📧 ${gmailConfig.email}\n\n⚠️ المشكلة في كلمة المرور أو إعدادات Gmail.`);
  }
});

// أمر اختبار اتصال Gmail
bot.onText(/\/test_gmail/, async (msg) => {
  const chatId = msg.chat.id;
  
  if (!gmailConfig.email || !gmailConfig.password) {
    bot.sendMessage(chatId, '❌ لم يتم تعيين الإيميل أو كلمة السر');
    return;
  }
  
  bot.sendMessage(chatId, '🔐 جاري اختبار اتصال Gmail...');
  
  const success = await testGmailConnection();
  
  if (success) {
    gmailConfig.isConfigured = true;
    bot.sendMessage(chatId, '✅ اتصال Gmail ناجح!');
  } else {
    bot.sendMessage(chatId, '❌ فشل اتصال Gmail. تحقق من كلمة المرور.');
  }
});

// أمر اختبار الإيميل
bot.onText(/\/test_email/, async (msg) => {
  const chatId = msg.chat.id;
  
  if (!gmailConfig.isConfigured) {
    bot.sendMessage(chatId, '❌ نظام الإيميل غير مهيئ!');
    return;
  }
  
  bot.sendMessage(chatId, '📧 جاري اختبار إرسال الإيميل...');
  
  const testData = {
    user_name: 'Mohamed admin',
    reply: 'هذا اختبار لنظام الإشعارات. إذا استلمت هذا الإيميل، فالنظام يعمل! 🎉',
    updateAt: Date.now().toString(),
    manga_name: 'مانجا الاختبار'
  };
  
  const success = await sendNotificationEmail(gmailConfig.email, testData);
  
  if (success) {
    bot.sendMessage(chatId, `✅ تم إرسال إيميل اختبار إلى: ${gmailConfig.email}`);
  } else {
    bot.sendMessage(chatId, '❌ فشل إرسال الإيميل. استخدم /debug_email للتشخيص.');
  }
});

// 🆕 أمر تشخيص مشاكل الإيميل
bot.onText(/\/debug_email/, async (msg) => {
  const chatId = msg.chat.id;
  
  let debugInfo = `🔍 *تشخيص نظام الإيميل*\n\n`;
  
  if (!gmailConfig.email) {
    debugInfo += '❌ الإيميل غير مضبوط\nاستخدم /change_email\n\n';
  } else {
    debugInfo += `✅ الإيميل: ${gmailConfig.email}\n`;
  }
  
  if (!gmailConfig.password) {
    debugInfo += '❌ كلمة السر غير مضبوطة\nاستخدم /change_pass\n\n';
  } else {
    debugInfo += `✅ كلمة السر: مضبوطة\n`;
  }
  
  debugInfo += `\n⚙️ الإعدادات الحالية:\n`;
  debugInfo += `- مهيئ: ${gmailConfig.isConfigured ? '✅' : '❌'}\n`;
  debugInfo += `- مضبوط: ${gmailConfig.email && gmailConfig.password ? '✅' : '❌'}\n\n`;
  
  debugInfo += `🔧 *خطوات الحل:*\n`;
  debugInfo += `1. تأكد من تفعيل التحقق بخطوتين\n`;
  debugInfo += `2. أنشئ كلمة مرور التطبيقات\n`;
  debugInfo += `3. استخدم كلمة مرور التطبيقات وليس كلمة السر العادية\n`;
  debugInfo += `4. جرب /test_gmail أولاً`;
  
  bot.sendMessage(chatId, debugInfo, { parse_mode: 'Markdown' });
});

// أمر حالة الإيميل
bot.onText(/\/email_status/, (msg) => {
  const chatId = msg.chat.id;
  
  let status = '';
  
  if (!gmailConfig.isConfigured) {
    status = `❌ *نظام الإيميل غير مهيئ*\n\nاستخدم:\n/change_email [إيميل]\n/change_pass [كلمة_سر]`;
  } else {
    status = `✅ *نظام الإيميل نشط*\n\n📧 ${gmailConfig.email}\n\n🔔 مراقبة الإشعارات مفعلة`;
  }
  
  bot.sendMessage(chatId, status, { parse_mode: 'Markdown' });
});

// بدء المراقبة التلقائية إذا كانت البيانات مضبوطة
setTimeout(() => {
  if (gmailConfig.email && gmailConfig.password) {
    testGmailConnection().then(success => {
      if (success) {
        gmailConfig.isConfigured = true;
        console.log('✅ اتصال Gmail ناجح - بدء المراقبة');
        startNotificationsMonitoring();
      }
    });
  }
}, 5000);

console.log('✅ البوت جاهز! استخدم /change_email و /change_pass لبدء الإعداد.');

// باقي دوال الحماية والنسخ الاحتياطي تبقى كما هي...
// [يجب إضافة باقي الكود هنا]

// 🎯 الحفاظ على الاستيقاظ
function keepServiceAlive() {
  setInterval(() => {
    https.get('https://team-manga-list.onrender.com/ping', (res) => {
      console.log('🔄 ping ناجح');
    }).on('error', (err) => {
      console.log('⚠️ خطأ في ping: ' + err.message);
    });
  }, 4 * 60 * 1000);
}

setTimeout(keepServiceAlive, 1000);
