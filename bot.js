const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');
const express = require('express');
const https = require('https');

// 📢 إعدادات قناة النسخ الاحتياطي
const BACKUP_CHANNEL_ID = '-1003424582714'; // القناة التي سيتم إرسال الملفات إليها

// بدء خادم ويب لـ UptimeRobot
const app = express();
const PORT = process.env.PORT || 3000;

// طرق UptimeRobot
app.get('/', (req, res) => {
  console.log('📍 طلب على الصفحة الرئيسية');
  res.json({ 
    status: 'active', 
    service: 'Firebase Protection & Backup Bot',
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

console.log('🚀 بدء تشغيل البوت مع الحماية والنسخ الاحتياطي...');

// 🔥 الجزء الأساسي: البوت والحماية
const token = process.env.BOT_TOKEN;
if (!token) {
  console.log('❌ BOT_TOKEN غير موجود');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });
console.log('✅ بوت التليجرام متصل');

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

// 📋 قائمة كلمات السب المحسنة
const BAD_WORDS = [
    'كس', 'عرص', 'قحبة', 'شرموطة', 'زق', 'طيز', 'كسم', 'منيوك', 
    'خول', 'فاجر', 'عاهر', 'دعارة', 'شرموط', 'قحاب', 'شراميط', 
    'قحبه', 'كحبة', 'كحبه', 'زبي', 'قضيب', 'مهبل', 'فرج', 'منيوكة', 
    'منيوكه', 'داشر', 'داشرة', 'داشرر', 'داعر', 'داعره', 'داعرر', 
    'سافل', 'سافلة', 'سافلل', 'سكس', 'sex', 'porn', 'قحب', 'قحبة', 
    'قحبه', 'قحبو', 'نيك امك', 'نيكك', 'عطاي', 'نيك'
];

// 🛡️ نظام كشف الروابط المتقدم
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

// 🔍 دالة كشف الروابط
function containsLinks(text) {
    if (!text || typeof text !== 'string') return false;
    for (const pattern of LINK_PATTERNS) {
        if (text.match(pattern)) return true;
    }
    if (text.includes('%2F%2F') || text.includes('http%3A')) return true;
    return false;
}

// 🔍 دالة للكشف عن السب
function containsBadWords(text) {
    if (!text || typeof text !== 'string') return false;
    const words = text.toLowerCase().split(/\s+/);
    for (const word of words) {
        const cleanWord = word.replace(/[.,!?;:()]/g, '');
        for (const badWord of BAD_WORDS) {
            if (cleanWord === badWord.toLowerCase()) return true;
        }
    }
    return false;
}

function containsBadWordsOrLinks(text) {
    return containsBadWords(text) || containsLinks(text);
}

// 🗑️ دالة حذف التعليق/الرد
async function deleteOffensiveContent(commentKey, replyKey = null) {
    if (!firebaseInitialized) return false;
    try {
        const db = admin.database();
        if (replyKey) {
            const commentRef = db.ref(`comments/${commentKey}`);
            const commentSnapshot = await commentRef.once('value');
            const commentData = commentSnapshot.val();
            if (commentData && commentData.reply && commentData.reply[replyKey]) {
                const currentReplies = commentData.reply || {};
                const remainingReplies = Object.keys(currentReplies).length - 1;
                await db.ref(`comments/${commentKey}/reply/${replyKey}`).remove();
                await commentRef.update({ user_all_rep: Math.max(0, remainingReplies).toString() });
                return true;
            }
            return false;
        } else {
            await db.ref(`comments/${commentKey}`).remove();
            return true;
        }
    } catch (error) {
        console.log('❌ خطأ في حذف المحتوى: ' + error.message);
        return false;
    }
}

// ⚠️ دالة إضافة تحذير للمستخدم
async function addUserWarning(userId) {
    if (!firebaseInitialized) return false;
    try {
        const db = admin.database();
        const userRef = db.ref(`users/${userId}`);
        const snapshot = await userRef.once('value');
        const userData = snapshot.val() || {};
        const currentWarnings = parseInt(userData.warning_comment) || 0;
        const newWarnings = currentWarnings + 1;
        await userRef.update({
            warning_comment: newWarnings.toString(),
            last_warning: new Date().getTime().toString()
        });
        return newWarnings;
    } catch (error) {
        console.log('❌ خطأ في إضافة تحذير: ' + error.message);
        return false;
    }
}

// 📦📦📦 دالة النسخ الاحتياطي (الجديدة) 📦📦📦
async function createAndSendBackup(isManual = false) {
    if (!firebaseInitialized) {
        console.log('❌ لا يمكن عمل نسخة احتياطية: Firebase غير متصل');
        return;
    }

    console.log('📦 جاري بدء عملية النسخ الاحتياطي...');
    const startTime = Date.now();

    try {
        const db = admin.database();
        
        // جلب البيانات
        const [usersSnap, commentsSnap] = await Promise.all([
            db.ref('users').once('value'),
            db.ref('comments').once('value')
        ]);

        const backupData = {
            timestamp: new Date().toISOString(),
            type: isManual ? 'Manual Backup' : 'Auto Backup',
            stats: {
                users_count: usersSnap.numChildren(),
                comments_count: commentsSnap.numChildren()
            },
            data: {
                users: usersSnap.val(),
                comments: commentsSnap.val()
            }
        };

        // تحويل البيانات إلى Buffer (ملف في الذاكرة)
        const jsonString = JSON.stringify(backupData, null, 2);
        const fileBuffer = Buffer.from(jsonString, 'utf-8');
        
        const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const fileName = `backup_${dateStr}.json`;
        
        const caption = `📦 *نسخة احتياطية جديدة*\n` +
                        `📅 التاريخ: ${new Date().toLocaleString('ar-EG')}\n` +
                        `👥 المستخدمين: ${backupData.stats.users_count}\n` +
                        `💬 التعليقات: ${backupData.stats.comments_count}\n` +
                        `🤖 النوع: ${isManual ? 'يدوي (أمر)' : 'تلقائي'}`;

        // إرسال الملف للقناة
        await bot.sendDocument(BACKUP_CHANNEL_ID, fileBuffer, {
            caption: caption,
            parse_mode: 'Markdown'
        }, {
            filename: fileName,
            contentType: 'application/json'
        });

        console.log(`✅ تم إرسال النسخة الاحتياطية بنجاح في ${(Date.now() - startTime) / 1000} ثانية`);
        return true;

    } catch (error) {
        console.log('❌ خطأ في عملية النسخ الاحتياطي:', error.message);
        if (isManual) {
            // إذا كان طلب يدوي وفشل، نرسل تنبيه للآدمن
             bot.sendMessage(BACKUP_CHANNEL_ID, `⚠️ فشل إنشاء النسخة الاحتياطية: ${error.message}`);
        }
        return false;
    }
}

// 🔄 نظام المراقبة التلقائية
function startCommentMonitoring() {
    if (!firebaseInitialized) return;
    
    console.log('🛡️ بدء مراقبة التعليقات والردود...');
    const db = admin.database();
    const commentsRef = db.ref('comments');
    
    commentsRef.on('child_added', async (snapshot) => {
        const comment = snapshot.val();
        const commentKey = snapshot.key;
        if (comment && comment.user_comment && containsBadWordsOrLinks(comment.user_comment)) {
            const deleteResult = await deleteOffensiveContent(commentKey);
            if (deleteResult) {
                await addUserWarning(comment.user_id);
                sendTelegramAlert(`🚨 تم حذف تعليق محظور\n👤 المستخدم: ${comment.user_name}`);
            }
        }
    });
    
    let processingReplies = new Set();
    commentsRef.on('child_changed', async (snapshot) => {
        const comment = snapshot.val();
        const commentKey = snapshot.key;
        if (comment && comment.reply) {
            for (const replyKey in comment.reply) {
                if (processingReplies.has(replyKey)) continue;
                processingReplies.add(replyKey);
                
                const reply = comment.reply[replyKey];
                if (reply && reply.text_rep && containsBadWordsOrLinks(reply.text_rep)) {
                    const deleteResult = await deleteOffensiveContent(commentKey, replyKey);
                    if (deleteResult) {
                        await addUserWarning(reply.user_id);
                        sendTelegramAlert(`🚨 تم حذف رد محظور\n👤 المستخدم: ${reply.user_name}`);
                    }
                }
                setTimeout(() => processingReplies.delete(replyKey), 1000);
            }
        }
    });
}

function sendTelegramAlert(message) {
    const adminChatId = process.env.ADMIN_CHAT_ID;
    if (adminChatId) bot.sendMessage(adminChatId, message).catch(() => {});
}

async function scanExistingComments() {
    if (!firebaseInitialized) return;
    try {
        const db = admin.database();
        const snapshot = await db.ref('comments').once('value');
        const comments = snapshot.val();
        if (comments) {
            for (const commentKey in comments) {
                const comment = comments[commentKey];
                if (comment.user_comment && containsBadWordsOrLinks(comment.user_comment)) {
                    await deleteOffensiveContent(commentKey);
                    await addUserWarning(comment.user_id);
                }
                if (comment.reply) {
                    for (const replyKey in comment.reply) {
                        const reply = comment.reply[replyKey];
                        if (reply.text_rep && containsBadWordsOrLinks(reply.text_rep)) {
                            await deleteOffensiveContent(commentKey, replyKey);
                            await addUserWarning(reply.user_id);
                        }
                    }
                }
            }
        }
    } catch (error) { console.log('Error scanning: ' + error.message); }
}

async function protectionCycle() {
  if (!firebaseInitialized) return;
  try {
    const db = admin.database();
    const snapshot = await db.ref('/').once('value');
    const data = snapshot.val();
    let deletedNodes = 0;
    let deletedUsers = 0;
    
    if (data) {
      for (const key in data) {
        if (!ALLOWED_NODES.includes(key)) {
          await db.ref(key).remove();
          deletedNodes++;
        }
      }
    }

    try {
      const auth = admin.auth();
      const dbUsers = await db.ref('users').once('value');
      const dbData = dbUsers.val() || {};
      const allowedUIDs = new Set(Object.keys(dbData));
      const authUsers = await auth.listUsers(1000);
      const usersToDelete = [];
      for (const user of authUsers.users) {
        if (!allowedUIDs.has(user.uid)) usersToDelete.push(user.uid);
      }
      if (usersToDelete.length > 0) {
        await auth.deleteUsers(usersToDelete);
        deletedUsers = usersToDelete.length;
      }
    } catch (authError) {}
    
    return { deletedNodes, deletedUsers };
  } catch (error) { return { deletedNodes: 0, deletedUsers: 0 }; }
}

// 💬 أوامر التليجرام
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `🛡️ *بوت حماية ونسخ Firebase*

✅ الحماية: نشطة
📦 النسخ الاحتياطي: مفعل (كل ساعة)
🌐 القناة: ${BACKUP_CHANNEL_ID}

*الأوامر:*
/backup - 📦 إنشاء نسخة احتياطية الآن
/status - الحالة
/protect - حماية فورية
/badwords_list - الكلمات الممنوعة
/add_word [كلمة] - إضافة كلمة
/remove_word [كلمة] - حذف كلمة`, { parse_mode: 'Markdown' });
});

