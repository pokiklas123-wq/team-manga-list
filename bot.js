const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');
const express = require('express');
const https = require('https');
const nodemailer = require('nodemailer');

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

// 🔒 متغير للتحكم في حالة البوت
let isBotPaused = false;

// إعدادات النسخ الاحتياطي
const BACKUP_CHANNEL_ID = '-1003424582714';
const BACKUP_INTERVAL = 24 * 60 * 60 * 1000;

// إعدادات البريد الإلكتروني
const emailConfig = {
  service: 'gmail',
  auth: {
    user: 'riwayatisupoort@gmail.com',
    pass: 'yzf lvst iygr wnpz'
  }
};

// إنشاء transporter للبريد الإلكتروني
const emailTransporter = nodemailer.createTransport(emailConfig);

// اختبار اتصال البريد الإلكتروني
emailTransporter.verify((error, success) => {
  if (error) {
    console.log('❌ خطأ في إعداد البريد الإلكتروني:', error);
  } else {
    console.log('✅ البريد الإلكتروني جاهز للإرسال');
  }
});

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
    'قحبه', 'كحبة', 'كحبة', 'زبي', 'قضيب', 'مهبل', 'فرج', 'منيوكة',
    'منيوكه', 'داشر', 'داشرة', 'داشرر', 'داعر', 'داعره', 'داعرر',
    'سافل', 'سافلة', 'سافلل', 'سكس', 'sex', 'porn', 'قحب', 'قحبة',
    'قحبه', 'قحبو', 'نيك امك', 'نيكك', 'عطاي', 'نيك', 'nik',
    'Nik', 'NIK', 'Nik mok', 'nik mok', 'بنت القحبة', 
    'https-pokiklas123-wq-github-io-chapter-html', 'nikmok',
    'زكي', 'nikk', 'Nikk', 'NIKK', 'نيكسوة تاع مد', 
    'نيكسوة تاع ختك', 'نيكطيز', 'نيككس.امك', 'نيك.كس.امك', 
    'نيك.طيز.امك', 'نيك', 'سوة', 'قحبة', 'قحبا'
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

// 🔔 نظام مراقبة الإشعارات
let notificationsMonitoringActive = true;
let processedNotifications = new Set();

