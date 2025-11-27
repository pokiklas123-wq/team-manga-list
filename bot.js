const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');
const express = require('express');
const https = require('https');

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

console.log('🚀 بدء تشغيل البوت مع الحماية النشطة...');

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

// 📋 قائمة كلمات السب (الفاحشة والمهينة فقط)
const BAD_WORDS = [
    'كس', 'عرص', 'قحبة', 'شرموطة', 'زق', 'طيز', 'كسم', 'منيوك', 
    'ابن الكلب', 'ابن الشرموطة', 'كلب', 'حمار', 'خول', 'فاجر',
    'عاهر', 'دعارة', 'شرموط', 'قحاب', 'زبالة', 'خايب', 'خاينة',
    'شراميط', 'قحبه', 'كحبة', 'كحبه', 'زبي', 'قضيب', 'مهبل', 'فرج',
    'منيوك', 'منيوكة', 'منيوكه', 'داشر', 'داشرة', 'داشرر', 'داعر',
    'داعره', 'داعرر', 'سافل', 'سافلة', 'سافلل', 'سكس', 'sex', 'porn'
];

// 🔍 دالة للكشف عن السب
function containsBadWords(text) {
    if (!text) return false;
    const lowerText = text.toLowerCase();
    return BAD_WORDS.some(word => lowerText.includes(word.toLowerCase()));
}

// 🗑️ دالة حذف التعليق/الرد
async function deleteOffensiveContent(commentKey, replyKey = null) {
    if (!firebaseInitialized) return false;
    
    try {
        const db = admin.database();
        let path = `comments/${commentKey}`;
        
        if (replyKey) {
            path += `/reply/${replyKey}`;
        }
        
        await db.ref(path).remove();
        console.log(`✅ تم حذف محتوى مسيء: ${path}`);
        return true;
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
        
        // جلب البيانات الحالية
        const snapshot = await userRef.once('value');
        const userData = snapshot.val() || {};
        
        // تحديث عدد التحذيرات
        const currentWarnings = parseInt(userData.warning_comment) || 0;
        const newWarnings = currentWarnings + 1;
        
        await userRef.update({
            warning_comment: newWarnings.toString(),
            last_warning: new Date().getTime().toString()
        });
        
        console.log(`⚠️ تم إضافة تحذير للمستخدم ${userId} - الإجمالي: ${newWarnings}`);
        return newWarnings;
    } catch (error) {
        console.log('❌ خطأ في إضافة تحذير: ' + error.message);
        return false;
    }
}

// 🔄 نظام المراقبة التلقائية
function startCommentMonitoring() {
    if (!firebaseInitialized) {
        console.log('❌ Firebase غير متصل - تعطيل المراقبة');
        return;
    }
    
    console.log('🛡️ بدء مراقبة التعليقات والردود...');
    const db = admin.database();
    
    // مراقبة التعليقات الجديدة
    const commentsRef = db.ref('comments');
    commentsRef.on('child_added', async (snapshot) => {
        const comment = snapshot.val();
        const commentKey = snapshot.key;
        
        if (comment && comment.user_comment) {
            // فحص التعليق الرئيسي
            if (containsBadWords(comment.user_comment)) {
                console.log(`🚨 اكتشاف سب في تعليق: ${commentKey}`);
                await deleteOffensiveContent(commentKey);
                await addUserWarning(comment.user_id);
                
                // إرسال تنبيه للتليجرام
                sendTelegramAlert(`🚨 تم حذف تعليق مسيء\n👤 المستخدم: ${comment.user_name}\n📝 التعليق: ${comment.user_comment.substring(0, 100)}...`);
            }
        }
    });
    
    // مراقبة الردود الجديدة
    commentsRef.on('child_changed', async (snapshot) => {
        const comment = snapshot.val();
        const commentKey = snapshot.key;
        
        if (comment && comment.reply) {
            // فحص الردود الجديدة
            for (const replyKey in comment.reply) {
                const reply = comment.reply[replyKey];
                if (reply && reply.text_rep && containsBadWords(reply.text_rep)) {
                    console.log(`🚨 اكتشاف سب في رد: ${replyKey}`);
                    await deleteOffensiveContent(commentKey, replyKey);
                    await addUserWarning(reply.user_id);
                    
                    // إرسال تنبيه للتليجرام
                    sendTelegramAlert(`🚨 تم حذف رد مسيء\n👤 المستخدم: ${reply.user_name}\n📝 الرد: ${reply.text_rep.substring(0, 100)}...`);
                }
            }
        }
    });
}

