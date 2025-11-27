const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');
const express = require('express');
const https = require('https');
const fs = require('fs');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

// طرق UptimeRobot
app.get('/', (req, res) => {
  res.json({ status: 'active', service: 'Firebase Bot with File Editor' });
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('✅ خادم ويب يعمل');
});

// البوت الأساسي
const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// تهيئة Firebase
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
  console.log('✅ تم الاتصال بـ Firebase');
} catch (error) {
  console.log('❌ خطأ في Firebase:', error.message);
}

// 🆕 **نظام إدارة الملفات من تليجرام**
const ALLOWED_FILES = ['bot.js', 'package.json', 'README.md'];

// 🆕 عرض قائمة الملفات القابلة للتعديل
bot.onText(/\/edit_files/, (msg) => {
  const chatId = msg.chat.id;
  
  const keyboard = {
    inline_keyboard: ALLOWED_FILES.map(file => [
      { text: `📄 ${file}`, callback_data: `edit_${file}` }
    ])
  };
  
  bot.sendMessage(chatId, '📁 اختر الملف الذي تريد تعديله:', {
    reply_markup: keyboard
  });
});

// 🆕 عرض محتوى الملف للتعديل
bot.on('callback_query', async (callbackQuery) => {
  const msg = callbackQuery.message;
  const chatId = msg.chat.id;
  const data = callbackQuery.data;

  if (data.startsWith('edit_')) {
    const fileName = data.replace('edit_', '');
    
    if (!ALLOWED_FILES.includes(fileName)) {
      bot.answerCallbackQuery(callbackQuery.id, { text: '❌ ملف غير مسموح' });
      return;
    }

    try {
      const fileContent = fs.readFileSync(fileName, 'utf8');
      
      // تقطيع المحتوى إذا كان طويلاً
      if (fileContent.length > 4000) {
        const truncatedContent = fileContent.substring(0, 4000) + '\n\n... [المحتوى أطول من 4000 حرف]';
        bot.sendMessage(chatId, `📄 محتوى ${fileName}:\n\n\`\`\`javascript\n${truncatedContent}\n\`\`\``, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '✏️ تعديل هذا الملف', callback_data: `confirmedit_${fileName}` }],
              [{ text: '📋 رؤية المحتوى الكامل', callback_data: `fullcontent_${fileName}` }]
            ]
          }
        });
      } else {
        bot.sendMessage(chatId, `📄 محتوى ${fileName}:\n\n\`\`\`javascript\n${fileContent}\n\`\`\``, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '✏️ تعديل هذا الملف', callback_data: `confirmedit_${fileName}` }]
            ]
          }
        });
      }
      
      bot.answerCallbackQuery(callbackQuery.id, { text: '✅ جاري تحميل الملف' });
    } catch (error) {
      bot.answerCallbackQuery(callbackQuery.id, { text: '❌ خطأ في قراءة الملف' });
      bot.sendMessage(chatId, `❌ خطأ في قراءة الملف ${fileName}: ${error.message}`);
    }
  }

  // 🆕 تأكيد التعديل
  if (data.startsWith('confirmedit_')) {
    const fileName = data.replace('confirmedit_', '');
    
    // تخزين حالة التعديل
    userEditState[chatId] = { file: fileName, step: 'waiting_content' };
    
    bot.sendMessage(chatId, `✏️ الآن أرسل المحتوى الجديد لـ ${fileName}:\n\n• استخدم \\\`\\\`\\\`javascript في البداية\n• واستخدم \\\`\\\`\\\` في النهاية\n• أو أرسل النص مباشرة`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '❌ إلغاء التعديل', callback_data: 'cancel_edit' }]
        ]
      }
    });
    
    bot.answerCallbackQuery(callbackQuery.id, { text: '✏️ جاهز لتلقي المحتوى' });
  }

  // 🆕 إلغاء التعديل
  if (data === 'cancel_edit') {
    delete userEditState[chatId];
    bot.editMessageText('❌ تم إلغاء التعديل', {
      chat_id: chatId,
      message_id: msg.message_id
    });
    bot.answerCallbackQuery(callbackQuery.id, { text: 'تم الإلغاء' });
  }

  // 🆕 رؤية المحتوى الكامل
  if (data.startsWith('fullcontent_')) {
    const fileName = data.replace('fullcontent_', '');
    
    try {
      const fileContent = fs.readFileSync(fileName, 'utf8');
      
      // إرسال المحتوى كملف نصي
      bot.sendDocument(chatId, Buffer.from(fileContent), {}, {
        filename: fileName,
        contentType: 'text/plain'
      });
      
      bot.answerCallbackQuery(callbackQuery.id, { text: '✅ تم إرسال الملف' });
    } catch (error) {
      bot.answerCallbackQuery(callbackQuery.id, { text: '❌ خطأ في إرسال الملف' });
    }
  }
});

