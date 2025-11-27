const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');
const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// طرق UptimeRobot
app.get('/', (req, res) => {
  res.json({ status: 'active', service: 'Firebase Bot with Fixed File Editor' });
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

// 🛠️ **الإصلاح: نظام إدارة الملفات المصحح**
const ALLOWED_FILES = ['bot.js', 'package.json', 'README.md'];

// 🛠️ **الإصلاح: تخزين حالة المستخدمين بشكل آمن**
const userEditState = new Map();

// 🛠️ **الإصلاح: أمر عرض الملفات بشكل صحيح**
bot.onText(/\/edit_files/, (msg) => {
  const chatId = msg.chat.id;
  console.log(`📁 طلب تعديل الملفات من: ${chatId}`);
  
  const keyboard = {
    inline_keyboard: ALLOWED_FILES.map(file => [
      { text: `📄 ${file}`, callback_data: `edit_${file}` }
    ])
  };
  
  bot.sendMessage(chatId, '📁 اختر الملف الذي تريد تعديله:', {
    reply_markup: keyboard
  });
});

// 🛠️ **الإصلاح: معالجة الـ callback بشكل صحيح**
bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const data = callbackQuery.data;

  console.log(`🔘 ضغط على: ${data} من: ${chatId}`);

  try {
    if (data.startsWith('edit_')) {
      const fileName = data.replace('edit_', '');
      
      if (!ALLOWED_FILES.includes(fileName)) {
        await bot.answerCallbackQuery(callbackQuery.id, { text: '❌ ملف غير مسموح' });
        return;
      }

      // 🛠️ **الإصلاح: قراءة الملف من المسار الصحيح**
      const filePath = path.join(__dirname, fileName);
      console.log(`📖 جاري قراءة الملف: ${filePath}`);
      
      if (!fs.existsSync(filePath)) {
        await bot.answerCallbackQuery(callbackQuery.id, { text: '❌ الملف غير موجود' });
        await bot.sendMessage(chatId, `❌ الملف ${fileName} غير موجود في السيرفر.`);
        return;
      }

      const fileContent = fs.readFileSync(filePath, 'utf8');
      console.log(`✅ تم قراءة الملف ${fileName}، الطول: ${fileContent.length} حرف`);

      // تقطيع المحتوى إذا كان طويلاً
      let displayContent = fileContent;
      if (fileContent.length > 3000) {
        displayContent = fileContent.substring(0, 3000) + '\n\n... [المحتوى أطول من 3000 حرف]';
      }

      await bot.editMessageText(`📄 *محتوى ${fileName}:*\n\n\`\`\`javascript\n${displayContent}\n\`\`\``, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '✏️ تعديل هذا الملف', callback_data: `confirmedit_${fileName}` }],
            [{ text: '📋 رؤية المحتوى الكامل', callback_data: `fullcontent_${fileName}` }],
            [{ text: '📁 رجوع للقائمة', callback_data: 'back_to_list' }]
          ]
        }
      });

      await bot.answerCallbackQuery(callbackQuery.id, { text: '✅ تم تحميل الملف' });
    }

    // 🛠️ **الإصلاح: تأكيد التعديل**
    else if (data.startsWith('confirmedit_')) {
      const fileName = data.replace('confirmedit_', '');
      
      userEditState.set(chatId, { 
        file: fileName, 
        step: 'waiting_content',
        messageId: messageId 
      });

      await bot.editMessageText(`✏️ *التعديل: ${fileName}*\n\nالآن أرسل المحتوى الجديد للملف:\n\n• يمكنك إرسال الكود مع \\\`\\\`\\\`javascript أو بدونه\n• استخدم /cancel للإلغاء`, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '❌ إلغاء التعديل', callback_data: 'cancel_edit' }]
          ]
        }
      });

      await bot.answerCallbackQuery(callbackQuery.id, { text: '✏️ جاهز لتلقي المحتوى' });
    }

    // 🛠️ **الإصلاح: إلغاء التعديل**
    else if (data === 'cancel_edit') {
      userEditState.delete(chatId);
      await bot.editMessageText('❌ تم إلغاء التعديل', {
        chat_id: chatId,
        message_id: messageId
      });
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'تم الإلغاء' });
    }

    // 🛠️ **الإصلاح: رؤية المحتوى الكامل**
    else if (data.startsWith('fullcontent_')) {
      const fileName = data.replace('fullcontent_', '');
      const filePath = path.join(__dirname, fileName);
      
      try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        
        // إرسال المحتوى كملف نصي
        await bot.sendDocument(chatId, Buffer.from(fileContent, 'utf8'), {
          filename: fileName,
          contentType: 'text/plain'
        });
        
        await bot.answerCallbackQuery(callbackQuery.id, { text: '✅ تم إرسال الملف' });
      } catch (error) {
        await bot.answerCallbackQuery(callbackQuery.id, { text: '❌ خطأ في إرسال الملف' });
      }
    }

    // 🛠️ **الإصلاح: الرجوع للقائمة**
    else if (data === 'back_to_list') {
      await bot.editMessageText('📁 اختر الملف الذي تريد تعديله:', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: ALLOWED_FILES.map(file => [
            { text: `📄 ${file}`, callback_data: `edit_${file}` }
          ])
        }
      });
      await bot.answerCallbackQuery(callbackQuery.id, { text: '📁 قائمة الملفات' });
    }

    // 🛠️ **الإصلاح: إعادة تشغيل البوت**
    else if (data === 'restart_bot') {
      await bot.editMessageText('🔄 جاري إعادة تشغيل البوت...', {
        chat_id: chatId,
        message_id: messageId
      });
      
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'جاري إعادة التشغيل' });
      
      setTimeout(() => {
        process.exit(0);
      }, 2000);
    }

  } catch (error) {
    console.log('❌ خطأ في معالجة الزر:', error);
    await bot.answerCallbackQuery(callbackQuery.id, { text: '❌ حدث خطأ' });
  }
});

