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

// 📧 نظام إرسال الإيميلات - محدث ✨
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
      <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">🔔 إشعار جديد</h1>
          <p style="color: #f0f0f0; margin: 10px 0 0 0; font-size: 14px;">رد جديد على تعليقك</p>
        </div>

        <div style="padding: 30px; background: #f8f9fa;">
          <!-- التعليق الأصلي -->
          <div style="margin-bottom: 25px;">
            <h3 style="color: #4a5568; margin-bottom: 12px; font-size: 16px; display: flex; align-items: center;">
              💬 تعليقك الأصلي
            </h3>
            <div style="background: #e2e8f0; padding: 18px; border-radius: 8px; border-right: 4px solid #718096; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <p style="margin: 0; color: #2d3748; font-size: 15px; line-height: 1.6;">${notificationData.user_comment || 'لا يوجد نص'}</p>
            </div>
          </div>

          <!-- فاصل -->
          <div style="text-align: center; margin: 30px 0;">
            <span style="background: #cbd5e0; padding: 8px 20px; border-radius: 20px; font-size: 12px; color: #4a5568; font-weight: bold;">⬇️ الرد الجديد ⬇️</span>
          </div>

          <!-- معلومات المستخدم الذي رد -->
          <div style="margin-bottom: 20px; background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
            <h3 style="color: #4a5568; margin-bottom: 10px; font-size: 14px;">👤 المستخدم</h3>
            <p style="font-size: 20px; color: #667eea; font-weight: bold; margin: 0;">${notificationData.user_name || 'مستخدم'}</p>
          </div>

          <!-- الرد -->
          <div style="margin-bottom: 25px;">
            <h3 style="color: #4a5568; margin-bottom: 12px; font-size: 16px;">💭 الرد</h3>
            <div style="background: white; padding: 18px; border-radius: 8px; border-right: 4px solid #667eea; box-shadow: 0 2px 8px rgba(102, 126, 234, 0.15);">
              <p style="margin: 0; color: #2d3748; font-size: 15px; line-height: 1.6; font-weight: 500;">${notificationData.reply || 'لا يوجد نص'}</p>
            </div>
          </div>

          <!-- الوقت -->
          <div style="text-align: center; padding: 15px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
            <p style="margin: 0; color: #718096; font-size: 13px;">⏰ ${new Date(parseInt(notificationData.updateAt) || Date.now()).toLocaleString('ar-EG', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</p>
          </div>
        </div>

        <div style="background: #2d3748; padding: 20px; text-align: center; border-radius: 0 0 10px 10px;">
          <p style="color: #a0aec0; font-size: 12px; margin: 0;">
            تم إرسال هذا الإيميل تلقائياً من نظام إشعارات منصة المانجا العربية
          </p>
          <p style="color: #718096; font-size: 11px; margin: 10px 0 0 0;">
            © 2025 Manga Arabic Platform
          </p>
        </div>
      </div>
    `;

    const mailOptions = {
      from: `"منصة المانجا العربية" <${gmailConfig.email}>`,
      to: userEmail,
      subject: `🔔 ${notificationData.user_name} رد على تعليقك`,
      html: emailContent,
      text: `إشعار جديد\n\nتعليقك: ${notificationData.user_comment}\n\n${notificationData.user_name} رد: ${notificationData.reply}\n\nالوقت: ${new Date(parseInt(notificationData.updateAt) || Date.now()).toLocaleString('ar-EG')}`
    };

    const result = await transporter.sendMail(mailOptions);
    console.log(`✅ تم إرسال إيميل إشعار إلى: ${userEmail} - Message ID: ${result.messageId}`);
    return true;

  } catch (error) {
    console.log('❌ خطأ في إرسال الإيميل:', error.message);
    if (error.code) console.log('   Error Code:', error.code);
    return false;
  }
}

// 🔍 نظام مراقبة الإشعارات - محدث بالكامل ✨
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

  // خريطة لتخزين حالة الإشعارات السابقة لكل مستخدم
  const previousNotificationsState = new Map();

  const usersRef = db.ref('users');

  // مراقبة التغييرات على المستخدمين
  usersRef.on('child_changed', async (userSnapshot) => {
    if (isBotPaused) return;

    const userId = userSnapshot.key;
    const userData = userSnapshot.val();

    if (userData && userData.notifications_users) {
      const currentNotifications = userData.notifications_users;
      // ✅ الآن نستخرج الإيميل الصحيح - إيميل المستخدم صاحب التعليق الأصلي
      const userEmail = userData.user_email;
      const userName = userData.user_name;

      if (!userEmail) {
        console.log(`⚠️ المستخدم ${userName || userId} لا يملك إيميل`);
        return;
      }

      const previousNotifications = previousNotificationsState.get(userId) || {};

      // البحث عن الإشعارات الجديدة
      for (const notificationKey in currentNotifications) {
        if (!previousNotifications[notificationKey]) {
          const notification = currentNotifications[notificationKey];
          console.log(`🔔 إشعار جديد للمستخدم: ${userName} (${userId})`);
          console.log(`   من: ${notification.user_name}`);
          console.log(`   الرد: ${notification.reply?.substring(0, 50)}...`);

          // ✅ إرسال الإيميل لصاحب التعليق الأصلي (المستخدم الذي يستقبل الإشعار)
          const emailSent = await sendNotificationEmail(userEmail, {
            user_name: notification.user_name, // اسم الشخص الذي رد
            reply: notification.reply, // نص الرد
            updateAt: notification.updateAt, // وقت الرد
            user_comment: notification.user_commen // التعليق الأصلي
          });

          if (emailSent) {
            console.log(`✅ تم إرسال إشعار بريدي إلى: ${userEmail}`);

            // إرسال تنبيه للمسؤول أيضاً
            const adminChatId = process.env.ADMIN_CHAT_ID;
            if (adminChatId) {
              bot.sendMessage(adminChatId,
                `📧 *تم إرسال إشعار بريدي*\n\n` +
                `👤 إلى: ${userName}\n` +
                `📧 الإيميل: ${userEmail}\n` +
                `💬 رد من: ${notification.user_name}\n` +
                `📝 الرد: ${notification.reply?.substring(0, 100)}...`,
                { parse_mode: 'Markdown' }
              ).catch(e => console.log('⚠️ خطأ في إرسال تنبيه التليجرام:', e.message));
            }
          } else {
            console.log(`❌ فشل إرسال إشعار إلى: ${userEmail}`);
          }
        }
      }

      // تحديث الحالة السابقة
      previousNotificationsState.set(userId, { ...currentNotifications });
    }
  });

  // تحميل الحالة الأولية للإشعارات لتجنب إرسال إشعارات قديمة
  usersRef.once('value', (snapshot) => {
    const users = snapshot.val() || {};
    let totalNotifications = 0;

    for (const userId in users) {
      const userData = users[userId];
      if (userData && userData.notifications_users) {
        previousNotificationsState.set(userId, { ...userData.notifications_users });
        totalNotifications += Object.keys(userData.notifications_users).length;
      }
    }

    console.log(`📊 تم تحميل ${previousNotificationsState.size} مستخدم بإجمالي ${totalNotifications} إشعار موجود`);
  });

  console.log('✅ نظام مراقبة الإشعارات يعمل بنجاح');
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

  // بدء مراقبة الإشعارات بعد التهيئة
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
    user_name: 'Mohamed Test User',
    user_comment: 'هذا تعليق تجريبي لاختبار النظام. إذا وصلك هذا الإيميل، فالنظام يعمل بشكل صحيح!',
    reply: 'هذه رسالة تجريبية للرد على التعليق. نظام الإشعارات البريدية يعمل بنجاح! 🎉',
    updateAt: Date.now().toString()
  };

  const success = await sendNotificationEmail(gmailConfig.email, testData);

  if (success) {
    bot.sendMessage(chatId, `✅ تم إرسال إيميل اختبار بنجاح إلى: ${gmailConfig.email}\n\nتحقق من صندوق الوارد الخاص بك.`);
  } else {
    bot.sendMessage(chatId, '❌ فشل إرسال إيميل الاختبار. تحقق من:\n1. كلمة مرور التطبيقات صحيحة\n2. الاتصال بالإنترنت\n3. السجلات للتفاصيل');
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
    '❌ فحص المحتوى متوقف\n' +
    '❌ مراقبة الإشعارات متوقفة\n\n' +
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
    '✅ فحص المحتوى نشط\n' +
    '✅ مراقبة الإشعارات نشطة\n\n' +
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
