const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');

console.log('🚀 بدء تشغيل البوت على Render...');

const token = process.env.BOT_TOKEN;
if (!token) {
    console.log('❌ خطأ: BOT_TOKEN غير موجود');
    process.exit(1);
}

const bot = new TelegramBot(token, {polling: true});

// تهيئة Firebase
try {
    admin.initializeApp({
        credential: admin.credential.cert({
            project_id: process.env.FIREBASE_PROJECT_ID,
            private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            client_email: process.env.FIREBASE_CLIENT_EMAIL
        }),
        databaseURL: 'https://manga-arabic-default-rtdb.europe-west1.firebasedatabase.app'
    });
    console.log('✅ تم الاتصال بـ Firebase');
} catch (error) {
    console.log('❌ خطأ في Firebase:', error.message);
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
                    await db.ref(key).remove();
                    deletedNodes++;
                    console.log('🗑️ حذف: ' + key);
                }
            }
        }
        
        console.log('✅ تم حذف ' + deletedNodes + ' عقدة');
        
    } catch (error) {
        console.log('⚠️ خطأ في الحماية:', error.message);
    }
}

// أوامر التليجرام
bot.onText(/\/start/, (msg) => {
    console.log('📩 تم استلام /start');
    bot.sendMessage(msg.chat.id, '✅ البوت يعمل على سيرفر Render 24/7!');
});

bot.onText(/\/protect/, (msg) => {
    console.log('📩 تم استلام /protect');
    bot.sendMessage(msg.chat.id, '🛡️ جاري التشغيل...');
    protectionCycle().then(() => {
        bot.sendMessage(msg.chat.id, '✅ تمت الحماية!');
    });
});

bot.onText(/\/status/, (msg) => {
    bot.sendMessage(msg.chat.id, `🟢 البوت نشط
⏰ الوقت: ${new Date().toLocaleTimeString('ar-EG')}`);
});

// التشغيل التلقائي
setInterval(protectionCycle, 30000);
console.log('⏰ سأعمل كل 30 ثانية...');

// بدء الدورة الأولى
protectionCycle();

console.log('✅ البوت جاهز للعمل!');