// 📨 دالة إرسال تنبيهات التليجرام
function sendTelegramAlert(message) {
    const adminChatId = process.env.ADMIN_CHAT_ID;
    
    if (adminChatId) {
        bot.sendMessage(adminChatId, message).catch(error => {
            console.log('⚠️ خطأ في إرسال التنبيه: ' + error.message);
        });
    }
}

// 🔍 دورة فحص التعليقات الحالية
async function scanExistingComments() {
    if (!firebaseInitialized) return;
    
    try {
        console.log('🔍 فحص التعليقات الحالية...');
        const db = admin.database();
        const snapshot = await db.ref('comments').once('value');
        const comments = snapshot.val();
        
        let deletedCount = 0;
        
        if (comments) {
            for (const commentKey in comments) {
                const comment = comments[commentKey];
                
                // فحص التعليق الرئيسي
                if (comment.user_comment && containsBadWords(comment.user_comment)) {
                    await deleteOffensiveContent(commentKey);
                    await addUserWarning(comment.user_id);
                    deletedCount++;
                }
                
                // فحص الردود
                if (comment.reply) {
                    for (const replyKey in comment.reply) {
                        const reply = comment.reply[replyKey];
                        if (reply.text_rep && containsBadWords(reply.text_rep)) {
                            await deleteOffensiveContent(commentKey, replyKey);
                            await addUserWarning(reply.user_id);
                            deletedCount++;
                        }
                    }
                }
            }
        }
        
        console.log(`✅ اكتمل الفحص - تم حذف ${deletedCount} محتوى مسيء`);
        return deletedCount;
    } catch (error) {
        console.log('❌ خطأ في فحص التعليقات: ' + error.message);
        return 0;
    }
}

async function protectionCycle() {
  if (!firebaseInitialized) {
    console.log('⏳ Firebase غير مهيئ، تخطي الدورة');
    return;
  }
  
  try {
    console.log('🔍 بدء دورة حماية - ' + new Date().toLocaleTimeString('ar-EG'));
    
    const db = admin.database();
    const snapshot = await db.ref('/').once('value');
    const data = snapshot.val();

    let deletedNodes = 0;
    let deletedUsers = 0;
    
    if (data) {
      for (const key in data) {
        if (!ALLOWED_NODES.includes(key)) {
          await db.ref(key).remove().catch(e => {
            console.log('⚠️ خطأ في حذف ' + key + ': ' + e.message);
          });
          deletedNodes++;
          console.log('🗑️ حذف عقدة: ' + key);
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
          console.log('🚫 حذف مستخدم: ' + (user.email || user.uid));
        }
      }
      
      if (usersToDelete.length > 0) {
        await auth.deleteUsers(usersToDelete);
        deletedUsers = usersToDelete.length;
        console.log('✅ تم حذف ' + deletedUsers + ' مستخدم');
      }
    } catch (authError) {
      console.log('⚠️ خطأ في إدارة المستخدمين: ' + authError.message);
    }
    
    console.log('✅ اكتملت دورة الحماية - العقد المحذوفة: ' + deletedNodes + ' - المستخدمين المحذوفين: ' + deletedUsers);
    
    return { deletedNodes, deletedUsers };
    
  } catch (error) {
    console.log('❌ خطأ في دورة الحماية: ' + error.message);
    return { deletedNodes: 0, deletedUsers: 0 };
  }
}

