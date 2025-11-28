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

console.log('🚀 بدء تشغيل البوت مع الحماية النشطة والنسخ الاحتياطي...');

// 🔥 الجزء الأساسي: البوت والحماية
const token = process.env.BOT_TOKEN;
if (!token) {
  console.log('❌ BOT_TOKEN غير موجود');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });
console.log('✅ بوت التليجرام متصل');

// إعدادات النسخ الاحتياطي
const BACKUP_CHANNEL_ID = '-1003424582714'; // قناتك للنسخ الاحتياطي
const BACKUP_INTERVAL = 1 * 60 * 60 * 1000; // كل 6 ساعات

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

// 📋 قائمة كلمات السب المحسنة (كلمات كاملة فقط)
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
    /https?:\/\/[^\s]+/g,                    // http:// أو https://
    /www\.[^\s]+\.[^\s]+/g,                 // www.example.com
    /[^\s]+\.[a-z]{2,}(\/[^\s]*)?/gi,       // domain.com أو domain.com/path
    /t\.me\/[^\s]+/g,                       // روابط التلغرام
    /bit\.ly\/[^\s]+/g,                     // روابط مختصرة
    /youtu\.be\/[^\s]+/g,                   // روابط يوتيوب مختصرة
    /youtube\.com\/[^\s]+/g,                // روابط يوتيوب
    /instagram\.com\/[^\s]+/g,              // روابط انستجرام
    /facebook\.com\/[^\s]+/g,               // روابط فيسبوك
    /twitter\.com\/[^\s]+/g,                // روابط تويتر
    /discord\.gg\/[^\s]+/g                  // روابط ديسكورد
];

// 🔄 نظام النسخ الاحتياطي المحسن
async function createBackup() {
    if (!firebaseInitialized) {
        console.log('❌ Firebase غير متصل - لا يمكن إنشاء نسخة احتياطية');
        return false;
    }

    try {
        console.log('💾 بدء إنشاء نسخة احتياطية...');
        const db = admin.database();
        
        // جلب بيانات users و comments
        const [usersSnapshot, commentsSnapshot] = await Promise.all([
            db.ref('users').once('value'),
            db.ref('comments').once('value')
        ]);

        const usersData = usersSnapshot.val() || {};
        const commentsData = commentsSnapshot.val() || {};

        // إحصائيات
        const stats = {
            totalUsers: Object.keys(usersData).length,
            totalComments: Object.keys(commentsData).length,
            totalReplies: 0,
            backupTime: new Date().toLocaleString('ar-EG')
        };

        // حساب إجمالي الردود
        for (const commentKey in commentsData) {
            if (commentsData[commentKey].reply) {
                stats.totalReplies += Object.keys(commentsData[commentKey].reply).length;
            }
        }

        // إنشاء نص النسخة الاحتياطية
        let backupText = `💾 *نسخة احتياطية - ${stats.backupTime}*\n\n`;
        backupText += `📊 *الإحصائيات:*\n`;
        backupText += `👥 المستخدمين: ${stats.totalUsers}\n`;
        backupText += `💬 التعليقات: ${stats.totalComments}\n`;
        backupText += `↪️ الردود: ${stats.totalReplies}\n\n`;

        // إضافة عينة من المستخدمين (أول 5)
        backupText += `👥 *آخر المستخدمين:*\n`;
        const userKeys = Object.keys(usersData).slice(0, 5);
        userKeys.forEach((key, index) => {
            const user = usersData[key];
            backupText += `${index + 1}. ${user.user_name || 'بدون اسم'} (${key})\n`;
        });

        // إضافة عينة من التعليقات (أول 5)
        backupText += `\n💬 *آخر التعليقات:*\n`;
        const commentKeys = Object.keys(commentsData).slice(0, 5);
        commentKeys.forEach((key, index) => {
            const comment = commentsData[key];
            backupText += `${index + 1}. ${comment.user_name}: ${(comment.user_comment || '').substring(0, 50)}...\n`;
        });

        // إرسال النسخة الاحتياطية إلى القناة
        await bot.sendMessage(BACKUP_CHANNEL_ID, backupText, { parse_mode: 'Markdown' });

        // إذا كانت البيانات كبيرة، نرسل ملف JSON كامل
        if (stats.totalUsers > 0 || stats.totalComments > 0) {
            const fullBackup = {
                backupTime: new Date().toISOString(),
                statistics: stats,
                users: usersData,
                comments: commentsData
            };

            // تحويل إلى JSON مع格式化
            const jsonData = JSON.stringify(fullBackup, null, 2);
            
            // إرسال كملف إذا كان كبيراً
            if (jsonData.length > 4000) {
                await bot.sendDocument(BACKUP_CHANNEL_ID, Buffer.from(jsonData), {}, {
                    filename: `backup-${Date.now()}.json`,
                    contentType: 'application/json'
                });
            } else {
                await bot.sendMessage(BACKUP_CHANNEL_ID, '```json\n' + jsonData + '\n```', { parse_mode: 'Markdown' });
            }
        }

        console.log(`✅ تم إنشاء نسخة احتياطية وإرسالها إلى القناة: ${BACKUP_CHANNEL_ID}`);
        return true;

    } catch (error) {
        console.log('❌ خطأ في إنشاء النسخة الاحتياطية:', error.message);
        
        // إرسال رسالة خطأ إلى القناة
        try {
            await bot.sendMessage(BACKUP_CHANNEL_ID, 
                `❌ فشل في إنشاء النسخة الاحتياطية:\n${error.message}`,
                { parse_mode: 'Markdown' }
            );
        } catch (e) {
            console.log('⚠️ فشل في إرسال رسالة الخطأ:', e.message);
        }
        
        return false;
    }
}

