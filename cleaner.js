const admin = require('firebase-admin');

// التهيئة من متغيرات البيئة
const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://manga-arabic-default-rtdb.europe-west1.firebasedatabase.app"
});

const db = admin.database();
const auth = admin.auth();

const ALLOWED_NODES = ['users', 'comments', 'views', 'update', 'info'];

async function cleanDatabase() {
  console.log(`🔍 بدء دورة فحص النظام: ${new Date().toLocaleString('ar-EG')}`);

  try {
    // 1. تنظيف العقد غير المسموح بها
    const snapshot = await db.ref('/').once('value');
    const data = snapshot.val();
    
    if (data) {
      for (const key in data) {
        if (!ALLOWED_NODES.includes(key)) {
          console.log(`🗑️ جاري حذف العقدة الغريبة: ${key}`);
          await db.ref(key).remove();
        }
      }
    }

    // 2. تنظيف المستخدمين الوهميين
    const dbUsersSnap = await db.ref('users').once('value');
    const dbUsers = dbUsersSnap.val() || {};
    const allowedUids = Object.keys(dbUsers);

    let nextPageToken;
    do {
      const listUsersResult = await auth.listUsers(1000, nextPageToken);
      const authUsers = listUsersResult.users;
      nextPageToken = listUsersResult.pageToken;

      for (const user of authUsers) {
        if (!allowedUids.includes(user.uid)) {
          console.log(`🚫 حذف مستخدم غير مسجل في القاعدة: ${user.email || user.uid}`);
          await auth.deleteUser(user.uid).catch((error) => {
            console.error(`⚠️ فشل حذف المستخدم ${user.uid}:`, error.message);
          });
        }
      }
    } while (nextPageToken);

    console.log("✅ الدورة مكتملة. النظام نظيف.");
  } catch (error) {
    console.error("⚠️ حدث خطأ أثناء التنظيف:", error.message);
  }
}

// تشغيل الوظيفة
cleanDatabase();