// 🆕 تخزين حالة المستخدمين أثناء التعديل
const userEditState = {};

// 🆕 استقبال المحتوى الجديد من المستخدم
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  
  if (!userEditState[chatId] || userEditState[chatId].step !== 'waiting_content') {
    return;
  }

  const fileInfo = userEditState[chatId];
  delete userEditState[chatId];

  try {
    let content = text;
    
    // تنظيف المحتوى إذا كان في كود block
    if (text.includes('```')) {
      content = text.replace(/```[a-z]*\n/, '').replace(/\n```$/, '');
    }

    // حفظ المحتوى الجديد
    fs.writeFileSync(fileInfo.file, content, 'utf8');
    
    bot.sendMessage(chatId, `✅ تم تحديث الملف ${fileInfo.file} بنجاح!`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 إعادة تشغيل البوت', callback_data: 'restart_bot' }],
          [{ text: '📁 تعديل ملف آخر', callback_data: 'edit_another' }]
        ]
      }
    });
    
    console.log(`✅ تم تعديل الملف ${fileInfo.file} من قبل ${chatId}`);
    
  } catch (error) {
    bot.sendMessage(chatId, `❌ خطأ في حفظ الملف: ${error.message}`);
  }
});

// 🆕 إعادة تشغيل البوت
bot.on('callback_query', (callbackQuery) => {
  const msg = callbackQuery.message;
  const chatId = msg.chat.id;
  const data = callbackQuery.data;

  if (data === 'restart_bot') {
    bot.editMessageText('🔄 جاري إعادة تشغيل البوت...', {
      chat_id: chatId,
      message_id: msg.message_id
    });
    
    setTimeout(() => {
      process.exit(0); // إعادة التشغيل
    }, 2000);
    
    bot.answerCallbackQuery(callbackQuery.id, { text: 'جاري إعادة التشغيل' });
  }

  if (data === 'edit_another') {
    bot.editMessageText('📁 اختر الملف الذي تريد تعديله:', {
      chat_id: chatId,
      message_id: msg.message_id,
      reply_markup: {
        inline_keyboard: ALLOWED_FILES.map(file => [
          { text: `📄 ${file}`, callback_data: `edit_${file}` }
        ])
      }
    });
    bot.answerCallbackQuery(callbackQuery.id, { text: 'اختر ملفاً' });
  }
});

// 🆕 أمر لإنشاء ملفات جديدة
bot.onText(/\/create_file (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const fileName = match[1];
  
  // التحقق من صلاحية اسم الملف
  if (!fileName.match(/^[a-zA-Z0-9_\-\.]+$/)) {
    bot.sendMessage(chatId, '❌ اسم ملف غير صالح. استخدم أحرف إنجليزية وأرقام فقط.');
    return;
  }
  
  if (fs.existsSync(fileName)) {
    bot.sendMessage(chatId, `❌ الملف ${fileName} موجود بالفعل. استخدم /edit_files لتعديله.`);
    return;
  }
  
  try {
    fs.writeFileSync(fileName, '// ملف جديد\n// تم إنشاؤه من تليجرام\n', 'utf8');
    ALLOWED_FILES.push(fileName);
    
    bot.sendMessage(chatId, `✅ تم إنشاء الملف ${fileName} بنجاح!`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '✏️ تعديل الملف الجديد', callback_data: `edit_${fileName}` }]
        ]
      }
    });
  } catch (error) {
    bot.sendMessage(chatId, `❌ خطأ في إنشاء الملف: ${error.message}`);
  }
});