// دالة إرسال البريد الإلكتروني للمستخدم الذي تم الرد عليه
async function sendReplyNotification(targetUserEmail, notificationData) {
  try {
    const mailOptions = {
      from: 'riwayatisupoort@gmail.com',
      to: targetUserEmail,
      subject: `رد جديد على تعليقك - ${notificationData.replier_name}`,
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; background: #f9f9f9;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #0179FF; margin: 0;">Ruwayati</h2>
            <p style="color: #666; margin: 5px 0;">إشعار جديد</p>
          </div>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 15px 0; border-right: 4px solid #0179FF;">
            <div style="display: flex; align-items: center; margin-bottom: 15px;">
              <img src="${notificationData.replier_avatar}" alt="صورة المستخدم" style="width: 50px; height: 50px; border-radius: 50%; margin-left: 15px;">
              <div>
                <h3 style="color: #333; margin: 0; font-size: 18px;">${notificationData.replier_name}</h3>
                <p style="color: #888; margin: 5px 0; font-size: 14px;">رد على تعليقك</p>
              </div>
            </div>
            
            <div style="background: #f0f8ff; padding: 15px; border-radius: 8px; margin: 10px 0;">
              <p style="color: #666; font-size: 14px; margin: 0 0 10px 0;"><strong>تعليقك:</strong></p>
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0; background: white; padding: 10px; border-radius: 5px;">${notificationData.original_comment || 'تعليق سابق'}</p>
            </div>
            
            <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin: 10px 0;">
              <p style="color: #666; font-size: 14px; margin: 0 0 10px 0;"><strong>الرد:</strong></p>
              <p style="color: #2e7d32; font-size: 16px; line-height: 1.6; margin: 0; background: white; padding: 10px; border-radius: 5px;">${notificationData.reply}</p>
            </div>
            
            <div style="text-align: left; margin-top: 15px;">
              <p style="color: #999; font-size: 12px; margin: 0;">
                ${new Date(notificationData.timestamp).toLocaleString('ar-EG')}
              </p>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;">
            <p style="color: #888; font-size: 12px;">
              تم إرسال هذا الإشعار تلقائياً من نظام Ruwayati
            </p>
          </div>
        </div>
      `
    };

    const result = await emailTransporter.sendMail(mailOptions);
    console.log(`✅ تم إرسال إشعار بالبريد إلى: ${targetUserEmail}`);
    return true;
  } catch (error) {
    console.log(`❌ خطأ في إرسال البريد إلى ${targetUserEmail}:`, error.message);
    return false;
  }
}

// دالة فحص ومعالجة الإشعارات الموجودة
async function processExistingNotifications() {
  if (!firebaseInitialized || !notificationsMonitoringActive || isBotPaused) {
    return;
  }

  try {
    console.log('🔍 بدء فحص الإشعارات الموجودة...');
    const db = admin.database();
    const usersSnapshot = await db.ref('users').once('value');
    const users = usersSnapshot.val();

    if (!users) {
      console.log('❌ لا يوجد مستخدمين في قاعدة البيانات');
      return;
    }

    let totalProcessed = 0;
    let totalSent = 0;

    for (const userId in users) {
      const userData = users[userId];
      
      if (userData.notifications_users) {
        const notifications = userData.notifications_users;
        
        for (const notificationId in notifications) {
          const notificationData = notifications[notificationId];
          const notificationUniqueId = `${userId}_${notificationId}`;

          // تجنب معالجة الإشعارات المكررة
          if (processedNotifications.has(notificationUniqueId)) {
            continue;
          }

          console.log(`🔔 معالجة إشعار موجود: ${notificationId} للمستخدم: ${userId}`);
          
          if (userData.user_email && notificationData) {
            const emailNotificationData = {
              replier_name: notificationData.user_name || 'مستخدم',
              replier_avatar: notificationData.user_avatar || '',
              reply: notificationData.reply || 'رد',
              original_comment: notificationData.user_comment || 'تعليق سابق',
              timestamp: notificationData.updateAt || Date.now()
            };
            
            const emailSent = await sendReplyNotification(userData.user_email, emailNotificationData);
            
            if (emailSent) {
              processedNotifications.add(notificationUniqueId);
              totalSent++;
              
              sendTelegramAlert(
                `🔔 تم إرسال إشعار موجود بالبريد\n` +
                `👤 إلى: ${userData.user_email}\n` +
                `🧑‍💼 من: ${notificationData.user_name}\n` +
                `📝 الرد: ${notificationData.reply}\n` +
                `🕒 الوقت: ${new Date().toLocaleString('ar-EG')}`
              );
            }
          }
          
          totalProcessed++;
        }
      }
    }

    console.log(`✅ اكتمل فحص الإشعارات - تم معالجة ${totalProcessed} إشعار، تم إرسال ${totalSent} بريد`);

  } catch (error) {
    console.log('❌ خطأ في فحص الإشعارات الموجودة:', error.message);
  }
}

// دالة مراقبة الإشعارات المحسنة
function startNotificationsMonitoring() {
  if (!firebaseInitialized) {
    console.log('❌ Firebase غير متصل - تعطيل مراقبة الإشعارات');
    return;
  }

  if (!notificationsMonitoringActive) {
    console.log('⏸️ مراقبة الإشعارات معطلة');
    return;
  }

  console.log('🔔 بدء مراقبة الإشعارات في جميع المستخدمين...');
  const db = admin.database();

  // مراقبة جميع المستخدمين
  const usersRef = db.ref('users');
  
  usersRef.on('child_added', (userSnapshot) => {
    const userId = userSnapshot.key;
    const userData = userSnapshot.val();
    
    console.log(`👤 مراقبة مستخدم: ${userId}`);
    
    // مراقبة الإشعارات لكل مستخدم
    const userNotificationsRef = db.ref(`users/${userId}/notifications_users`);
    
    userNotificationsRef.on('child_added', async (notificationSnapshot) => {
      if (!notificationsMonitoringActive || isBotPaused) return;

      const notificationId = notificationSnapshot.key;
      const notificationData = notificationSnapshot.val();
      
      // إنشاء معرف فريد للإشعار
      const notificationUniqueId = `${userId}_${notificationId}`;
      
      // تجنب معالجة الإشعارات المكررة
      if (processedNotifications.has(notificationUniqueId)) {
        console.log(`⏭️ تخطي إشعار مكرر: ${notificationUniqueId}`);
        return;
      }
      
      processedNotifications.add(notificationUniqueId);
      
      console.log(`🔔 إشعار جديد للمستخدم: ${userId}`);
      console.log('📝 بيانات الإشعار:', notificationData);

      if (userData && userData.user_email && notificationData) {
        // إعداد بيانات الإشعار
        const emailNotificationData = {
          replier_name: notificationData.user_name || 'مستخدم',
          replier_avatar: notificationData.user_avatar || '',
          reply: notificationData.reply || 'رد',
          original_comment: notificationData.user_comment || 'تعليق سابق',
          timestamp: notificationData.updateAt || Date.now()
        };
        
        // إرسال البريد الإلكتروني للمستخدم الحالي (الذي تم الرد عليه)
        const emailSent = await sendReplyNotification(userData.user_email, emailNotificationData);
        
        if (emailSent) {
          // إرسال تنبيه للتليجرام
          sendTelegramAlert(
            `🔔 تم إرسال إشعار جديد بالبريد\n` +
            `👤 إلى: ${userData.user_email}\n` +
            `🧑‍💼 من: ${notificationData.user_name}\n` +
            `📝 الرد: ${notificationData.reply}\n` +
            `🕒 الوقت: ${new Date().toLocaleString('ar-EG')}`
          );
        }
      } else {
        console.log('❌ لا يوجد بريد إلكتروني للمستخدم أو بيانات إشعار غير كافية');
      }
    });

    // مراقبة التحديثات على الإشعارات الحالية
    userNotificationsRef.on('child_changed', async (notificationSnapshot) => {
      if (!notificationsMonitoringActive || isBotPaused) return;

      const notificationId = notificationSnapshot.key;
      const notificationData = notificationSnapshot.val();
      const notificationUniqueId = `${userId}_${notificationId}`;
      
      // إذا كان هذا إشعارًا جديدًا لم نعالجه من قبل
      if (!processedNotifications.has(notificationUniqueId)) {
        processedNotifications.add(notificationUniqueId);
        
        console.log(`🔄 إشعار محدث للمستخدم: ${userId}`);
        
        if (userData && userData.user_email && notificationData) {
          const emailNotificationData = {
            replier_name: notificationData.user_name || 'مستخدم',
            replier_avatar: notificationData.user_avatar || '',
            reply: notificationData.reply || 'رد',
            original_comment: notificationData.user_comment || 'تعليق سابق',
            timestamp: notificationData.updateAt || Date.now()
          };
          
          const emailSent = await sendReplyNotification(userData.user_email, emailNotificationData);
          
          if (emailSent) {
            sendTelegramAlert(
              `🔔 تم إرسال إشعار محدث بالبريد\n` +
              `👤 إلى: ${userData.user_email}\n` +
              `🧑‍💼 من: ${notificationData.user_name}\n` +
              `📝 الرد: ${notificationData.reply}`
            );
          }
        }
      }
    });

    // تنظيف الإشعارات المحذوفة من الذاكرة
    userNotificationsRef.on('child_removed', (removedSnapshot) => {
      const notificationId = removedSnapshot.key;
      const notificationUniqueId = `${userId}_${notificationId}`;
      processedNotifications.delete(notificationUniqueId);
      console.log(`🗑️ تم حذف إشعار: ${notificationId} للمستخدم: ${userId}`);
    });
  });

  // تنظيف مراقبة المستخدمين المحذوفين
  usersRef.on('child_removed', (removedSnapshot) => {
    const userId = removedSnapshot.key;
    console.log(`🗑️ تم حذف مستخدم: ${userId}`);
  });
}

// 🔄 نظام النسخ الاحتياطي المحسن
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
        console.log('💾 بدء إنشاء نسخة احتياطية لجميع العقد...');
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

// 🔍 دالة كشف الروابط المحسنة
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

// 🛡️ دالة الفحص الرئيسية المحسنة
function containsBadWordsOrLinks(text) {
    return containsBadWords(text) || containsLinks(text);
}

// 🗑️ دالة حذف التعليق/الرد مع تحديث العداد
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

// 🔄 نظام المراقبة التلقائية المحسن
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

// 💬 أوامر التليجرام الكاملة

// أمر /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  console.log('📩 /start من: ' + chatId);
  
  const botStatus = isBotPaused ? '⏸️ متوقف مؤقتاً' : '✅ نشط';
  const notificationsStatus = notificationsMonitoringActive ? '✅ نشطة' : '⏸️ متوقفة';
  
  bot.sendMessage(chatId, `🛡️ *بوت حماية Firebase - ${botStatus}*

${isBotPaused ? '⏸️ البوت متوقف مؤقتاً' : '✅ البوت يعمل بشكل طبيعي'}
🔔 مراقبة الإشعارات: ${notificationsStatus}

*أوامر التحكم:*
/pause - إيقاف مؤقت
/resume - استئناف العمل
/status - حالة النظام
/notifications on - تفعيل الإشعارات
/notifications off - تعطيل الإشعارات
/process_notifications - معالجة الإشعارات الموجودة

*الأوامر الأخرى:*
/protect - تشغيل حماية فورية
/backup - نسخ احتياطي فوري
/test - اختبار النظام
/scan_comments - فحص التعليقات الحالية
/badwords_list - عرض الكلمات الممنوعة
/test_filter [نص] - اختبار الفلتر
/test_links [نص] - اختبار كشف الروابط
/add_word [كلمة] - إضافة كلمة ممنوعة
/remove_word [كلمة] - إزالة كلمة ممنوعة`, { parse_mode: 'Markdown' });
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
    '❌ إرسال الإشعارات متوقف\n\n' +
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
    '✅ إرسال الإشعارات نشط\n\n' +
    'جميع الأنظمة تعمل بشكل طبيعي', 
    { parse_mode: 'Markdown' }
  );
});

// أمر /status
bot.onText(/\/status/, (msg) => {
  const chatId = msg.chat.id;
  const status = firebaseInitialized ? '✅ متصل' : '❌ غير متصل';
  const botStatus = isBotPaused ? '⏸️ متوقف مؤقتاً' : '✅ نشط';
  const notificationsStatus = notificationsMonitoringActive ? '✅ نشطة' : '⏸️ متوقفة';
  
  bot.sendMessage(chatId, 
    `📊 *حالة النظام*\n\n` +
    `🤖 حالة البوت: ${botStatus}\n` +
    `🛡️ حماية Firebase: ${status}\n` +
    `🔔 مراقبة الإشعارات: ${notificationsStatus}\n` +
    `⏰ وقت التشغيل: ${Math.floor(process.uptime())} ثانية\n` +
    `📅 آخر تحديث: ${new Date().toLocaleString('ar-EG')}\n` +
    `⚡ سرعة الحماية: ${isBotPaused ? 'متوقفة' : 'كل 1 ثانية'}\n` +
    `💾 النسخ الاحتياطي: ${isBotPaused ? 'متوقف' : 'نشط كل 24 ساعة'}\n` +
    `🔍 مراقبة التعليقات: ${isBotPaused ? 'متوقفة' : 'نشطة'}`,
    { parse_mode: 'Markdown' }
  );
});

// أمر /notifications
bot.onText(/\/notifications (on|off)/, (msg, match) => {
  const chatId = msg.chat.id;
  const action = match[1];
  
  if (action === 'on') {
    notificationsMonitoringActive = true;
    bot.sendMessage(chatId, '🔔 *تم تفعيل مراقبة الإشعارات*\n\nسيتم إرسال بريد إلكتروني للمستخدمين عند تلقي إشعارات جديدة.', { parse_mode: 'Markdown' });
    console.log('🔔 تفعيل مراقبة الإشعارات');
    
    // إعادة تشغيل المراقبة إذا كانت متوقفة
    if (firebaseInitialized) {
      setTimeout(() => {
        startNotificationsMonitoring();
      }, 1000);
    }
  } else {
    notificationsMonitoringActive = false;
    bot.sendMessage(chatId, '⏸️ *تم تعطيل مراقبة الإشعارات*\n\nلن يتم إرسال أي بريد إلكتروني للمستخدمين.', { parse_mode: 'Markdown' });
    console.log('⏸️ تعطيل مراقبة الإشعارات');
  }
});

// أمر جديد: معالجة الإشعارات الموجودة
bot.onText(/\/process_notifications/, async (msg) => {
  const chatId = msg.chat.id;
  
  if (isBotPaused) {
    bot.sendMessage(chatId, '⏸️ البوت متوقف مؤقتاً - استخدم /resume أولا');
    return;
  }

  if (!firebaseInitialized) {
    bot.sendMessage(chatId, '❌ Firebase غير متصل!');
    return;
  }
  
  bot.sendMessage(chatId, '🔍 جاري معالجة الإشعارات الموجودة...');
  await processExistingNotifications();
  bot.sendMessage(chatId, '✅ تمت معالجة الإشعارات الموجودة');
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

// أمر /test
bot.onText(/\/test/, (msg) => {
  const chatId = msg.chat.id;
  const botStatus = isBotPaused ? '⏸️ متوقف مؤقتاً' : '✅ نشط';
  const notificationsStatus = notificationsMonitoringActive ? '✅ نشطة' : '⏸️ متوقفة';
  
  bot.sendMessage(chatId, 
    `${isBotPaused ? '⏸️ البوت متوقف مؤقتاً' : '✅ البوت يعمل بشكل طبيعي!'}\n` +
    `🔔 مراقبة الإشعارات: ${notificationsStatus}\n` +
    '🛡️ جميع أنظمة الحماية جاهزة\n' +
    '💾 نظام النسخ الاحتياطي جاهز\n' +
    `⚡ سرعة الحماية: ${isBotPaused ? 'متوقفة' : 'كل ثانية'}\n` +
    `⏰ وقت التشغيل: ${Math.floor(process.uptime())} ثانية`
  );
});

// أمر /scan_comments
bot.onText(/\/scan_comments/, async (msg) => {
  const chatId = msg.chat.id;
  
  if (isBotPaused) {
    bot.sendMessage(chatId, '⏸️ البوت متوقف مؤقتاً - استخدم /resume أولا');
    return;
  }

  if (!firebaseInitialized) {
    bot.sendMessage(chatId, '❌ Firebase غير متصل!');
    return;
  }
  
  bot.sendMessage(chatId, '🔍 جاري فحص جميع التعليقات والردود...');
  
  const deletedCount = await scanExistingComments();
  
  bot.sendMessage(chatId, `✅ اكتمل الفحص\nتم حذف ${deletedCount} محتوى محظور`);
});

// أمر /badwords_list
bot.onText(/\/badwords_list/, (msg) => {
  const chatId = msg.chat.id;
  const wordsList = BAD_WORDS.join(', ');
  bot.sendMessage(chatId, `📋 *الكلمات الممنوعة:*\n\n${wordsList}`, { parse_mode: 'Markdown' });
});

// أمر /test_filter
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

// أمر /test_links
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

// أمر /add_word
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

// أمر /remove_word
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

// معالجة أخطاء البوت
bot.on('polling_error', (error) => {
  console.log('🔴 خطأ في البوت: ' + error.message);
});

// ⚡ التشغيل التلقائي كل 1 ثانية
console.log('⚡ تفعيل الحماية التلقائية كل 1 ثانية...');

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

// بدء دورة الحماية
startProtectionCycle();

// تفعيل نظام مراقبة التعليقات بعد 5 ثواني من التشغيل
setTimeout(() => {
    startCommentMonitoring();
    setTimeout(() => {
        scanExistingComments();
    }, 3000);
}, 1000);

// تفعيل نظام مراقبة الإشعارات بعد 10 ثواني من التشغيل
setTimeout(() => {
    startNotificationsMonitoring();
}, 10000);

// معالجة الإشعارات الموجودة بعد 15 ثانية من التشغيل
setTimeout(() => {
    processExistingNotifications();
}, 15000);

// 🕒 نظام النسخ الاحتياطي التلقائي
console.log('💾 تفعيل النسخ الاحتياطي التلقائي كل 24 ساعة...');
setInterval(() => {
    createBackup();
}, BACKUP_INTERVAL);

// بدء النسخ الاحتياطي الأول بعد 1 ثانية من التشغيل
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

// بدء الحفاظ على الاستيقاظ بعد 1 ثانية
setTimeout(keepServiceAlive, 1000);

console.log('✅ النظام جاهز! الحماية التلقائية تعمل كل ثانية وجميع الأوامر نشطة.');
