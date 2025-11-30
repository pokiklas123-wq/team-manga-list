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

console.log('🚀 بدء تشغيل البوت مع الحماية النشطة والنسخ الاحتياطي...');

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

    await transporter.verify();
    console.log('✅ اتصال Gmail ناجح');

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
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
        <p style="color: #888; font-size: 12px; text-align: center;">
          تم إرسال هذا الإيميل تلقائياً من نظام إشعارات منصة المانجا العربية
        </p>
      </div>
    `;

    const mailOptions = {
      from: gmailConfig.email,
      to: userEmail,
      subject: `🔔 رد جديد على تعليقك - ${notificationData.user_name || 'مستخدم'}`,
      html: emailContent,
      text: `إشعار جديد - ${notificationData.user_name} رد على تعليقك: ${notificationData.reply}`
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

          const emailSent = await sendNotificationEmail(userEmail, {
            user_name: notification.user_name,
            reply: notification.reply,
            updateAt: notification.updateAt
          });

          if (emailSent) {
            console.log(`✅ تم إرسال إشعار إلى: ${userEmail}`);
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

// 🛡️ نظام الحماية الأساسي
const ALLOWED_NODES = ['users', 'comments', 'views', 'update'];
const BAD_WORDS = ['كس', 'عرص', 'قحبة', 'شرموطة', 'زق', 'طيز', 'كسم', 'منيوك', 'خول', 'فاجر', 'عاهر', 'دعارة', 'شرموط', 'قحاب', 'شراميط', 'قحبه', 'كحبة', 'كحبة', 'زبي', 'قضيب', 'مهبل', 'فرج', 'منيوكة', 'منيوكه', 'داشر', 'داشرة', 'داشرر', 'داعر', 'داعره', 'داعرر', 'سافل', 'سافلة', 'سافلل', 'سكس', 'sex', 'porn', 'قحب', 'قحبة', 'قحبه', 'قحبو', 'نيك امك', 'نيكك', 'عطاي', 'نيك', 'nik', 'Nik', 'NIK', 'Nik mok', 'nik mok', 'بنت القحبة', 'https-pokiklas123-wq-github-io-chapter-html', 'nikmok', 'زكي', 'nikk', 'Nikk', 'NIKK', 'نيكسوة تاع مد', 'نيكسوة تاع ختك', 'نيكطيز', 'نيككس.امك', 'نيك.كس.امك', 'نيك.طيز.امك', 'نيك', 'سوة', 'قحبة', 'قحبا'];

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

// 🔄 نظام النسخ الاحتياطي
async function createBackup() {
    if (isBotPaused) {
        console.log('⏸️ البوت متوقف مؤقتاً - تخطي النسخ الاحتياطي');
        return false;
    }

    if (!firebaseInitialized) {
        console.log('❌ Firebase غير متصل - لا يمكن إنشاء نسخة احتياطية');
        return false;
    }

    try {
        console.log('💾 بدء إنشاء نسخة احتياطية...');
        const db = admin.database();
        
        const snapshot = await db.ref('/').once('value');
        const allData = snapshot.val() || {};
        
        const filteredData = {};
        let totalNodes = 0;
        let totalRecords = 0;

        for (const nodeName in allData) {
            if (ALLOWED_NODES.includes(nodeName)) {
                filteredData[nodeName] = allData[nodeName];
                totalNodes++;
                
                if (allData[nodeName] && typeof allData[nodeName] === 'object') {
                    totalRecords += Object.keys(allData[nodeName]).length;
                }
            }
        }

        const stats = {
            totalNodes: totalNodes,
            totalRecords: totalRecords,
            backupTime: new Date().toLocaleString('ar-EG'),
            nodesList: Object.keys(filteredData)
        };

        let backupText = `💾 *نسخة احتياطية شاملة - ${stats.backupTime}*\n\n`;
        backupText += `📊 *الإحصائيات:*\n`;
        backupText += `📦 عدد العقد: ${stats.totalNodes}\n`;
        backupText += `📝 إجمالي السجلات: ${stats.totalRecords}\n`;
        backupText += `🕒 وقت النسخ: ${stats.backupTime}\n\n`;

        backupText += `📁 *العقد المنسوخة:*\n`;
        stats.nodesList.forEach((node, index) => {
            const nodeData = filteredData[node];
            const recordCount = nodeData && typeof nodeData === 'object' ? Object.keys(nodeData).length : 0;
            backupText += `${index + 1}. ${node} (${recordCount} سجل)\n`;
        });

        await bot.sendMessage(BACKUP_CHANNEL_ID, backupText, { parse_mode: 'Markdown' });

        const fullBackup = {
            metadata: {
                backupTime: new Date().toISOString(),
                totalNodes: stats.totalNodes,
                totalRecords: stats.totalRecords,
                nodes: stats.nodesList
            },
            data: filteredData
        };

        const jsonData = JSON.stringify(fullBackup, null, 2);
        const fileName = `backup-${Date.now()}.json`;
        
        await bot.sendDocument(BACKUP_CHANNEL_ID, Buffer.from(jsonData), {}, {
            filename: fileName,
            contentType: 'application/json'
        });

        console.log(`✅ تم إنشاء نسخة احتياطية لـ ${stats.totalNodes} عقدة`);
        return true;

    } catch (error) {
        console.log('❌ خطأ في إنشاء النسخة الاحتياطية:', error.message);
        return false;
    }
}

// 🔍 دالة كشف الروابط
function containsLinks(text) {
    if (!text || typeof text !== 'string') {
        return false;
    }
    
    for (const pattern of LINK_PATTERNS) {
        const matches = text.match(pattern);
        if (matches && matches.length > 0) {
            return true;
        }
    }
    
    if (text.includes('%2F%2F') || text.includes('http%3A')) {
        return true;
    }
    
    return false;
}

// 🔍 دالة للكشف عن السب
function containsBadWords(text) {
    if (!text || typeof text !== 'string') {
        return false;
    }
    
    const words = text.toLowerCase().split(/\s+/);
    let foundBadWord = null;
    
    for (const word of words) {
        const cleanWord = word.replace(/[.,!?;:()]/g, '');
        
        for (const badWord of BAD_WORDS) {
            if (cleanWord === badWord.toLowerCase()) {
                foundBadWord = badWord;
                break;
            }
        }
        
        if (foundBadWord) break;
    }
    
    return foundBadWord !== null;
}

// 🛡️ دالة الفحص الرئيسية
function containsBadWordsOrLinks(text) {
    return containsBadWords(text) || containsLinks(text);
}

// 🗑️ دالة حذف التعليق/الرد
async function deleteOffensiveContent(commentKey, replyKey = null) {
    if (isBotPaused) {
        console.log('⏸️ البوت متوقف مؤقتاً - تخطي حذف المحتوى');
        return false;
    }

    if (!firebaseInitialized) {
        console.log('❌ Firebase غير متصل - لا يمكن الحذف');
        return false;
    }
    
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
                
                await commentRef.update({
                    user_all_rep: Math.max(0, remainingReplies).toString()
                });
                
                return true;
            } else {
                return false;
            }
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
async function addUserWarning(userId, commentData = null, replyData = null) {
    if (isBotPaused) {
        console.log('⏸️ البوت متوقف مؤقتاً - تخطي إضافة تحذير');
        return false;
    }

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
        
        console.log(`⚠️ تم إضافة تحذير للمستخدم ${userId} - الإجمالي: ${newWarnings}`);
        
        if (commentData || replyData) {
            const warningRef = db.ref(`users/${userId}/warning_comment_${newWarnings}`);
            const warningData = {
                timestamp: new Date().getTime().toString(),
                chapter_id: commentData?.chapter_id || 'غير محدد'
            };
            
            if (replyData) {
                warningData.deleted_message = replyData.text_rep || '';
                warningData.type = 'reply';
            } else if (commentData) {
                warningData.deleted_message = commentData.user_comment || '';
                warningData.type = 'comment';
            }
            
            await warningRef.set(warningData);
            console.log(`📝 تم إنشاء سجل تحذير مفصل: warning_comment_${newWarnings}`);
        }
        
        return newWarnings;
    } catch (error) {
        console.log('❌ خطأ في إضافة تحذير: ' + error.message);
        return false;
    }
}

// 🔄 نظام المراقبة التلقائية
function startCommentMonitoring() {
    if (isBotPaused) {
        console.log('⏸️ البوت متوقف مؤقتاً - تعطيل المراقبة');
        return;
    }

    if (!firebaseInitialized) {
        console.log('❌ Firebase غير متصل - تعطيل المراقبة');
        return;
    }
    
    console.log('🛡️ بدء مراقبة التعليقات والردود...');
    const db = admin.database();
    
    const commentsRef = db.ref('comments');
    commentsRef.on('child_added', async (snapshot) => {
        if (isBotPaused) return;

        const comment = snapshot.val();
        const commentKey = snapshot.key;
        
        console.log(`📝 تعليق جديد: ${commentKey}`);
        
        if (comment && comment.user_comment) {
            if (containsBadWordsOrLinks(comment.user_comment)) {
                console.log(`🚨 اكتشاف محتوى محظور في تعليق: ${commentKey}`);
                const deleteResult = await deleteOffensiveContent(commentKey);
                if (deleteResult) {
                    await addUserWarning(comment.user_id, comment, null);
                    sendTelegramAlert(`🚨 تم حذف تعليق محظور\n👤 المستخدم: ${comment.user_name}\n📝 التعليق: ${comment.user_comment.substring(0, 100)}...`);
                }
            }
        }
    });
    
    let processingReplies = new Set();
    
    commentsRef.on('child_changed', async (snapshot) => {
        if (isBotPaused) return;

        const comment = snapshot.val();
        const commentKey = snapshot.key;
        
        console.log(`🔄 تحديث في التعليق: ${commentKey}`);
        
        if (comment && comment.reply) {
            for (const replyKey in comment.reply) {
                const reply = comment.reply[replyKey];
                
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
                            await addUserWarning(reply.user_id, comment, reply);
                            sendTelegramAlert(`🚨 تم حذف رد محظور\n👤 المستخدم: ${reply.user_name}\n📝 الرد: ${reply.text_rep.substring(0, 100)}...`);
                        }
                    }
                }
                
                setTimeout(() => {
                    processingReplies.delete(replyKey);
                }, 1000);
            }
        }
    });
}

// 📨 دالة إرسال تنبيهات التليجرام
function sendTelegramAlert(message) {
    if (isBotPaused) {
        console.log('⏸️ البوت متوقف مؤقتاً - تخطي إرسال التنبيه');
        return;
    }

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
    if (isBotPaused) {
        console.log('⏸️ البوت متوقف مؤقتاً - تخطي فحص التعليقات');
        return 0;
    }

    if (!firebaseInitialized) return;
    
    try {
        console.log('🔍 بدء فحص التعليقات الحالية...');
        const db = admin.database();
        const snapshot = await db.ref('comments').once('value');
        const comments = snapshot.val();
        
        let deletedCount = 0;
        
        if (comments) {
            for (const commentKey in comments) {
                const comment = comments[commentKey];
                
                if (comment.user_comment && containsBadWordsOrLinks(comment.user_comment)) {
                    const deleteResult = await deleteOffensiveContent(commentKey);
                    if (deleteResult) {
                        await addUserWarning(comment.user_id, comment, null);
                        deletedCount++;
                    }
                }
                
                if (comment.reply) {
                    for (const replyKey in comment.reply) {
                        const reply = comment.reply[replyKey];
                        if (reply.text_rep && containsBadWordsOrLinks(reply.text_rep)) {
                            const deleteResult = await deleteOffensiveContent(commentKey, replyKey);
                            if (deleteResult) {
                                await addUserWarning(reply.user_id, comment, reply);
                                deletedCount++;
                            }
                        }
                    }
                }
            }
        }
        
        console.log(`✅ اكتمل الفحص - تم حذف ${deletedCount} محتوى محظور`);
        return deletedCount;
    } catch (error) {
        console.log('❌ خطأ في فحص التعليقات: ' + error.message);
        return 0;
    }
}

// 🛡️ دورة الحماية الرئيسية
async function protectionCycle() {
  if (isBotPaused) {
    console.log('⏸️ البوت متوقف مؤقتاً - تخطي دورة الحماية');
    return { deletedNodes: 0, deletedUsers: 0 };
  }

  if (!firebaseInitialized) {
    console.log('⏳ Firebase غير مهيئ، تخطي الدورة');
    return;
  }
  
  try {
    console.log('🔍 بدء دورة حماية...');
    
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

// 💬 أوامر التليجرام الكاملة

// أمر /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  
  const botStatus = isBotPaused ? '⏸️ متوقف مؤقتاً' : '✅ نشط';
  const emailStatus = gmailConfig.isConfigured ? '✅ مهيئ' : '❌ غير مهيئ';
  
  let message = `🛡️ *بوت حماية Firebase - ${botStatus}*\n\n`;
  message += `${isBotPaused ? '⏸️ البوت متوقف مؤقتاً' : '✅ البوت يعمل بشكل طبيعي'}\n`;
  message += `📧 نظام الإيميل: ${emailStatus}\n\n`;
  
  if (gmailConfig.email) {
    message += `📧 الإيميل المضبوط: ${gmailConfig.email}\n\n`;
  }
  
  message += `*أوامر الإيميل:*\n`;
  message += `/change_email [إيميل] - تعيين إيميل Gmail\n`;
  message += `/change_pass [كلمة_سر] - تعيين كلمة مرور التطبيقات\n`;
  message += `/email_status - حالة نظام الإيميل\n`;
  message += `/test_email - اختبار إرسال إيميل\n\n`;
  
  message += `*أوامر التحكم:*\n`;
  message += `/pause - إيقاف مؤقت\n`;
  message += `/resume - استئناف العمل\n`;
  message += `/status - حالة النظام\n\n`;
  
  message += `*الأوامر الأخرى:*\n`;
  message += `/protect - تشغيل حماية فورية\n`;
  message += `/backup - نسخ احتياطي فوري`;

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
  bot.sendMessage(chatId, `✅ تم تعيين الإيميل: ${email}\n\nالآن استخدم /change_pass [كلمة_السر] لإضافة كلمة مرور التطبيقات`);
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
  gmailConfig.isConfigured = true;
  
  bot.sendMessage(chatId, `✅ تم تهيئة نظام الإيميل بنجاح!\n\n📧 الإيميل: ${gmailConfig.email}\n\n🔔 سيتم الآن مراقبة الإشعارات وإرسال الإيميلات تلقائياً.`);
  console.log('✅ تم تهيئة نظام الإيميل بنجاح');
  
  setTimeout(() => {
    startNotificationsMonitoring();
  }, 2000);
});

// أمر حالة الإيميل
bot.onText(/\/email_status/, (msg) => {
  const chatId = msg.chat.id;
  
  let status = '';
  
  if (!gmailConfig.isConfigured) {
    status = `❌ *نظام الإيميل غير مهيئ*\n\nاستخدم:\n/change_email [إيميل]\n/change_pass [كلمة_سر]`;
  } else {
    status = `✅ *نظام الإيميل نشط*\n\n📧 الإيميل: ${gmailConfig.email}\n\n🔔 نظام مراقبة الإشعارات نشط\n📨 جاهز لإرسال الإيميلات التلقائية`;
  }
  
  bot.sendMessage(chatId, status, { parse_mode: 'Markdown' });
});

// أمر اختبار الإيميل
bot.onText(/\/test_email/, async (msg) => {
  const chatId = msg.chat.id;
  
  if (!gmailConfig.isConfigured) {
    bot.sendMessage(chatId, '❌ نظام الإيميل غير مهيئ! استخدم /change_email و /change_pass أولاً');
    return;
  }
  
  bot.sendMessage(chatId, '📧 جاري اختبار إرسال الإيميل...');
  
  const testData = {
    user_name: 'Mohamed admin',
    reply: 'هذا رسالة تجريبية لاختبار نظام الإشعارات. إذا استلمت هذا الإيميل، فهذا يعني أن النظام يعمل بشكل صحيح! 🎉',
    updateAt: Date.now().toString(),
    manga_name: 'مانجا تجريبية'
  };
  
  const success = await sendNotificationEmail(gmailConfig.email, testData);
  
  if (success) {
    bot.sendMessage(chatId, `✅ تم إرسال إيميل اختبار بنجاح إلى: ${gmailConfig.email}`);
  } else {
    bot.sendMessage(chatId, '❌ فشل إرسال إيميل الاختبار. تحقق من السجلات للتفاصيل.');
  }
});

// أمر /pause
bot.onText(/\/pause/, (msg) => {
  const chatId = msg.chat.id;
  isBotPaused = true;
  
  console.log('⏸️ البوت متوقف مؤقتاً بواسطة: ' + chatId);
  bot.sendMessage(chatId, 
    '⏸️ *تم إيقاف البوت مؤقتاً*\n\n' +
    '❌ الحماية متوقفة\n' +
    '❌ مراقبة التعليقات متوقفة\n' +
    '❌ النسخ الاحتياطي متوقف\n' +
    '❌ فحص المحتوى متوقف\n\n' +
    'استخدم /resume لاستئناف العمل', 
    { parse_mode: 'Markdown' }
  );
});

// أمر /resume
bot.onText(/\/resume/, (msg) => {
  const chatId = msg.chat.id;
  isBotPaused = false;
  
  console.log('▶️ البوت يعمل مرة أخرى بواسطة: ' + chatId);
  bot.sendMessage(chatId, 
    '▶️ *تم استئناف عمل البوت*\n\n' +
    '✅ الحماية نشطة\n' +
    '✅ مراقبة التعليقات نشطة\n' +
    '✅ النسخ الاحتياطي نشط\n' +
    '✅ فحص المحتوى نشط\n\n' +
    'جميع الأنظمة تعمل بشكل طبيعي', 
    { parse_mode: 'Markdown' }
  );
});

// أمر /status
bot.onText(/\/status/, (msg) => {
  const chatId = msg.chat.id;
  const status = firebaseInitialized ? '✅ متصل' : '❌ غير متصل';
  const botStatus = isBotPaused ? '⏸️ متوقف مؤقتاً' : '✅ نشط';
  const emailStatus = gmailConfig.isConfigured ? '✅ مهيئ' : '❌ غير مهيئ';
  
  bot.sendMessage(chatId, 
    `📊 *حالة النظام*\n\n` +
    `🤖 حالة البوت: ${botStatus}\n` +
    `🛡️ حماية Firebase: ${status}\n` +
    `📧 نظام الإيميل: ${emailStatus}\n` +
    `⏰ وقت التشغيل: ${Math.floor(process.uptime())} ثانية\n` +
    `📅 آخر تحديث: ${new Date().toLocaleString('ar-EG')}\n` +
    `⚡ سرعة الحماية: ${isBotPaused ? 'متوقفة' : 'نشطة'}\n` +
    `💾 النسخ الاحتياطي: ${isBotPaused ? 'متوقف' : 'نشط كل 24 ساعة'}\n` +
    `🔍 مراقبة التعليقات: ${isBotPaused ? 'متوقفة' : 'نشطة'}\n` +
    `🔔 مراقبة الإشعارات: ${isBotPaused ? 'متوقفة' : 'نشطة'}`,
    { parse_mode: 'Markdown' }
  );
});

// أمر /protect
bot.onText(/\/protect/, async (msg) => {
  const chatId = msg.chat.id;
  
  if (isBotPaused) {
    bot.sendMessage(chatId, '⏸️ البوت متوقف مؤقتاً - استخدم /resume أولا');
    return;
  }

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

// أمر /backup
bot.onText(/\/backup/, async (msg) => {
  const chatId = msg.chat.id;
  
  if (isBotPaused) {
    bot.sendMessage(chatId, '⏸️ البوت متوقف مؤقتاً - استخدم /resume أولا');
    return;
  }

  if (!firebaseInitialized) {
    bot.sendMessage(chatId, '❌ Firebase غير متصل!');
    return;
  }
  
  bot.sendMessage(chatId, '💾 جاري إنشاء نسخة احتياطية فورية...');
  
  const success = await createBackup();
  
  if (success) {
    bot.sendMessage(chatId, '✅ *تم إنشاء النسخة الاحتياطية وإرسالها إلى القناة!*', { parse_mode: 'Markdown' });
  } else {
    bot.sendMessage(chatId, '❌ فشل في إنشاء النسخة الاحتياطية. راجع السجلات للتفاصيل.');
  }
});

// معالجة أخطاء البوت
bot.on('polling_error', (error) => {
  console.log('🔴 خطأ في البوت: ' + error.message);
});

// ⚡ التشغيل التلقائي
console.log('⚡ تفعيل الحماية التلقائية...');

function startProtectionCycle() {
  setTimeout(async () => {
    try {
      await protectionCycle();
    } catch (error) {
      console.log('❌ خطأ في دورة الحماية: ' + error.message);
    } finally {
      startProtectionCycle();
    }
  }, 1000);
}

startProtectionCycle();

setTimeout(() => {
    startCommentMonitoring();
    setTimeout(() => {
        scanExistingComments();
    }, 3000);
}, 1000);

console.log('💾 تفعيل النسخ الاحتياطي التلقائي كل 24 ساعة...');
setInterval(() => {
    createBackup();
}, BACKUP_INTERVAL);

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

setTimeout(keepServiceAlive, 1000);

console.log('✅ النظام جاهز! جميع الأوامر نشطة.');