// 🆕 أمر لحذف الملفات
bot.onText(/\/delete_file (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const fileName = match[1];
  
  if (!ALLOWED_FILES.includes(fileName)) {
    bot.sendMessage(chatId, '❌ ملف غير مسموح بحذفه أو غير موجود.');
    return;
  }
  
  if (fileName === 'bot.js' || fileName === 'package.json') {
    bot.sendMessage(chatId, '❌ لا يمكن حذف الملفات الأساسية للبوت.');
    return;
  }
  
  try {
    fs.unlinkSync(fileName);
    const index = ALLOWED_FILES.indexOf(fileName);
    if (index > -1) {
      ALLOWED_FILES.splice(index, 1);
    }
    
    bot.sendMessage(chatId, `✅ تم حذف الملف ${fileName} بنجاح!`);
  } catch (error) {
    bot.sendMessage(chatId, `❌ خطأ في حذف الملف: ${error.message}`);
  }
});

// 🆕 أمر لعرض معلومات النظام
bot.onText(/\/file_system/, (msg) => {
  const chatId = msg.chat.id;
  
  let fileInfo = '📁 **ملفات النظام:**\n\n';
  
  ALLOWED_FILES.forEach(file => {
    try {
      const stats = fs.statSync(file);
      const size = (stats.size / 1024).toFixed(2);
      fileInfo += `📄 ${file} - ${size} KB\n`;
    } catch (error) {
      fileInfo += `❌ ${file} - خطأ في القراءة\n`;
    }
  });
  
  fileInfo += '\n💡 **الأوامر المتاحة:**';
  fileInfo += '\n/edit_files - تعديل الملفات';
  fileInfo += '\n/create_file <اسم> - إنشاء ملف جديد';
  fileInfo += '\n/delete_file <اسم> - حذف ملف';
  fileInfo += '\n/file_system - معلومات النظام';
  
  bot.sendMessage(chatId, fileInfo, { parse_mode: 'Markdown' });
});

// كود الحماية الأساسي (ابقى كما هو)
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

// الأوامر الأساسية (ابقى كما هي)
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, `🛡️ **بوت حماية Firebase مع محرر الملفات**

✅ الحماية التلقائية: نشطة
📁 محرر الملفات: مفعل
🌐 UptimeRobot: نشط

**أوامر جديدة:**
/edit_files - تعديل الملفات
/create_file - إنشاء ملف جديد  
/delete_file - حذف ملف
/file_system - معلومات النظام

**أوامر الحماية:**
/protect - حماية فورية
/status - حالة النظام`, { parse_mode: 'Markdown' });
});

bot.onText(/\/protect/, (msg) => {
  bot.sendMessage(msg.chat.id, '🛡️ جاري التشغيل...');
  protectionCycle().then(() => {
    bot.sendMessage(msg.chat.id, '✅ تمت الحماية!');
  });
});

bot.onText(/\/status/, (msg) => {
  bot.sendMessage(msg.chat.id, `🟢 **حالة النظام:**

• البوت: نشط
• الملفات: ${ALLOWED_FILES.length} ملف متاح
• الوقت: ${new Date().toLocaleTimeString('ar-EG')}
• Uptime: ${Math.floor(process.uptime())} ثانية`, { parse_mode: 'Markdown' });
});

// التشغيل التلقائي
setInterval(protectionCycle, 30000);
setTimeout(protectionCycle, 5000);

// الحفاظ على الاستيقاظ
function keepAlive() {
  setInterval(() => {
    https.get('https://team-manga-list.onrender.com/ping', () => {
      console.log('🔄 حافظ على الاستيقاظ');
    });
  }, 4 * 60 * 1000);
}
setTimeout(keepAlive, 30000);

console.log('🚀 البوت يعمل مع محرر الملفات!');
