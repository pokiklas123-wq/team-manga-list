const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');
const express = require('express');
const https = require('https');

// بدء خادم ويب بسيط
const app = express();
const PORT = process.env.PORT || 3000;

// ✅ طرق UptimeRobot الأساسية
app.get('/', (req, res) => {
  console.log('✅ طلب على / الرئيسية');
  res.json({ 
    status: 'active', 
    service: 'Firebase Protection Bot',
    timestamp: new Date().toLocaleString('ar-EG'),
    uptime: Math.floor(process.uptime()) + ' seconds'
  });
});

app.get('/health', (req, res) => {
  console.log('✅ طلب health check');
  res.status(200).send('OK - ' + new Date().toLocaleTimeString('ar-EG'));
});

app.get('/status', (req, res) => {
  console.log('✅ طلب status');
  res.json({
    status: 'online',
    database: 'connected',
    last_activity: new Date().toLocaleString('ar-EG'),
    version: '2.1'
  });
});

app.get('/ping', (req, res) => {
  console.log('✅ طلب ping');
  res.send('PONG - ' + new Date().toLocaleTimeString('ar-EG'));
});

// بدء الخادم
app.listen(PORT, '0.0.0.0', () => {
  console.log('✅ خادم ويب يعمل على المنفذ: ' + PORT);
  console.log('✅ طرق UptimeRobot جاهزة: /, /health, /status, /ping');
});

console.log('🚀 بدء تشغيل البوت على Render...');

// 🛑 تأخير تشغيل البوت قليلاً لضمان بدء الخادم أولاً
setTimeout(() => {
  // التوكن والمتغيرات
  const token = process.env.BOT_TOKEN;
  if (!token) {
    console.log('❌ BOT_TOKEN غير موجود');
    return;
  }

  try {
    const bot = new TelegramBot(token, { polling: true });
    console.log('✅ بوت التليجرام متصل');

    // تهيئة Firebase
    if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL) {
      try {
        const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
        admin.initializeApp({
          credential: admin.credential.cert({
            project_id: process.env.FIREBASE_PROJECT_ID,
            private_key: privateKey,
            client_email: process.env.FIREBASE_CLIENT_EMAIL
          }),
          databaseURL: 'https://manga-arabic-default-rtdb.europe-west1.firebasedatabase.app'
        });
        console.log('✅ تم الاتصال بـ Firebase بنجاح');
      } catch (firebaseError) {
        console.log('❌ خطأ في Firebase:', firebaseError.message);
      }
    } else {
      console.log('⚠️ متغيرات Firebase غير موجودة، تخطي الاتصال');
    }

    // أوامر التليجرام الأساسية
    bot.onText(/\/start/, (msg) => {
      bot.sendMessage(msg.chat.id, '✅ البوت يعمل! الخادم نشط وجاهز.');
    });

    bot.onText(/\/status/, (msg) => {
      bot.sendMessage(msg.chat.id, `🟢 حالة النظام:
• الخادم: نشط
• الوقت: ${new Date().toLocaleTimeString('ar-EG')}
• Uptime: ${Math.floor(process.uptime())} ثانية`);
    });

    bot.onText(/\/test/, (msg) => {
      bot.sendMessage(msg.chat.id, '✅ الاختبار ناجح! البوت يستجيب فوراً.');
    });

    // معالجة أخطاء البوت
    bot.on('polling_error', (error) => {
      console.log('🔴 خطأ في البوت:', error.message);
    });

    console.log('✅ جميع الأنظمة جاهزة للعمل!');

  } catch (botError) {
    console.log('❌ خطأ في تشغيل البوت:', botError.message);
  }
}, 2000);

// ✅ وظيفة الحفاظ على الاستيقاظ
function keepServiceAlive() {
  console.log('🔧 تفعيل الحفاظ على الاستيقاظ...');
  
  const urls = [
    'https://team-manga-list.onrender.com',
    'https://team-manga-list.onrender.com/health',
    'https://team-manga-list.onrender.com/ping'
  ];
  
  setInterval(() => {
    urls.forEach(url => {
      https.get(url, (res) => {
        console.log('🔄 ping ناجح: ' + url);
      }).on('error', (err) => {
        console.log('⚠️ خطأ في ping: ' + url + ' - ' + err.message);
      });
    });
  }, 4 * 60 * 1000); // كل 4 دقائق
}

// بدء الحفاظ على الاستيقاظ بعد 10 ثانية
setTimeout(keepServiceAlive, 10000);

console.log('✅ التهيئة الكاملة مكتملة!');