// أمر النسخ الاحتياطي اليدوي
bot.onText(/\/backup/, async (msg) => {
    const chatId = msg.chat.id;
    // التحقق من أن الطالب هو الآدمن (اختياري، يمكنك تفعيله)
    // if (chatId.toString() !== process.env.ADMIN_CHAT_ID) return;

    bot.sendMessage(chatId, '⏳ جاري إنشاء نسخة احتياطية وإرسالها للقناة...');
    const success = await createAndSendBackup(true);
    
    if (success) {
        bot.sendMessage(chatId, '✅ تم إرسال النسخة الاحتياطية للقناة بنجاح.');
    } else {
        bot.sendMessage(chatId, '❌ حدث خطأ أثناء النسخ الاحتياطي.');
    }
});

bot.onText(/\/add_word (.+)/, (msg, match) => {
    const word = match[1].trim();
    if (!BAD_WORDS.includes(word)) BAD_WORDS.push(word);
    bot.sendMessage(msg.chat.id, `✅ تمت إضافة: ${word}`);
});

bot.onText(/\/remove_word (.+)/, (msg, match) => {
    const word = match[1].trim();
    const index = BAD_WORDS.indexOf(word);
    if (index > -1) {
        BAD_WORDS.splice(index, 1);
        bot.sendMessage(msg.chat.id, `✅ تمت إزالة: ${word}`);
    } else {
        bot.sendMessage(msg.chat.id, `❌ الكلمة غير موجودة`);
    }
});

