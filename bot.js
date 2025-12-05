// ⚠️ إيقاف تحذيرات Deprecation لـ node-telegram-bot-api
process.env.NTBA_FIX_350 = '1';
process.env.NTBA_FIX_319 = '1';
process.env.NTBA_FIX_350_2 = '1';

const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');
const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');

// 🔔 نظام الإنذار البسيط جداً
const ADMIN_CHAT_ID = '5136004648'; 

// بدء خادم ويب لـ UptimeRobot
const app = express();
const PORT = process.env.PORT || 3000;

// ضروري لمعالجة webhook
app.use(express.json());

// 🎨 صفحات ويب للحفاظ على النشاط
let visitorCount = 0;

// طرق UptimeRobot
app.get('/', (req, res) => {
  visitorCount++;
  console.log('📍 طلب على الصفحة الرئيسية - الزائر:', visitorCount);
  res.json({ 
    status: 'active', 
    service: 'Firebase Protection Bot',
    timestamp: new Date().toLocaleString('ar-EG'),
    uptime: Math.floor(process.uptime()) + ' seconds',
    visitors: visitorCount,
    platform: process.env.RAILWAY_STATIC_URL ? 'Railway' : (process.env.RENDER ? 'Render' : 'Local')
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

// 📱 صفحات إضافية للحفاظ على النشاط
app.get('/visitors', (req, res) => {
  visitorCount++;
  res.json({ 
    visitors: visitorCount,
    lastVisit: new Date().toLocaleString('ar-EG'),
    uptime: Math.floor(process.uptime()) + ' seconds'
  });
});

// ❌ إزالة صفحة /app التي تسبب مشاكل مع firebaseInitialized
// سنستخدم صفحة بديلة تعمل بدون متغيرات JavaScript

app.get('/app', (req, res) => {
  visitorCount++;
  const platformName = process.env.RAILWAY_STATIC_URL ? 'Railway' : 
                      (process.env.RENDER ? 'Render' : 'محلي');
  
  res.send(`
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>مانجا عربية - نظام الحماية</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                text-align: center;
                padding: 50px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                direction: rtl;
            }
            .container {
                background: rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(10px);
                padding: 30px;
                border-radius: 20px;
                max-width: 500px;
                margin: 0 auto;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            }
            .status {
                font-size: 24px;
                margin: 20px 0;
                padding: 10px;
                border-radius: 10px;
                background: rgba(0, 255, 0, 0.2);
            }
            .info {
                text-align: right;
                margin: 20px 0;
                padding: 15px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 10px;
            }
            .badge {
                display: inline-block;
                padding: 5px 15px;
                border-radius: 20px;
                background: #4CAF50;
                color: white;
                font-weight: bold;
                margin: 5px;
            }
            .badge-error {
                background: #f44336;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🛡️ نظام حماية مانجا عربية</h1>
            <div class="status">✅ النظام يعمل بنشاط</div>
            
            <div class="info">
                <h3>📊 معلومات النظام:</h3>
                <p><strong>⏰ وقت التشغيل:</strong> ${Math.floor(process.uptime())} ثانية</p>
                <p><strong>📅 آخر تحديث:</strong> ${new Date().toLocaleString('ar-EG')}</p>
                <p><strong>👥 عدد الزيارات:</strong> ${visitorCount}</p>
                <p><strong>🤖 حالة البوت:</strong> <span class="badge">نشط</span></p>
                <p><strong>🌐 المنصة:</strong> <span class="badge">${platformName}</span></p>
            </div>
        </div>
    </body>
    </html>
  `);
});

console.log('🚀 بدء تشغيل البوت مع الحماية النشطة والنسخ الاحتياطي...');

// 🔥 الجزء الأساسي: البوت والحماية
const token = process.env.BOT_TOKEN;
if (!token) {
  console.log('❌ BOT_TOKEN غير موجود');
  process.exit(1);
}

// 🔧 كشف المنصة
const platform = process.env.RAILWAY_STATIC_URL ? 'Railway' : 
                 process.env.RENDER ? 'Render' : 
                 'Local';
console.log(`🌐 المنصة المكتشفة: ${platform}`);

// ⚡ **الحل: استخدام polling محسّن مع تأخير على Railway**
let bot;
let isBotRunning = false;

// دالة لبدء البوت بأمان
async function startBotSafely() {
  if (isBotRunning) {
    console.log('⚠️ البوت يعمل بالفعل، تخطي البدء المتكرر');
    return;
  }

  try {
    console.log('⏳ بدء البوت مع تأخير آمن...');
    
    // تأخير لضمان عدم وجود نزاعات
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // تهيئة البوت مع إعدادات polling محسنة
    bot = new TelegramBot(token, {
      polling: {
        interval: 300,
        autoStart: false,
        params: {
          timeout: 10,
          limit: 100,
          allowed_updates: []
        }
      }
    });

    // بدء polling يدوياً بعد التأكد
    await bot.startPolling();
    isBotRunning = true;
    
    console.log('✅ بوت التليجرام متصل بنجاح');
    
    // تأخير إضافي قبل تفعيل الوظائف
    setTimeout(() => {
      setupBotCommands();
      console.log('✅ تم تفعيل أوامر البوت');
    }, 2000);
    
  } catch (error) {
    console.log('❌ خطأ في بدء البوت:', error.message);
    
    // إعادة المحاولة بعد 30 ثانية
    setTimeout(() => {
      console.log('🔄 إعادة محاولة بدء البوت...');
      startBotSafely();
    }, 30000);
  }
}

// 🔔🚨 نظام الإنذار البسيط
process.on('uncaughtException', async (error) => {
  const crashTime = new Date().toLocaleString('ar-DZ');
  const crashInfo = `💥 *إنذار توقف البوت* 💥\n\n⏰ الوقت: ${crashTime}\n💥 السبب: ${error.message}\n📊 وقت التشغيل: ${Math.floor(process.uptime())} ثانية\n🌐 المنصة: ${platform}`;
  
  console.log(crashInfo);
  fs.appendFileSync('last_crash.txt', `\n${new Date().toISOString()}: ${error.message}\n`);
  
  try {
    if (ADMIN_CHAT_ID && bot) {
      await bot.sendMessage(ADMIN_CHAT_ID, crashInfo, { parse_mode: 'Markdown' });
      console.log('📤 تم إرسال إنذار إلى Telegram');
    }
  } catch (e) {
    console.log('⚠️ لم أستطع إرسال الإنذار:', e.message);
  }
  
  setTimeout(() => {
    console.log('🛑 إيقاف البوت...');
    process.exit(1);
  }, 2000);
});

// 🔒 متغيرات للتحكم في حالة البوت - نظام مركزي
let isBotPaused = false;
let globalPauseState = false; // حالة التوقف العالمية من Firebase
let pauseListenerActive = false;

// إعدادات النسخ الاحتياطي
const BACKUP_CHANNEL_ID = '-1003424582714';
const BACKUP_INTERVAL = 24 * 60 * 60 * 1000; // كل 24 ساعة

// 🛠️ **تحسين معالجة مفاتيح Firebase لجميع المنصات**
let firebaseInitialized = false;
let firebaseError = null;

// دالة لمعالجة المفتاح الخاص لكل منصة
function processFirebasePrivateKey(privateKey) {
  if (!privateKey) return '';
  
  console.log('🔧 معالجة المفتاح الخاص...');
  
  let processedKey = privateKey;
  
  // إزالة الاقتباسات الزائدة
  processedKey = processedKey.replace(/^["']|["']$/g, '');
  
  // كشف المنصة ومعالجة \n بناءً عليها
  if (platform === 'Railway') {
    console.log('🚂 Railway: معالجة \\\\n و \\n');
    processedKey = processedKey.replace(/\\\\n/g, '\n');
    processedKey = processedKey.replace(/\\n/g, '\n');
  } else if (platform === 'Render') {
    console.log('🎨 Render: معالجة \\n');
    processedKey = processedKey.replace(/\\n/g, '\n');
  } else {
    console.log('💻 Local: معالجة قياسية');
    processedKey = processedKey.replace(/\\n/g, '\n');
  }
  
  // التأكد من أن المفتاح يبدأ وينتهي بشكل صحيح
  if (!processedKey.includes('-----BEGIN PRIVATE KEY-----')) {
    processedKey = '-----BEGIN PRIVATE KEY-----\n' + processedKey;
  }
  if (!processedKey.includes('-----END PRIVATE KEY-----')) {
    processedKey = processedKey + '\n-----END PRIVATE KEY-----';
  }
  
  processedKey = processedKey.trim();
  
  console.log(`📏 طول المفتاح: ${processedKey.length} حرف`);
  console.log(`✓ يبدأ بـ BEGIN: ${processedKey.includes('BEGIN')}`);
  console.log(`✓ ينتهي بـ END: ${processedKey.includes('END')}`);
  
  return processedKey;
}

// 🔄 نظام التوقف المركزي عبر Firebase
async function setupCentralPauseControl() {
  if (!firebaseInitialized) return;
  
  try {
    const db = admin.database();
    const pauseRef = db.ref('bot_control/global_pause');
    
    // استمع لتغييرات حالة التوقف العالمية
    pauseRef.on('value', (snapshot) => {
      const newPauseState = snapshot.val();
      if (newPauseState !== null) {
        globalPauseState = newPauseState;
        console.log(`🔄 تحديث حالة التوقف العالمية: ${globalPauseState ? 'متوقف' : 'نشط'}`);
        
        // إذا كان هناك بوت محلي نشط، تحديث حالته
        if (globalPauseState !== isBotPaused) {
          isBotPaused = globalPauseState;
          console.log(`📢 تم ${isBotPaused ? 'إيقاف' : 'تشغيل'} البوت عن بُعد`);
          
          // إرسال إشعار إذا كان البوت متصلاً
          if (bot) {
            try {
              const statusMessage = isBotPaused 
                ? `⏸️ *تم إيقاف البوت عن بُعد من نظام التحكم المركزي*\n🌐 المنصة: ${platform}`
                : `▶️ *تم تشغيل البوت عن بُعد من نظام التحكم المركزي*\n🌐 المنصة: ${platform}`;
              
              bot.sendMessage(ADMIN_CHAT_ID, statusMessage, { parse_mode: 'Markdown' });
            } catch (e) {
              console.log('⚠️ لم أستطع إرسال إشعار التوقف المركزي:', e.message);
            }
          }
        }
      }
    });
    
    pauseListenerActive = true;
    console.log('✅ نظام التوقف المركزي مفعّل');
    
  } catch (error) {
    console.log('❌ خطأ في إعداد نظام التوقف المركزي:', error.message);
  }
}

// دالة تحديث حالة التوقف العالمية
async function updateGlobalPauseState(newState) {
  if (!firebaseInitialized) return false;
  
  try {
    const db = admin.database();
    await db.ref('bot_control/global_pause').set(newState);
    console.log(`✅ تم تحديث حالة التوقف العالمية إلى: ${newState ? 'متوقف' : 'نشط'}`);
    return true;
  } catch (error) {
    console.log('❌ خطأ في تحديث حالة التوقف العالمية:', error.message);
    return false;
  }
}

// دالة للحصول على الحالة الحالية العالمية
async function getGlobalPauseState() {
  if (!firebaseInitialized) return false;
  
  try {
    const db = admin.database();
    const snapshot = await db.ref('bot_control/global_pause').once('value');
    return snapshot.val() || false;
  } catch (error) {
    console.log('❌ خطأ في قراءة حالة التوقف العالمية:', error.message);
    return false;
  }
}

// دالة تهيئة Firebase مع إعادة المحاولة
async function initializeFirebase() {
  try {
    console.log('🔍 بدء تهيئة Firebase...');
    console.log(`🌐 المنصة: ${platform}`);
    
    // 🔍 فحص جميع متغيرات Firebase المتاحة
    console.log('🔍 فحص متغيرات البيئة المتاحة:');
    const allEnvVars = Object.keys(process.env);
    const firebaseEnvVars = allEnvVars.filter(v => 
      v.includes('FIREBASE') || v.includes('PRIVATE') || v.includes('PROJECT') || v.includes('CLIENT')
    );
    
    console.log('📋 متغيرات Firebase الموجودة:');
    firebaseEnvVars.forEach(varName => {
      if (!varName.includes('PRIVATE') && !varName.includes('KEY')) {
        console.log(`  ${varName}: ${process.env[varName]}`);
      } else {
        console.log(`  ${varName}: [مفتاح خاص - ${process.env[varName]?.length || 0} حرف]`);
      }
    });
    
    // التحقق من وجود جميع المتغيرات - دعم جميع التسميات الممكنة
    let privateKey = process.env.FIREBASE_PRIVATE_KEY || 
                     process.env.FIREBASEPRIVATEKEY ||
                     process.env.PRIVATE_KEY;
    
    let projectId = process.env.FIREBASE_PROJECT_ID || 
                    process.env.FIREBASEPROJECTID ||
                    process.env.PROJECT_ID;
    
    let clientEmail = process.env.FIREBASE_CLIENT_EMAIL || 
                      process.env.FIREBASECLIENTEMAIL ||
                      process.env.CLIENT_EMAIL;
    
    const missingVars = [];
    if (!privateKey) missingVars.push('المفتاح الخاص');
    if (!projectId) missingVars.push('معرف المشروع');
    if (!clientEmail) missingVars.push('البريد الإلكتروني');
    
    if (missingVars.length > 0) {
      console.log(`❌ متغيرات Firebase مفقودة: ${missingVars.join(', ')}`);
      throw new Error(`متغيرات مفقودة: ${missingVars.join(', ')}`);
    }
    
    console.log('✅ جميع متغيرات Firebase موجودة');
    console.log(`🏢 معرف المشروع: ${projectId}`);
    console.log(`📧 البريد الإلكتروني: ${clientEmail}`);
    console.log(`📏 طول المفتاح الأصلي: ${privateKey.length} حرف`);
    
    // معالجة المفتاح الخاص
    const processedPrivateKey = processFirebasePrivateKey(privateKey);
    
    if (!processedPrivateKey.includes('-----BEGIN PRIVATE KEY-----')) {
      console.log('⚠️ تحذير: تنسيق المفتاح قد لا يكون صحيحاً');
    }
    
    // محاولات متعددة للاتصال
    const connectionAttempts = [
      () => {
        console.log('🔄 المحاولة 1: التنسيق القياسي');
        return admin.initializeApp({
          credential: admin.credential.cert({
            project_id: projectId.trim(),
            private_key: processedPrivateKey,
            client_email: clientEmail.trim()
          }),
          databaseURL: 'https://manga-arabic-default-rtdb.europe-west1.firebasedatabase.app'
        });
      },
      
      () => {
        console.log('🔄 المحاولة 2: أسماء الحقول البديلة');
        return admin.initializeApp({
          credential: admin.credential.cert({
            projectId: projectId.trim(),
            privateKey: processedPrivateKey,
            clientEmail: clientEmail.trim()
          }),
          databaseURL: 'https://manga-arabic-default-rtdb.europe-west1.firebasedatabase.app'
        });
      }
    ];
    
    let success = false;
    let lastError = null;
    
    for (let i = 0; i < connectionAttempts.length; i++) {
      try {
        if (admin.apps.length > 0) {
          admin.app().delete();
          console.log('🗑️ تم حذف تطبيق Firebase السابق');
        }
        
        connectionAttempts[i]();
        
        const db = admin.database();
        await db.ref('.info/connected').once('value');
        
        success = true;
        console.log(`✅ نجحت المحاولة ${i + 1} للاتصال بـ Firebase`);
        break;
        
      } catch (attemptError) {
        lastError = attemptError;
        console.log(`❌ فشلت المحاولة ${i + 1}: ${attemptError.message}`);
      }
    }
    
    if (!success) {
      throw lastError || new Error('فشل جميع محاولات الاتصال بـ Firebase');
    }
    
    firebaseInitialized = true;
    console.log('🎉 تم الاتصال بـ Firebase بنجاح!');
    
    // قراءة حالة التوقف العالمية
    globalPauseState = await getGlobalPauseState();
    isBotPaused = globalPauseState;
    console.log(`📊 حالة التوقف العالمية الحالية: ${globalPauseState ? 'متوقف' : 'نشط'}`);
    
    // إعداد نظام التوقف المركزي
    setupCentralPauseControl();
    
    // اختبار إضافي: قراءة بيانات بسيطة
    try {
      const db = admin.database();
      const usersRef = db.ref('users');
      const snapshot = await usersRef.limitToFirst(1).once('value');
      console.log(`📊 اتصال قاعدة البيانات نشط - اختبار القراءة ناجح`);
      
      if (bot) {
        try {
          await bot.sendMessage(ADMIN_CHAT_ID, 
            `✅ *تم استعادة اتصال Firebase بنجاح على ${platform}*\n` +
            `📊 حالة النظام: ${globalPauseState ? '⏸️ متوقف' : '✅ نشط'}`, 
            { parse_mode: 'Markdown' }
          );
        } catch (e) {
          // تجاهل الخطأ إذا لم يكن البوت جاهزاً
        }
      }
    } catch (testError) {
      console.log('⚠️ تحذير: اتصال Firebase ناجح ولكن قراءة البيانات فشلت:', testError.message);
    }
    
    return true;
    
  } catch (error) {
    firebaseError = error;
    console.log('❌ خطأ في تهيئة Firebase:', error.message);
    
    if (bot) {
      try {
        await bot.sendMessage(ADMIN_CHAT_ID, 
          `❌ *خطأ في اتصال Firebase على ${platform}*\n\n` +
          `💥 الخطأ: ${error.message}\n` +
          `🔧 قم بتعيين متغيرات البيئة بشكل صحيح\n` +
          `🕒 الوقت: ${new Date().toLocaleString('ar-EG')}`,
          { parse_mode: 'Markdown' }
        );
      } catch (e) {
        // تجاهل الخطأ إذا لم يكن البوت جاهزاً
      }
    }
    
    return false;
  }
}

// 🛡️ كود الحماية الأساسي
const ALLOWED_NODES = ['users', 'comments', 'views', 'update', 'all_users'];

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

// 🔄 نظام النسخ الاحتياطي المحسن
async function createBackup() {
    if (isBotPaused || globalPauseState) {
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
        backupText += `🕒 وقت النسخ: ${stats.backupTime}\n`;
        backupText += `🌐 المنصة: ${platform}\n\n`;

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
                nodes: stats.nodesList,
                platform: platform
            },
            data: filteredData
        };

        const jsonData = JSON.stringify(fullBackup, null, 2);
        const fileName = `backup-${Date.now()}-${platform.toLowerCase()}.json`;
        
        await bot.sendDocument(BACKUP_CHANNEL_ID, Buffer.from(jsonData), {}, {
            filename: fileName,
            contentType: 'application/json'
        });

        console.log(`✅ تم إنشاء نسخة احتياطية لـ ${stats.totalNodes} عقدة على ${platform}`);
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
    if (isBotPaused || globalPauseState) {
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
    if (isBotPaused || globalPauseState) {
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
    if (isBotPaused || globalPauseState) {
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
        if (isBotPaused || globalPauseState) return;

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
        if (isBotPaused || globalPauseState) return;

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
    if (isBotPaused || globalPauseState) {
        console.log('⏸️ البوت متوقف مؤقتاً - تخطي إرسال التنبيه');
        return;
    }

    const adminChatId = process.env.ADMIN_CHAT_ID || ADMIN_CHAT_ID;
    
    if (adminChatId && bot) {
        bot.sendMessage(adminChatId, message).catch(error => {
            console.log('⚠️ خطأ في إرسال التنبيه: ' + error.message);
        });
    } else {
        console.log('⚠️ ADMIN_CHAT_ID غير محدد أو البوت غير متصل');
    }
}

// 🔍 دورة فحص التعليقات الحالية
async function scanExistingComments() {
    if (isBotPaused || globalPauseState) {
        console.log('⏸️ البوت متوقف مؤقتاً - تخطي فحص التعليقات');
        return 0;
    }

    if (!firebaseInitialized) return 0;
    
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
  if (isBotPaused || globalPauseState) {
    console.log('⏸️ البوت متوقف مؤقتاً - تخطي دورة الحماية');
    return { deletedNodes: 0, deletedUsers: 0 };
  }

  if (!firebaseInitialized) {
    console.log('⏳ Firebase غير مهيئ، تخطي الدورة');
    return { deletedNodes: 0, deletedUsers: 0 };
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

// 💬 إعداد أوامر التليجرام
function setupBotCommands() {
    if (!bot) {
        console.log('❌ البوت غير مهيئ لإعداد الأوامر');
        return;
    }

    console.log('⚙️ إعداد أوامر البوت...');

    // أمر /start
    bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      console.log('📩 /start من: ' + chatId);
      
      const botStatus = (isBotPaused || globalPauseState) ? '⏸️ متوقف مؤقتاً' : '✅ نشط';
      const firebaseStatus = firebaseInitialized ? '✅ متصل' : '❌ غير متصل';
      
      bot.sendMessage(chatId, `🛡️ *بوت حماية Firebase - ${botStatus}*

*معلومات النظام:*
🤖 البوت: ${botStatus}
🛡️ Firebase: ${firebaseStatus}
🌐 المنصة: ${platform}

${!firebaseInitialized ? '⚠️ *ملاحظة:* Firebase غير متصل، الحماية والنسخ الاحتياطي متوقفان' : '✅ جميع الأنظمة تعمل بشكل طبيعي'}

*أوامر التحكم:*
/pause - إيقاف مؤقت (جميع المنصات)
/resume - استئناف العمل (جميع المنصات)
/status - حالة النظام
/lastcrash - آخر توقف مسجل
/firebase_debug - تشخيص مشاكل Firebase
/platform_info - معلومات المنصة

*الأوامر الأخرى:*
/protect - تشغيل حماية فورية
/backup - نسخ احتياطي فوري
/scan_comments - فحص التعليقات الحالية
/badwords_list - عرض الكلمات الممنوعة
/test_filter [نص] - اختبار الفلتر
/test_links [نص] - اختبار كشف الروابط
/add_word [كلمة] - إضافة كلمة ممنوعة
/remove_word [كلمة] - إزالة كلمة ممنوعة

*💡 ملاحظة:* الأوامر /pause و /resume ستؤثر على جميع المنصات المتصلة`, { parse_mode: 'Markdown' });
    });

    // أمر /lastcrash
    bot.onText(/\/lastcrash/, (msg) => {
      const chatId = msg.chat.id;
      
      try {
        if (fs.existsSync('last_crash.txt')) {
          const content = fs.readFileSync('last_crash.txt', 'utf8');
          const lines = content.trim().split('\n');
          const lastCrash = lines.length > 0 ? lines[lines.length - 1] : 'لا توجد سجلات';
          
          bot.sendMessage(chatId, `📋 *آخر توقف مسجل:*\n\n${lastCrash}`, { parse_mode: 'Markdown' });
        } else {
          bot.sendMessage(chatId, '✅ لا توجد سجلات توقف حتى الآن');
        }
      } catch (error) {
        bot.sendMessage(chatId, '❌ خطأ في قراءة سجلات التوقف');
      }
    });

    // أمر /firebase_debug
    bot.onText(/\/firebase_debug/, async (msg) => {
      const chatId = msg.chat.id;
      
      let debugInfo = `*🔧 تشخيص مشاكل Firebase*\n\n`;
      debugInfo += `🌐 *المنصة:* ${platform}\n\n`;
      
      debugInfo += `*📋 متغيرات البيئة:*\n`;
      
      // التحقق من جميع تسميات متغيرات Firebase المحتملة
      const firebaseVars = [
        { name: 'FIREBASE_PRIVATE_KEY', alt: 'FIREBASEPRIVATEKEY' },
        { name: 'FIREBASE_PROJECT_ID', alt: 'FIREBASEPROJECTID' },
        { name: 'FIREBASE_CLIENT_EMAIL', alt: 'FIREBASECLIENTEMAIL' }
      ];
      
      for (const varInfo of firebaseVars) {
        const value = process.env[varInfo.name] || process.env[varInfo.alt];
        const exists = !!value;
        const varNameToShow = varInfo.name;
        
        debugInfo += `• ${varNameToShow}: ${exists ? '✅ موجود' : '❌ مفقود'}\n`;
        if (exists && !varInfo.name.includes('PRIVATE_KEY')) {
          debugInfo += `  📝 القيمة: ${value.trim()}\n`;
        } else if (exists) {
          debugInfo += `  📏 الطول: ${value.length} حرف\n`;
        }
        
        // إظهار التسمية البديلة إذا كانت مستخدمة
        if (!process.env[varInfo.name] && process.env[varInfo.alt]) {
          debugInfo += `  🔄 مستخدم التسمية: ${varInfo.alt}\n`;
        }
      }
      
      debugInfo += `\n*🔗 حالة الاتصال:*\n`;
      debugInfo += `• Firebase مهيئ: ${firebaseInitialized ? '✅ نعم' : '❌ لا'}\n`;
      
      if (firebaseError) {
        debugInfo += `• آخر خطأ: ${firebaseError.message}\n`;
      }
      
      // حالة التوقف العالمية
      debugInfo += `\n*⏸️ حالة التوقف العالمية:*\n`;
      debugInfo += `• حالة التوقف المحلية: ${isBotPaused ? '✅ متوقف' : '❌ نشط'}\n`;
      debugInfo += `• حالة التوقف العالمية: ${globalPauseState ? '✅ متوقف' : '❌ نشط'}\n`;
      debugInfo += `• نظام التوقف المركزي: ${pauseListenerActive ? '✅ مفعّل' : '❌ غير مفعّل'}\n`;
      
      // اختبار الاتصال الفوري
      debugInfo += `\n*🧪 اختبار الاتصال:*\n`;
      
      if (firebaseInitialized) {
        try {
          const db = admin.database();
          await db.ref('.info/connected').once('value');
          debugInfo += `• اختبار الاتصال: ✅ ناجح\n`;
          
          // قراءة حالة التوقف العالمية
          const pauseSnapshot = await db.ref('bot_control/global_pause').once('value');
          const globalPause = pauseSnapshot.val();
          debugInfo += `• قراءة حالة التوقف: ✅ ناجحة\n`;
          debugInfo += `• القيمة المخزنة: ${globalPause ? 'متوقف' : 'نشط'}\n`;
          
        } catch (testError) {
          debugInfo += `• اختبار الاتصال: ❌ فاشل\n`;
          debugInfo += `• الخطأ: ${testError.message}\n`;
        }
      } else {
        debugInfo += `• اختبار الاتصال: ❌ فاشل (Firebase غير مهيئ)\n`;
      }
      
      // الحصول على جميع متغيرات Firebase المتاحة
      debugInfo += `\n*📊 جميع متغيرات Firebase المتاحة:*\n`;
      const allEnvVars = Object.keys(process.env);
      const firebaseEnvVars = allEnvVars.filter(v => v.includes('FIREBASE'));
      
      if (firebaseEnvVars.length > 0) {
        firebaseEnvVars.forEach(varName => {
          if (!varName.includes('PRIVATE_KEY')) {
            debugInfo += `• ${varName}: ${process.env[varName].substring(0, 30)}...\n`;
          } else {
            debugInfo += `• ${varName}: [مفتاح خاص - ${process.env[varName].length} حرف]\n`;
          }
        });
      } else {
        debugInfo += `• ❌ لا توجد متغيرات Firebase\n`;
      }
      
      debugInfo += `\n*🔄 إعادة المحاولة:*\n`;
      debugInfo += `استخدم /reconnect_firebase لإعادة محاولة الاتصال`;
      
      bot.sendMessage(chatId, debugInfo, { parse_mode: 'Markdown' });
    });

    // أمر /reconnect_firebase
    bot.onText(/\/reconnect_firebase/, async (msg) => {
      const chatId = msg.chat.id;
      
      bot.sendMessage(chatId, '🔄 جاري إعادة الاتصال بـ Firebase...');
      
      const result = await initializeFirebase();
      
      if (result) {
        bot.sendMessage(chatId, 
          `✅ *تم إعادة الاتصال بـ Firebase بنجاح!*\n\n` +
          `🌐 المنصة: ${platform}\n` +
          `🛡️ الحماية الآن نشطة\n` +
          `💾 النسخ الاحتياطي جاهز\n` +
          `⏸️ حالة التوقف العالمية: ${globalPauseState ? 'متوقف' : 'نشط'}`,
          { parse_mode: 'Markdown' }
        );
      } else {
        bot.sendMessage(chatId, 
          `❌ *فشل إعادة الاتصال بـ Firebase*\n\n` +
          `💥 الخطأ: ${firebaseError ? firebaseError.message : 'غير معروف'}\n` +
          `🔧 استخدم /firebase_debug للمزيد من المعلومات`,
          { parse_mode: 'Markdown' }
        );
      }
    });

    // أمر /platform_info
    bot.onText(/\/platform_info/, (msg) => {
      const chatId = msg.chat.id;
      
      let platformInfo = `*🌐 معلومات المنصة*\n\n`;
      platformInfo += `• *المنصة:* ${platform}\n`;
      
      if (process.env.RAILWAY_STATIC_URL) {
        platformInfo += `• *الرابط:* https://${process.env.RAILWAY_STATIC_URL}\n`;
        platformInfo += `• *الخدمة:* Railway\n`;
      } else if (process.env.RENDER) {
        platformInfo += `• *الرابط:* https://team-manga-list.onrender.com\n`;
        platformInfo += `• *الخدمة:* Render\n`;
      } else {
        platformInfo += `• *النمط:* تطوير محلي\n`;
        platformInfo += `• *المنفذ:* ${PORT}\n`;
      }
      
      platformInfo += `\n*📊 إحصائيات:*\n`;
      platformInfo += `• عدد الزيارات: ${visitorCount}\n`;
      platformInfo += `• وقت التشغيل: ${Math.floor(process.uptime())} ثانية\n`;
      platformInfo += `• حالة Firebase: ${firebaseInitialized ? '✅ متصل' : '❌ غير متصل'}\n`;
      platformInfo += `• حالة البوت المحلية: ${isBotPaused ? '⏸️ متوقف' : '✅ نشط'}\n`;
      platformInfo += `• حالة التوقف العالمية: ${globalPauseState ? '⏸️ متوقف' : '✅ نشط'}\n`;
      
      platformInfo += `\n*🔗 روابط الخدمة:*\n`;
      platformInfo += `• الصفحة الرئيسية: /app\n`;
      platformInfo += `• فحص الصحة: /health\n`;
      platformInfo += `• Ping: /ping\n`;
      platformInfo += `• عدد الزوار: /visitors\n`;
      
      bot.sendMessage(chatId, platformInfo, { parse_mode: 'Markdown' });
    });

    // أمر /pause - يؤثر على جميع المنصات
    bot.onText(/\/pause/, async (msg) => {
      const chatId = msg.chat.id;
      
      if (!firebaseInitialized) {
        bot.sendMessage(chatId, '❌ Firebase غير متصل! لا يمكن تحديث الحالة العالمية');
        return;
      }
      
      bot.sendMessage(chatId, '⏸️ جاري إيقاف البوت على جميع المنصات...');
      
      const success = await updateGlobalPauseState(true);
      
      if (success) {
        isBotPaused = true;
        bot.sendMessage(chatId, 
          `⏸️ *تم إيقاف البوت على جميع المنصات*\n\n` +
          `🌐 المنصة الحالية: ${platform}\n` +
          '❌ الحماية متوقفة\n' +
          '❌ مراقبة التعليقات متوقفة\n' +
          '❌ النسخ الاحتياطي متوقف\n' +
          '❌ فحص المحتوى متوقف\n\n' +
          'استخدم /resume لاستئناف العمل', 
          { parse_mode: 'Markdown' }
        );
        
        // إرسال إشعار إلى جميع المسؤولين
        try {
          await bot.sendMessage(ADMIN_CHAT_ID,
            `⏸️ *تم إيقاف البوت على جميع المنصات*\n\n` +
            `👤 المستخدم: ${msg.from.first_name}\n` +
            `🌐 المنصة: ${platform}\n` +
            `🕒 الوقت: ${new Date().toLocaleString('ar-EG')}`,
            { parse_mode: 'Markdown' }
          );
        } catch (e) {
          console.log('⚠️ لم أستطع إرسال إشعار الإيقاف:', e.message);
        }
      } else {
        bot.sendMessage(chatId, '❌ فشل في تحديث حالة التوقف العالمية');
      }
    });

    // أمر /resume - يؤثر على جميع المنصات
    bot.onText(/\/resume/, async (msg) => {
      const chatId = msg.chat.id;
      
      if (!firebaseInitialized) {
        bot.sendMessage(chatId, '❌ Firebase غير متصل! لا يمكن تحديث الحالة العالمية');
        return;
      }
      
      bot.sendMessage(chatId, '▶️ جاري تشغيل البوت على جميع المنصات...');
      
      const success = await updateGlobalPauseState(false);
      
      if (success) {
        isBotPaused = false;
        bot.sendMessage(chatId, 
          `▶️ *تم تشغيل البوت على جميع المنصات*\n\n` +
          `🌐 المنصة الحالية: ${platform}\n` +
          `${firebaseInitialized ? '✅ الحماية نشطة' : '❌ Firebase غير متصل - الحماية متوقفة'}\n` +
          `${firebaseInitialized ? '✅ مراقبة التعليقات نشطة' : '❌ Firebase غير متصل - المراقبة متوقفة'}\n` +
          `${firebaseInitialized ? '✅ النسخ الاحتياطي نشط' : '❌ Firebase غير متصل - النسخ الاحتياطي متوقف'}\n` +
          `${firebaseInitialized ? '✅ فحص المحتوى نشط' : '❌ Firebase غير متصل - الفحص متوقف'}\n\n` +
          `${!firebaseInitialized ? '⚠️ استخدم /firebase_debug لفحص اتصال Firebase' : 'جميع الأنظمة تعمل بشكل طبيعي'}`, 
          { parse_mode: 'Markdown' }
        );
        
        // إرسال إشعار إلى جميع المسؤولين
        try {
          await bot.sendMessage(ADMIN_CHAT_ID,
            `▶️ *تم تشغيل البوت على جميع المنصات*\n\n` +
            `👤 المستخدم: ${msg.from.first_name}\n` +
            `🌐 المنصة: ${platform}\n` +
            `🕒 الوقت: ${new Date().toLocaleString('ar-EG')}`,
            { parse_mode: 'Markdown' }
          );
        } catch (e) {
          console.log('⚠️ لم أستطع إرسال إشعار التشغيل:', e.message);
        }
      } else {
        bot.sendMessage(chatId, '❌ فشل في تحديث حالة التوقف العالمية');
      }
    });

    // أمر /status
    bot.onText(/\/status/, async (msg) => {
      const chatId = msg.chat.id;
      const botStatus = (isBotPaused || globalPauseState) ? '⏸️ متوقف مؤقتاً' : '✅ نشط';
      
      let firebaseStatus = '❌ غير متصل';
      let firebaseDetails = '';
      
      if (firebaseInitialized) {
        try {
          const db = admin.database();
          await db.ref('.info/connected').once('value');
          firebaseStatus = '✅ متصل ونشط';
        } catch (error) {
          firebaseStatus = '⚠️ مهيئ لكن غير نشط';
          firebaseDetails = ` (خطأ: ${error.message})`;
        }
      }
      
      let crashStatus = '✅ لا توجد حوادث';
      if (fs.existsSync('last_crash.txt')) {
        const content = fs.readFileSync('last_crash.txt', 'utf8');
        const lines = content.trim().split('\n');
        if (lines.length > 0) {
          crashStatus = `⚠️ ${lines.length} حوادث مسجلة`;
        }
      }
      
      bot.sendMessage(chatId, 
        `📊 *حالة النظام*\n\n` +
        `🤖 حالة البوت: ${botStatus}\n` +
        `🛡️ حماية Firebase: ${firebaseStatus}${firebaseDetails}\n` +
        `🌐 المنصة: ${platform}\n` +
        `💥 سجلات التوقف: ${crashStatus}\n` +
        `⏰ وقت التشغيل: ${Math.floor(process.uptime())} ثانية\n` +
        `📅 آخر تحديث: ${new Date().toLocaleString('ar-EG')}\n` +
        `👥 عدد الزيارات: ${visitorCount}\n` +
        `⚡ سرعة الحماية: ${(isBotPaused || globalPauseState) ? 'متوقفة' : 'كل 5 ثواني'}\n` +
        `💾 النسخ الاحتياطي: ${((isBotPaused || globalPauseState) || !firebaseInitialized) ? 'متوقف' : 'نشط كل 24 ساعة'}\n` +
        `🔍 مراقبة التعليقات: ${((isBotPaused || globalPauseState) || !firebaseInitialized) ? 'متوقفة' : 'نشطة'}\n\n` +
        `${!firebaseInitialized ? '⚠️ *ملاحظة:* استخدم /firebase_debug لفحص اتصال Firebase' : '✅ النظام يعمل بشكل مثالي'}`,
        { parse_mode: 'Markdown' }
      );
    });

    // أمر /protect
    bot.onText(/\/protect/, async (msg) => {
      const chatId = msg.chat.id;
      
      if (isBotPaused || globalPauseState) {
        bot.sendMessage(chatId, '⏸️ البوت متوقف مؤقتاً - استخدم /resume أولا');
        return;
      }

      if (!firebaseInitialized) {
        bot.sendMessage(chatId, '❌ Firebase غير متصل! استخدم /firebase_debug للفحص');
        return;
      }
      
      bot.sendMessage(chatId, '🛡️ جاري تشغيل دورة حماية فورية...');
      
      const result = await protectionCycle();
      
      if (result.deletedNodes > 0 || result.deletedUsers > 0) {
        bot.sendMessage(chatId, `✅ *تمت الحماية الفورية!*

🗑️ العقد المحذوفة: ${result.deletedNodes}
👥 المستخدمين المحذوفين: ${result.deletedUsers}
⏰ الوقت: ${new Date().toLocaleTimeString('ar-EG')}
🌐 المنصة: ${platform}`, { parse_mode: 'Markdown' });
      } else {
        bot.sendMessage(chatId, '✅ لم يتم العثور على عقد أو مستخدمين للحذف. كل شيء نظيف!');
      }
    });

    // أمر /backup
    bot.onText(/\/backup/, async (msg) => {
      const chatId = msg.chat.id;
      
      if (isBotPaused || globalPauseState) {
        bot.sendMessage(chatId, '⏸️ البوت متوقف مؤقتاً - استخدم /resume أولا');
        return;
      }

      if (!firebaseInitialized) {
        bot.sendMessage(chatId, '❌ Firebase غير متصل! استخدم /firebase_debug للفحص');
        return;
      }
      
      bot.sendMessage(chatId, '💾 جاري إنشاء نسخة احتياطية فورية...');
      
      const success = await createBackup();
      
      if (success) {
        bot.sendMessage(chatId, `✅ *تم إنشاء النسخة الاحتياطية وإرسالها إلى القناة!*\n🌐 المنصة: ${platform}`, { parse_mode: 'Markdown' });
      } else {
        bot.sendMessage(chatId, '❌ فشل في إنشاء النسخة الاحتياطية. راجع السجلالت للتفاصيل.');
      }
    });

    // أمر /test
    bot.onText(/\/test/, (msg) => {
      const chatId = msg.chat.id;
      const botStatus = (isBotPaused || globalPauseState) ? '⏸️ متوقف مؤقتاً' : '✅ نشط';
      const firebaseStatus = firebaseInitialized ? '✅ متصل' : '❌ غير متصل';
      
      bot.sendMessage(chatId, 
        `*اختبار النظام:*\n\n` +
        `${(isBotPaused || globalPauseState) ? '⏸️ البوت متوقف مؤقتاً' : '✅ البوت يعمل بشكل طبيعي!'}\n` +
        `${firebaseInitialized ? '✅ Firebase متصل' : '❌ Firebase غير متصل'}\n` +
        `🌐 المنصة: ${platform}\n` +
        '🤖 جميع أوامر البوت جاهزة\n' +
        `${firebaseInitialized ? '💾 نظام النسخ الاحتياطي جاهز' : '❌ النسخ الاحتياطي غير متاح'}\n` +
        '💥 نظام الإنذار مفعل\n' +
        `⚡ سرعة الحماية: ${(isBotPaused || globalPauseState) ? 'متوقفة' : 'كل 5 ثواني'}\n` +
        `⏰ وقت التشغيل: ${Math.floor(process.uptime())} ثانية`
      );
    });

    // أمر /scan_comments
    bot.onText(/\/scan_comments/, async (msg) => {
      const chatId = msg.chat.id;
      
      if (isBotPaused || globalPauseState) {
        bot.sendMessage(chatId, '⏸️ البوت متوقف مؤقتاً - استخدم /resume أولا');
        return;
      }

      if (!firebaseInitialized) {
        bot.sendMessage(chatId, '❌ Firebase غير متصل! استخدم /firebase_debug للفحص');
        return;
      }
      
      bot.sendMessage(chatId, '🔍 جاري فحص جميع التعليقات والردود...');
      
      const deletedCount = await scanExistingComments();
      
      bot.sendMessage(chatId, `✅ اكتمل الفحص\nتم حذف ${deletedCount} محتوى محظور\n🌐 المنصة: ${platform}`);
    });

    // أمر /badwords_list
    bot.onText(/\/badwords_list/, (msg) => {
      const chatId = msg.chat.id;
      const wordsList = BAD_WORDS.join(', ');
      bot.sendMessage(chatId, `📋 *الكلمات الممنوعة:*\n\n${wordsList}\n🌐 المنصة: ${platform}`, { parse_mode: 'Markdown' });
    });

    // أمر /test_filter
    bot.onText(/\/test_filter (.+)/, (msg, match) => {
      const chatId = msg.chat.id;
      const text = match[1];
      
      const hasBadWords = containsBadWords(text);
      
      if (hasBadWords) {
        bot.sendMessage(chatId, `🚨 *تم اكتشاف كلمات مسيئة!*\n\nالنص: "${text}"\n\nسيتم حذف هذا النص تلقائياً.\n🌐 المنصة: ${platform}`, { parse_mode: 'Markdown' });
      } else {
        bot.sendMessage(chatId, `✅ *النص نظيف*\n\nالنص: "${text}"\n\nلا توجد كلمات مسيئة.\n🌐 المنصة: ${platform}`, { parse_mode: 'Markdown' });
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
      
      message += `\n🌐 المنصة: ${platform}`;
      
      bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    });

    // أمر /add_word
    bot.onText(/\/add_word (.+)/, (msg, match) => {
      const chatId = msg.chat.id;
      const word = match[1].trim();
      
      if (BAD_WORDS.includes(word)) {
        bot.sendMessage(chatId, `⚠️ الكلمة "${word}" موجودة بالفعل في القائمة.\n🌐 المنصة: ${platform}`);
      } else {
        BAD_WORDS.push(word);
        bot.sendMessage(chatId, `✅ تمت إضافة الكلمة "${word}" إلى القائمة الممنوعة.\n🌐 المنصة: ${platform}`);
        console.log(`✅ تمت إضافة كلمة جديدة: ${word}`);
      }
    });

    // أمر /remove_word
    bot.onText(/\/remove_word (.+)/, (msg, match) => {
      const chatId = msg.chat.id;
      const word = match[1].trim();
      
      const index = BAD_WORDS.indexOf(word);
      if (index === -1) {
        bot.sendMessage(chatId, `❌ الكلمة "${word}" غير موجودة في القائمة.\n🌐 المنصة: ${platform}`);
      } else {
        BAD_WORDS.splice(index, 1);
        bot.sendMessage(chatId, `✅ تمت إزالة الكلمة "${word}" من القائمة الممنوعة.\n🌐 المنصة: ${platform}`);
        console.log(`✅ تمت إزالة كلمة: ${word}`);
      }
    });

    // معالجة أخطاء البوت
    bot.on('polling_error', (error) => {
      console.log('🔴 خطأ في polling: ' + error.message);
      
      if (error.message.includes('409 Conflict')) {
        console.log('🔄 خطأ 409 - إعادة بدء البوت بعد 30 ثانية...');
        setTimeout(() => {
          startBotSafely();
        }, 30000);
      }
    });
}

// ⚡ التشغيل التلقائي كل 5 ثواني
console.log('⚡ تفعيل الحماية التلقائية كل 5 ثواني...');

function startProtectionCycle() {
  setTimeout(async () => {
    try {
      await protectionCycle();
    } catch (error) {
      console.log('❌ خطأ في دورة الحماية: ' + error.message);
    } finally {
      startProtectionCycle();
    }
  }, 5000);
}

// 🕒 نظام النسخ الاحتياطي التلقائي
console.log('💾 تفعيل النسخ الاحتياطي التلقائي كل 24 ساعة...');

let backupInterval;

function startBackupSchedule() {
  if (backupInterval) clearInterval(backupInterval);
  
  console.log(`⏰ جدول النسخ: كل ${BACKUP_INTERVAL / 1000 / 60 / 60} ساعة`);
  
  backupInterval = setInterval(() => {
    if (!(isBotPaused || globalPauseState) && firebaseInitialized) {
      console.log('🕒 وقت النسخ الدوري - بدء إنشاء النسخة...');
      createBackup();
    } else {
      console.log('⏸️ تأجيل النسخ - البوت متوقف أو Firebase غير متصل');
    }
  }, BACKUP_INTERVAL);
}

// 🎯 نظام Keep-Alive المحسّن
function keepServiceAlive() {
  console.log('🔧 تفعيل الحفاظ على الاستيقاظ...');
  
  const urls = platform === 'Railway' 
    ? `https://${process.env.RAILWAY_STATIC_URL}`
    : platform === 'Render'
    ? 'https://team-manga-list.onrender.com'
    : `http://localhost:${PORT}`;
  
  const pingUrls = [
    `${urls}/ping`,
    `${urls}/health`,
    `${urls}/visitors`,
    `${urls}/app`
  ];
  
  let urlIndex = 0;
  
  setInterval(() => {
    const url = pingUrls[urlIndex];
    const requestModule = url.startsWith('https') ? https : http;
    
    requestModule.get(url, (res) => {
      console.log(`🔄 Keep-Alive: ${url} - ${res.statusCode} - ${new Date().toLocaleTimeString('ar-EG')}`);
    }).on('error', (err) => {
      console.log(`⚠️ Keep-Alive فشل: ${url} - ${err.message}`);
    });
    
    urlIndex = (urlIndex + 1) % pingUrls.length;
    
  }, 3 * 60 * 1000); // كل 3 دقائق
}

// 🛑 إغلاق نظيف للبوت
function gracefulShutdown() {
  console.log('🛑 استلام إشارة إيقاف - إغلاق نظيف...');
  
  if (bot && bot.stopPolling) {
    bot.stopPolling();
    console.log('✅ تم إيقاف polling');
  }
  
  if (backupInterval) {
    clearInterval(backupInterval);
    console.log('✅ تم إوقف جدول النسخ الاحتياطي');
  }
  
  process.exit(0);
}

// تسجيل معالجات الإغلاق
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// 🚀 بدء جميع الخدمات
async function startAllServices() {
  console.log('🚀 بدء جميع الخدمات...');
  
  // 1. بدء الخادم أولاً
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('✅ خادم ويب يعمل على المنفذ: ' + PORT);
  });

  // 2. تهيئة Firebase
  console.log('🔗 محاولة تهيئة Firebase...');
  await initializeFirebase();
  
  if (!firebaseInitialized) {
    console.log('⚠️ تحذير: Firebase غير متصل، بعض الخدمات قد لا تعمل');
    
    // محاولة إعادة الاتصال كل 5 دقائق
    setInterval(async () => {
      console.log('🔄 إعادة محاولة الاتصال بـ Firebase...');
      await initializeFirebase();
    }, 5 * 60 * 1000);
  }

  // 3. بدء البوت بعد تأخير
  setTimeout(() => {
    startBotSafely();
  }, 10000); // 10 ثواني تأخير

  // 4. بدء دورة الحماية بعد 15 ثانية
  setTimeout(() => {
    startProtectionCycle();
  }, 15000);

  // 5. بدء مراقبة التعليقات بعد 20 ثانية
  setTimeout(() => {
    if (firebaseInitialized) {
      startCommentMonitoring();
      setTimeout(() => {
        scanExistingComments();
      }, 5000);
    }
  }, 20000);

  // 6. بدء النسخ الاحتياطي بعد 25 ثانية
  setTimeout(() => {
    if (firebaseInitialized && !(isBotPaused || globalPauseState)) {
      createBackup();
      startBackupSchedule();
    }
  }, 25000);

  // 7. بدء keep-alive بعد 30 ثانية
  setTimeout(() => {
    keepServiceAlive();
  }, 30000);
}

// بدء التشغيل
startAllServices();

console.log('✅ النظام جاهز للتشغيل!');