// 🔍 دالة كشف الروابط المحسنة
function containsLinks(text) {
    if (!text || typeof text !== 'string') {
        return false;
    }
    
    console.log('🔗 فحص النص للروابط:', text);
    
    // فحص جميع أنماط الروابط
    for (const pattern of LINK_PATTERNS) {
        const matches = text.match(pattern);
        if (matches && matches.length > 0) {
            console.log(`🚨 اكتشاف روابط: ${matches.join(', ')}`);
            return true;
        }
    }
    
    // فحص الروابط المشفرة (URL encoded)
    if (text.includes('%2F%2F') || text.includes('http%3A')) {
        console.log('🚨 اكتشاف روابط مشفرة');
        return true;
    }
    
    console.log('✅ لا توجد روابط في النص');
    return false;
}

// 🔍 دالة للكشف عن السب - الإصدار المحسن
function containsBadWords(text) {
    if (!text || typeof text !== 'string') {
        console.log('⚠️ نص غير صالح للفحص:', text);
        return false;
    }
    
    console.log('🔍 فحص النص:', text);
    
    const words = text.toLowerCase().split(/\s+/);
    let foundBadWord = null;
    
    for (const word of words) {
        // فحص كل كلمة على حدة بشكل دقيق
        const cleanWord = word.replace(/[.,!?;:()]/g, '');
        
        for (const badWord of BAD_WORDS) {
            // البحث عن تطابق كامل للكلمة
            if (cleanWord === badWord.toLowerCase()) {
                foundBadWord = badWord;
                break;
            }
        }
        
        if (foundBadWord) break;
    }
    
    if (foundBadWord) {
        console.log(`🚨 اكتشاف كلمة مسيئة: "${foundBadWord}" في النص: "${text}"`);
        return true;
    }
    
    console.log('✅ النص نظيف');
    return false;
}

// 🛡️ دالة الفحص الرئيسية المحسنة
function containsBadWordsOrLinks(text) {
    return containsBadWords(text) || containsLinks(text);
}

