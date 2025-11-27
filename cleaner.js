const admin = require('firebase-admin');

console.log('🚀 بدء تشغيل بوت التنظيف...');

try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://manga-arabic-default-rtdb.europe-west1.firebasedatabase.app"
  });

  const db = admin.database();
  const auth = admin.auth();

  const ALLOWED_NODES = ['users', 'comments', 'views', 'update', 'info'];

  async function cleanDatabase() {
    const startTime = new Date();
    console.log(`🔍 بدء دورة التنظيف: ${startTime.toLocaleString('ar-EG')}`);
    
    let totalDeleted = 0;

    try {
      // 1. تنظيف العقد غير المسموح بها
      const snapshot = await db.ref('/').once('value');
      const data = snapshot.val();
      
      if (data) {
        for (const key in data) {
          if (!ALLOWED_NODES.includes(key)) {
            console.log(`🗑️ حذف العقدة: ${key}`);
            await db.ref(key).remove();
            totalDeleted++;
          }
        }
      }

      // 2. تنظيف المستخدمين الوهميين
      const dbUsersSnap = await db.ref('users').once('value');
      const dbUsers = dbUsersSnap.val() || {};
      const allowedUids = Object.keys(dbUsers);

      let authDeletedCount = 0;
      let nextPageToken;
      
      do {
        const listUsersResult = await auth.listUsers(1000, nextPageToken);
        const authUsers = listUsersResult.users;
        nextPageToken = listUsersResult.pageToken;

        for (const user of authUsers) {
          if (!allowedUids.includes(user.uid)) {
            console.log(`🚫 حذف مستخدم: ${user.email || user.uid}`);
            await auth.deleteUser(user.uid).catch((error) => {
              console.error(`⚠️ خطأ في الحذف: ${error.message}`);
            });
            authDeletedCount++;
            totalDeleted++;
          }
        }
      } while (nextPageToken);

      const endTime = new Date();
      const duration = (endTime - startTime) / 1000;
      
      console.log(`📊 إحصائيات التنظيف:`);
      console.log(`   - العقد المحذوفة: ${totalDeleted - authDeletedCount}`);
      console.log(`   - المستخدمين المحذوفين: ${authDeletedCount}`);
      console.log(`   - الإجمالي: ${totalDeleted}`);
      console.log(`   - المدة: ${duration} ثانية`);
      console.log(`🎉 اكتملت دورة التنظيف بنجاح!`);
      console.log(`⏰ الدورة القادمة: بعد دقيقة`);

    } catch (error) {
      console.error("❌ خطأ أثناء التنظيف:", error.message);
    }
  }

  // تشغيل وظيفة التنظيف
  await cleanDatabase();
  
} catch (error) {
  console.error('💥 خطأ فادح:', error.message);
  process.exit(1);
}