// 🛠️ **الإصلاح: استقبال المحتوى الجديد بشكل صحيح**
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  // تجاهل الأوامر الأخرى
  if (text && text.startsWith('/')) {
    return;
  }

  if (userEditState.has(chatId) && userEditState.get(chatId).step === 'waiting_content') {
    const fileInfo = userEditState.get(chatId);
    userEditState.delete(chatId);

    try {
      let content = text;
      
      // تنظيف المحتوى إذا كان في كود block
      if (text.includes('```')) {
        const match = text.match(/```(?:javascript)?\n?([\s\S]*?)\n?```/);
        if (match && match[1]) {
          content = match[1];
        } else {
          content = text.replace(/```/g, '');
        }
      }

      // 🛠️ **الإصلاح: حفظ الملف في المسار الصحيح**
      const filePath = path.join(__dirname, fileInfo.file);
      fs.writeFileSync(filePath, content, 'utf8');
      
      console.log(`✅ تم تحديث الملف ${fileInfo.file} من قبل ${chatId}`);

      await bot.sendMessage(chatId, `✅ *تم تحديث الملف ${fileInfo.file} بنجاح!*\n\nسيتم تطبيق التغييرات بعد إعادة التشغيل.`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 إعادة تشغيل البوت الآن', callback_data: 'restart_bot' }],
            [{ text: '📁 تعديل ملف آخر', callback_data: 'back_to_list' }]
          ]
        }
      });
      
    } catch (error) {
      console.log('❌ خطأ في حفظ الملف:', error);
      await bot.sendMessage(chatId, `❌ خطأ في حفظ الملف: ${error.message}`);
    }
  }
});

// أمر الإلغاء
bot.onText(/\/cancel/, (msg) => {
  const chatId = msg.chat.id;
  if (userEditState.has(chatId)) {
    userEditState.delete(chatId);
    bot.sendMessage(chatId, '❌ تم إلغاء العملية الحالية.');
  }
});

// الأوامر الإضافية (متبقية كما هي)
bot.onText(/\/create_file (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const fileName = match[1];
  
  if (!fileName.match(/^[a-zA-Z0-9_\-\.]+$/)) {
    bot.sendMessage(chatId, '❌ اسم ملف غير صالح. استخدم أحرف إنجليزية وأرقام فقط.');
    return;
  }
  
  const filePath = path.join(__dirname, fileName);
  if (fs.existsSync(filePath)) {
    bot.sendMessage(chatId, `❌ الملف ${fileName} موجود بالفعل. استخدم /edit_files لتعديله.`);
    return;
  }
  
  try {
    fs.writeFileSync(filePath, '// ملف جديد\n// تم إنشاؤه من تليجرام\n', 'utf8');
    if (!ALLOWED_FILES.includes(fileName)) {
      ALLOWED_FILES.push(fileName);
    }
    
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

bot.onText(/\/file_system/, (msg) => {
  const chatId = msg.chat.id;
  
  let fileInfo = '📁 **ملفات النظام:**\n\n';
  
  ALLOWED_FILES.forEach(file => {
    const filePath = path.join(__dirname, file);
    try {
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        const size = (stats.size / 1024).toFixed(2);
        fileInfo += `📄 ${file} - ${size} KB\n`;
      } else {
        fileInfo += `❌ ${file} - غير موجود\n`;
      }
    } catch (error) {
      fileInfo += `❌ ${file} - خطأ في القراءة\n`;
    }
  });
  
  bot.sendMessage(chatId, fileInfo, { parse_mode: 'Markdown' });
});

// كود الحماية الأساسي (يبقى كما هو)
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

// الأوامر الأساسية
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, `🛡️ **بوت حماية Firebase مع محرر الملفات المصحح**

✅ الحماية التلقائية: نشطة  
📁 محرر الملفات: مفعل ومصحح
🌐 UptimeRobot: نشط

**أوامر الملفات:**
/edit_files - تعديل الملفات
/create_file - إنشاء ملف جديد
/file_system - معلومات النظام
/cancel - إلغاء العملية

**استخدم /edit_files للبدء!**`, { parse_mode: 'Markdown' });
});

// باقي الأوامر والحماية...
bot.onText(/\/protect/, (msg) => {
  bot.sendMessage(msg.chat.id, '🛡️ جاري التشغيل...');
  protectionCycle().then(() => {
    bot.sendMessage(msg.chat.id, '✅ تمت الحماية!');
  });
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

console.log('🚀 البوت يعمل مع محرر الملفات المصحح!');