// 💬 أوامر التليجرام
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  console.log('📩 /start من: ' + chatId);
  bot.sendMessage(chatId, `🛡️ *بوت حماية Firebase النشط*

✅ الحماية التلقائية: نشطة
⏰ تعمل كل: 30 ثانية
🗑️ آخر حذف: يعمل الآن
🌐 UptimeRobot: نشط
🛡️ مراقبة التعليقات: نشطة

*الأوامر:*
/start - البدء
/status - الحالة
/protect - حماية فورية
/test - اختبار الحذف
/logs - السجلات
/scan_comments - فحص التعليقات
/moderation_stats - إحصائيات الإشراف
/user_warnings [user_id] - تحذيرات مستخدم`, { parse_mode: 'Markdown' });
});

bot.onText(/\/protect/, async (msg) => {
  const chatId = msg.chat.id;
  console.log('📩 /protect من: ' + chatId);
  
  if (!firebaseInitialized) {
    bot.sendMessage(chatId, '❌ Firebase غير متصل!');
    return;
  }
  
  bot.sendMessage(chatId, '🛡️ جاري تشغيل دورة حماية فورية...');
  
  const result = await protectionCycle();
  
  if (result.deletedNodes > 0 || result.deletedUsers > 0) {
    bot.sendMessage(chatId, `✅ *تمت الحماية الفورية!*

🗑️ العقد المحذوفة: ${result.deletedNodes}
👥 المستخدمين المحذوفين: ${result.deletedUsers}
⏰ الوقت: ${new Date().toLocaleTimeString('ar-EG')}`, { parse_mode: 'Markdown' });
  } else {
    bot.sendMessage(chatId, '✅ لم يتم العثور على عقد أو مستخدمين للحذف. كل شيء نظيف!');
  }
});

bot.onText(/\/test/, async (msg) => {
  const chatId = msg.chat.id;
  
  if (!firebaseInitialized) {
    bot.sendMessage(chatId, '❌ فشل الاختبار: Firebase غير متصل');
    return;
  }
  
  bot.sendMessage(chatId, '🧪 جاري اختبار الحماية...');
  
  try {
    const db = admin.database();
    
    // إنشاء عقدة تجريبية
    await db.ref('test_node_' + Date.now()).set({
      test: true,
      timestamp: new Date().toISOString()
    });
    
    // تشغيل الحماية
    const result = await protectionCycle();
    
    bot.sendMessage(chatId, `✅ *اختبار ناجح!*

🔧 Firebase: متصل
🛡️ الحماية: نشطة
🗑️ المحذوفات: ${result.deletedNodes} عقدة
👥 المستخدمين: ${result.deletedUsers} مستخدم`, { parse_mode: 'Markdown' });
    
  } catch (error) {
    bot.sendMessage(chatId, '❌ فشل الاختبار: ' + error.message);
  }
});

bot.onText(/\/status/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `📊 *حالة النظام:*

🟢 البوت: نشط
🔧 Firebase: ${firebaseInitialized ? 'متصل' : 'غير متصل'}
⏰ الوقت: ${new Date().toLocaleTimeString('ar-EG')}
📈 Uptime: ${Math.floor(process.uptime())} ثانية
🌐 UptimeRobot: يراقب
🛡️ مراقبة التعليقات: نشطة

💡 استخدم /test لاختبار الحماية`, { parse_mode: 'Markdown' });
});

bot.onText(/\/logs/, (msg) => {
  const chatId = msg.chat.id;
  const status = firebaseInitialized ? '🟢 نشط' : '🔴 غير متصل';
  bot.sendMessage(chatId, `📋 *آخر السجلات:*

• Firebase: ${status}
• البوت: 🟢 يعمل
• UptimeRobot: 🟢 يراقب
• الحماية: 🟢 نشطة
• مراقبة التعليقات: 🟢 نشطة

🔍 افحص الـ logs في Render للتفاصيل الكاملة`, { parse_mode: 'Markdown' });
});