bot.onText(/\/badwords_list/, (msg) => {
    bot.sendMessage(msg.chat.id, `📋 الكلمات: ${BAD_WORDS.join(', ')}`);
});

bot.onText(/\/protect/, async (msg) => {
  bot.sendMessage(msg.chat.id, '🛡️ جاري الحماية...');
  await protectionCycle();
  bot.sendMessage(msg.chat.id, '✅ تمت دورة الحماية');
});

// معالجة أخطاء البوت
bot.on('polling_error', (error) => console.log('🔴 خطأ بوت:', error.message));

// ⏰ الجدولة الزمنية

// 1. الحماية كل 30 ثانية
setInterval(() => protectionCycle(), 30000);

// 2. النسخ الاحتياطي التلقائي (كل 1 ساعة = 3600000 ميلي ثانية)
// يمكنك تغيير الرقم لزيادة أو تقليل المدة
const BACKUP_INTERVAL = 60 * 60 * 1000; 
console.log(`⏰ تفعيل النسخ الاحتياطي التلقائي كل ${BACKUP_INTERVAL / 1000 / 60} دقيقة`);

setInterval(() => {
    createAndSendBackup(false);
}, BACKUP_INTERVAL);

// تشغيل المهام الأولية
setTimeout(() => {
  protectionCycle();
  startCommentMonitoring();
  scanExistingComments();
  // تشغيل نسخة احتياطية عند بدء التشغيل للتأكد من العمل
  createAndSendBackup(false); 
}, 5000);

// الحفاظ على الاستيقاظ
function keepServiceAlive() {
  setInterval(() => {
    https.get('https://team-manga-list.onrender.com/ping', (res) => {}).on('error', () => {});
  }, 4 * 60 * 1000);
}
setTimeout(keepServiceAlive, 1000);

console.log('✅ النظام جاهز تماماً!');