// 🗑️ دالة حذف التعليق/الرد مع تحديث العداد
async function deleteOffensiveContent(commentKey, replyKey = null) {
    if (!firebaseInitialized) {
        console.log('❌ Firebase غير متصل - لا يمكن الحذف');
        return false;
    }
    
    try {
        const db = admin.database();
        
        if (replyKey) {
            // إذا كان حذف رد، نحتاج لتحديث العداد أولاً
            const commentRef = db.ref(`comments/${commentKey}`);
            const commentSnapshot = await commentRef.once('value');
            const commentData = commentSnapshot.val();
            
            if (commentData && commentData.reply && commentData.reply[replyKey]) {
                // حساب عدد الردود المتبقية بعد الحذف
                const currentReplies = commentData.reply || {};
                const remainingReplies = Object.keys(currentReplies).length - 1;
                
                console.log(`🗑️ جاري حذف الرد: ${replyKey}`);
                console.log(`📊 الردود قبل الحذف: ${Object.keys(currentReplies).length}, بعد الحذف: ${remainingReplies}`);
                
                // حذف الرد أولاً
                await db.ref(`comments/${commentKey}/reply/${replyKey}`).remove();
                
                // ثم تحديث العداد
                await commentRef.update({
                    user_all_rep: Math.max(0, remainingReplies).toString()
                });
                
                console.log(`✅ تم حذف رد مسيء: ${replyKey} وتحديث العداد إلى: ${Math.max(0, remainingReplies)}`);
                return true;
            } else {
                console.log('❌ الرد غير موجود أو تم حذفه مسبقاً');
                return false;
            }
        } else {
            // إذا كان حذف تعليق رئيسي
            console.log(`🗑️ جاري حذف التعليق: ${commentKey}`);
            await db.ref(`comments/${commentKey}`).remove();
            console.log(`✅ تم حذف تعليق مسيء: ${commentKey}`);
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

// 🔄 نظام المراقبة التلقائية المحسن
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
        
        console.log(`📝 تعليق جديد: ${commentKey}`);
        
        if (comment && comment.user_comment) {
            // فحص التعليق الرئيسي
            if (containsBadWordsOrLinks(comment.user_comment)) {
                console.log(`🚨 اكتشاف محتوى محظور في تعليق: ${commentKey}`);
                const deleteResult = await deleteOffensiveContent(commentKey);
                if (deleteResult) {
                    await addUserWarning(comment.user_id);
                    sendTelegramAlert(`🚨 تم حذف تعليق محظور\n👤 المستخدم: ${comment.user_name}\n📝 التعليق: ${comment.user_comment.substring(0, 100)}...`);
                }
            }
        }
    });
    
    // مراقبة الردود الجديدة - محسنة
    let processingReplies = new Set();
    
    commentsRef.on('child_changed', async (snapshot) => {
        const comment = snapshot.val();
        const commentKey = snapshot.key;
        
        console.log(`🔄 تحديث في التعليق: ${commentKey}`);
        
        if (comment && comment.reply) {
            // فحص الردود الجديدة فقط
            for (const replyKey in comment.reply) {
                const reply = comment.reply[replyKey];
                
                // تجنب معالجة الرد نفسه مرتين
                if (processingReplies.has(replyKey)) {
                    continue;
                }
                
                processingReplies.add(replyKey);
                
                if (reply && reply.text_rep) {
                    console.log(`💬 فحص الرد: ${replyKey} - النص: ${reply.text_rep}`);
                    if (containsBadWordsOrLinks(reply.text_rep)) {
                        console.log(`🚨 اكتشاف محتوى محظور في رد: ${replyKey}`);
                        const deleteResult = await deleteOffensiveContent(commentKey, replyKey);
                        if (deleteResult) {
                            await addUserWarning(reply.user_id);
                            sendTelegramAlert(`🚨 تم حذف رد محظور\n👤 المستخدم: ${reply.user_name}\n📝 الرد: ${reply.text_rep.substring(0, 100)}...`);
                        }
                    }
                }
                
                // إزالة الرد من مجموعة المعالجة بعد ثانية
                setTimeout(() => {
                    processingReplies.delete(replyKey);
                }, 1000);
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
    } else {
        console.log('⚠️ ADMIN_CHAT_ID غير محدد - لا يمكن إرسال التنبيهات');
    }
}

// 🔍 دورة فحص التعليقات الحالية
async function scanExistingComments() {
    if (!firebaseInitialized) return;
    
    try {
        console.log('🔍 بدء فحص التعليقات الحالية...');
        const db = admin.database();
        const snapshot = await db.ref('comments').once('value');
        const comments = snapshot.val();
        
        let deletedCount = 0;
        
        if (comments) {
            console.log(`📊 عدد التعليقات للفحص: ${Object.keys(comments).length}`);
            
            for (const commentKey in comments) {
                const comment = comments[commentKey];
                
                // فحص التعليق الرئيسي
                if (comment.user_comment && containsBadWordsOrLinks(comment.user_comment)) {
                    console.log(`🚨 حذف تعليق رئيسي: ${commentKey}`);
                    const deleteResult = await deleteOffensiveContent(commentKey);
                    if (deleteResult) {
                        await addUserWarning(comment.user_id);
                        deletedCount++;
                    }
                }
                
                // فحص الردود
                if (comment.reply) {
                    console.log(`🔍 فحص ${Object.keys(comment.reply).length} رد في التعليق: ${commentKey}`);
                    for (const replyKey in comment.reply) {
                        const reply = comment.reply[replyKey];
                        if (reply.text_rep && containsBadWordsOrLinks(reply.text_rep)) {
                            console.log(`🚨 حذف رد: ${replyKey}`);
                            const deleteResult = await deleteOffensiveContent(commentKey, replyKey);
                            if (deleteResult) {
                                await addUserWarning(reply.user_id);
                                deletedCount++;
                            }
                        }
                    }
                }
            }
        } else {
            console.log('📭 لا توجد تعليقات للفحص');
        }
        
        console.log(`✅ اكتمل الفحص - تم حذف ${deletedCount} محتوى محظور`);
        return deletedCount;
    } catch (error) {
        console.log('❌ خطأ في فحص التعليقات: ' + error.message);
        return 0;
    }
}

// الأوامر والإعدادات الأخرى تبقى كما هي...
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
🔗 كشف الروابط: نشط
💾 النسخ الاحتياطي: نشط (كل 6 ساعات)

*الأوامر:*
/start - البدء
/status - الحالة
/protect - حماية فورية
/backup - نسخ احتياطي فوري
/test - اختبار الحذف
/logs - السجلات
/scan_comments - فحص التعليقات
/moderation_stats - إحصائيات الإشراف
/user_warnings [user_id] - تحذيرات مستخدم
/badwords_list - عرض الكلمات الممنوعة
/test_filter [نص] - اختبار الفلتر
/test_links [نص] - اختبار كشف الروابط
/add_word [كلمة] - إضافة كلمة ممنوعة
/remove_word [كلمة] - إزالة كلمة ممنوعة`, { parse_mode: 'Markdown' });
});

// أمر النسخ الاحتياطي الفوري
bot.onText(/\/backup/, async (msg) => {
  const chatId = msg.chat.id;
  
  if (!firebaseInitialized) {
    bot.sendMessage(chatId, '❌ Firebase غير متصل!');
    return;
  }
  
  bot.sendMessage(chatId, '💾 جاري إنشاء نسخة احتياطية فورية...');
  
  const success = await createBackup();
  
  if (success) {
    bot.sendMessage(chatId, '✅ *تم إنشاء النسخة الاحتياطية وإرسالها إلى القناة!*\n\nسيتم إرسال نسخ تلقائية كل 6 ساعات.', { parse_mode: 'Markdown' });
  } else {
    bot.sendMessage(chatId, '❌ فشل في إنشاء النسخة الاحتياطية. راجع السجلات للتفاصيل.');
  }
});

// أوامر إدارة الكلمات الممنوعة
bot.onText(/\/add_word (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const word = match[1].trim();
    
    if (BAD_WORDS.includes(word)) {
        bot.sendMessage(chatId, `⚠️ الكلمة "${word}" موجودة بالفعل في القائمة.`);
    } else {
        BAD_WORDS.push(word);
        bot.sendMessage(chatId, `✅ تمت إضافة الكلمة "${word}" إلى القائمة الممنوعة.`);
        console.log(`✅ تمت إضافة كلمة جديدة: ${word}`);
    }
});

bot.onText(/\/remove_word (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const word = match[1].trim();
    
    const index = BAD_WORDS.indexOf(word);
    if (index === -1) {
        bot.sendMessage(chatId, `❌ الكلمة "${word}" غير موجودة في القائمة.`);
    } else {
        BAD_WORDS.splice(index, 1);
        bot.sendMessage(chatId, `✅ تمت إزالة الكلمة "${word}" من القائمة الممنوعة.`);
        console.log(`✅ تمت إزالة كلمة: ${word}`);
    }
});

bot.onText(/\/test_filter (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const text = match[1];
    
    const hasBadWords = containsBadWords(text);
    
    if (hasBadWords) {
        bot.sendMessage(chatId, `🚨 *تم اكتشاف كلمات مسيئة!*\n\nالنص: "${text}"\n\nسيتم حذف هذا النص تلقائياً.`, { parse_mode: 'Markdown' });
    } else {
        bot.sendMessage(chatId, `✅ *النص نظيف*\n\nالنص: "${text}"\n\nلا توجد كلمات مسيئة.`, { parse_mode: 'Markdown' });
    }
});

// أمر اختبار كشف الروابط
bot.onText(/\/test_links (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const text = match[1];
    
    const hasLinks = containsLinks(text);
    const hasBadWords = containsBadWords(text);
    
    let message = `📝 *نتيجة الفحص:*\n\nالنص: "${text}"\n\n`;
    
    if (hasLinks) {
        message += "🚨 *تم اكتشاف روابط!*\n";
    } else {
        message += "✅ *لا توجد روابط*\n";
    }
    
    if (hasBadWords) {
        message += "🚨 *تم اكتشاف كلمات مسيئة!*\n";
    } else {
        message += "✅ *لا توجد كلمات مسيئة*\n";
    }
    
    if (hasLinks || hasBadWords) {
        message += "\n⚠️ سيتم حذف هذا المحتوى تلقائياً.";
    } else {
        message += "\n🎉 المحتوى آمن ومقبول.";
    }
    
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
});

bot.onText(/\/protect/, async (msg) => {
  const chatId = msg.chat.id;
  
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

bot.onText(/\/badwords_list/, (msg) => {
    const chatId = msg.chat.id;
    const wordsList = BAD_WORDS.join(', ');
    bot.sendMessage(chatId, `📋 *الكلمات الممنوعة:*\n\n${wordsList}`, { parse_mode: 'Markdown' });
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
    }, 5000);
}, 10000);

// 🕒 نظام النسخ الاحتياطي التلقائي
console.log('💾 تفعيل النسخ الاحتياطي التلقائي كل 6 ساعات...');
setInterval(() => {
    createBackup();
}, BACKUP_INTERVAL);

// بدء النسخ الاحتياطي الأول بعد دقيقة من التشغيل
setTimeout(() => {
    createBackup();
}, 60000);

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

console.log('✅ النظام جاهز! الحماية التلقائية ومراقبة التعليقات والنسخ الاحتياطي مفعلة.');