// أمر فحص التعليقات الحالية
bot.onText(/\/scan_comments/, async (msg) => {
    const chatId = msg.chat.id;
    
    if (!firebaseInitialized) {
        bot.sendMessage(chatId, '❌ Firebase غير متصل!');
        return;
    }
    
    bot.sendMessage(chatId, '🔍 جاري فحص جميع التعليقات والردود...');
    
    const deletedCount = await scanExistingComments();
    
    bot.sendMessage(chatId, `✅ *تم الانتهاء من الفحص!*

🗑️ المحتويات المحذوفة: ${deletedCount}
🛡️ النظام جاهز للمراقبة التلقائية`, { parse_mode: 'Markdown' });
});

// أمر عرض تحذيرات مستخدم
bot.onText(/\/user_warnings (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = match[1];
    
    if (!firebaseInitialized) {
        bot.sendMessage(chatId, '❌ Firebase غير متصل!');
        return;
    }
    
    try {
        const db = admin.database();
        const userRef = db.ref(`users/${userId}`);
        const snapshot = await userRef.once('value');
        const userData = snapshot.val();
        
        if (userData) {
            const warnings = userData.warning_comment || '0';
            bot.sendMessage(chatId, `👤 *معلومات المستخدم*
            
الاسم: ${userData.user_name}
البريد: ${userData.user_email}
عدد التحذيرات: ${warnings}
الحالة: ${parseInt(warnings) >= 3 ? '🔴 خطير' : '🟢 جيدة'}`, { parse_mode: 'Markdown' });
        } else {
            bot.sendMessage(chatId, '❌ المستخدم غير موجود!');
        }
    } catch (error) {
        bot.sendMessage(chatId, '❌ خطأ في جلب البيانات: ' + error.message);
    }
});

// أمر عرض إحصائيات النظام
bot.onText(/\/moderation_stats/, async (msg) => {
    const chatId = msg.chat.id;
    
    if (!firebaseInitialized) {
        bot.sendMessage(chatId, '❌ Firebase غير متصل!');
        return;
    }
    
    try {
        const db = admin.database();
        const usersSnapshot = await db.ref('users').once('value');
        const users = usersSnapshot.val() || {};
        
        let totalWarnings = 0;
        let warnedUsers = 0;
        
        Object.values(users).forEach(user => {
            const warnings = parseInt(user.warning_comment) || 0;
            if (warnings > 0) {
                totalWarnings += warnings;
                warnedUsers++;
            }
        });
        
        bot.sendMessage(chatId, `📊 *إحصائيات الإشراف*
        
👥 إجمالي المستخدمين: ${Object.keys(users).length}
⚠️ المستخدمون المحذرون: ${warnedUsers}
🚨 إجمالي التحذيرات: ${totalWarnings}
🛡️ النظام: 🟢 نشط`, { parse_mode: 'Markdown' });
    } catch (error) {
        bot.sendMessage(chatId, '❌ خطأ في جلب الإحصائيات: ' + error.message);
    }
});

// معالجة أخطاء البوت
bot.on('polling_error', (error) => {
  console.log('🔴 خطأ في البوت: ' + error.message);
});

// ⏰ التشغيل التلقائي كل 30 ثانية
console.log('⏰ تفعيل الحماية التلقائية كل 30 ثانية...');
setInterval(() => {
  protectionCycle();
}, 30000);

// بدء الدورة الأولى بعد 5 ثواني
setTimeout(() => {
  protectionCycle();
}, 5000);

// تفعيل نظام مراقبة التعليقات بعد 10 ثواني من التشغيل
setTimeout(() => {
    startCommentMonitoring();
    // فحص التعليقات الحالية بعد بدء التشغيل
    setTimeout(() => {
        scanExistingComments();
    }, 15000);
}, 10000);

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

// بدء الحفاظ على الاستيقاظ بعد 30 ثانية
setTimeout(keepServiceAlive, 30000);

console.log('✅ النظام جاهز! الحماية التلقائية ومراقبة التعليقات مفعلة.');
