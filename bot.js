const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');
const express = require('express');

// بدء خادم ويب بسيط للحفاظ على استيقاظ التطبيق
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('🟢 البوت يعمل!');
});

app.listen(port, () => {
  console.log(`🌐 خادم ويب يعمل على المنفذ ${port}`);
});

console.log('🚀 بدء تشغيل البوت على Render...');

// التحقق من وجود التوكن
const token = process.env.BOT_TOKEN;
if (!token) {
  console.log('❌ خطأ: BOT_TOKEN غير موجود');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

// التحقق من متغيرات Firebase
if (!process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL) {
  console.log('❌ خطأ: متغيرات Firebase مفقودة');
  process.exit(1);
}

// تهيئة Firebase بشكل آمن
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
} catch (error) {
  console.log('❌ خطأ في تهيئة Firebase:', error.message);
  process.exit(1);
}

// كود الحماية
const ALLOWED_NODES = ['users', 'comments', 'views', 'update'];

async function protectionCycle() {
  try {
    console.log('🔍 دورة حماية - ' + new Date().toLocaleTimeString('ar-EG'));
    
    const db = admin.database();
    const snapshot = await db.ref('/').once('value');
    const data = snapshot.val();

    let deletedNodes = 0;
    if (data) {
      for (const key in data) {
        if (!ALLOWED_NODES.includes(key)) {
          await db.ref(key).remove().catch(e => {
            console.log('⚠️ خطأ في حذف ' + key + ': ' + e.message);
          });
          deletedNodes++;
          console.log('🗑️ حذف: ' + key);
        }
      }
    }
    
    // حذف المستخدمين غير المسموحين
    try {
      const auth = admin.auth();
      const dbUsers = await db.ref('users').once('value');
      const dbData = dbUsers.val() || {};
      const allowedUIDs = new Set(Object.keys(dbData));
      
      const authUsers = await auth.listUsers(1000);
      const usersToDelete = [];
      
      for (const user of authUsers.users) {
        if (!allowedUIDs.has(user.uid)) {
          usersToDelete.push(user.uid);
        }
      }
      
      if (usersToDelete.length > 0) {
        await auth.deleteUsers(usersToDelete);
        console.log('👥 تم حذف ' + usersToDelete.length + ' مستخدم');
      }
    } catch (authError) {
      console.log('⚠️ خطأ في إدارة المستخدمين:', authError.message);
    }
    
    console.log('✅ اكتملت دورة الحماية - تم حذف ' + deletedNodes + ' عقدة');
    
  } catch (error) {
    console.log('⚠️ خطأ في دورة الحماية:', error.message);
  }
}

// أوامر التليجرام
bot.onText(/\/start/, (msg) => {
  console.log('📩 تم استلام /start من: ' + msg.chat.id);
  bot.sendMessage(msg.chat.id, '✅ البوت يعمل على سيرفر Render 24/7!\nاستخدم /protect للحماية الفورية');
});

bot.onText(/\/status/, (msg) => {
  bot.sendMessage(msg.chat.id, `🟢 حالة البوت:
• الخادم: نشط
• الوقت: ${new Date().toLocaleTimeString('ar-EG')}
• Firebase: متصل
• الحماية: تعمل تلقائياً`);
});

bot.onText(/\/protect/, (msg) => {
  console.log('📩 تم استلام /protect');
  bot.sendMessage(msg.chat.id, '🛡️ جاري تشغيل دورة حماية فورية...');
  protectionCycle().then(() => {
    bot.sendMessage(msg.chat.id, '✅ تمت الحماية الفورية بنجاح!');
  }).catch(error => {
    bot.sendMessage(msg.chat.id, '❌ فشلت الحماية: ' + error.message);
  });
});

bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id, `📋 أوامر البوت:
/start - بدء البوت
/status - حالة النظام  
/protect - حماية فورية
/help - المساعدة

🔧 البوت يحمي قاعدة البيانات تلقائياً كل 30 ثانية`);
});





// معالجة أخطاء البوت
bot.on('polling_error', (error) => {
  console.log('🔴 خطأ في البوت:', error.message);
});

// التشغيل التلقائي كل 30 ثانية
setInterval(protectionCycle, 30000);
console.log('⏰ تم ضبط التشغيل التلقائي كل 30 ثانية');

// بدء الدورة الأولى بعد 5 ثواني
setTimeout(protectionCycle, 5000);

console.log('✅ البوت جاهز للعمل!');



// 🆕 كود الحفاظ على استيقاظ البوت
const https = require('https');

function keepServiceAlive() {
    setInterval(() => {
        const url = process.env.RENDER_URL || 'https://team-manga-list.onrender.com';
        
        https.get(url, (res) => {
            console.log('🔄 حافظت على استيقاظ البوت: ' + new Date().toLocaleTimeString('ar-EG'));
        }).on('error', (err) => {
            console.log('⚠️ خطأ في الحفاظ على الاستيقاظ: ' + err.message);
            
            // محاولة بديلة
            https.get('https://google.com', () => {
                console.log('🔗 اتصال إنترنت نشط');
            });
        });
    }, 10 * 60 * 1000); // كل 10 دقائق
}

// بدء الحفاظ على الاستيقاظ
keepServiceAlive();
console.log('⏰ تم تفعيل الحفاظ على الاستيقاظ كل 10 دقائق');
