const admin = require('firebase-admin');

// نفس الكود السابق ولكن باستخدام environment variables
const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://manga-arabic-default-rtdb.europe-west1.firebasedatabase.app"
});

const db = admin.database();
const auth = admin.auth();
const ALLOWED_NODES = ['users', 'comments', 'views', 'update', 'info'];

async function cleanDatabase() {
  console.log('🔄 بدء دورة التنظيف...');
  
  try {
    let nodesDeleted = 0;
    let usersDeleted = 0;

    const snapshot = await db.ref('/').once('value');
    const data = snapshot.val();
    
    if (data) {
      for (const key in data) {
        if (!ALLOWED_NODES.includes(key)) {
          console.log(`🗑️ حذف العقدة: ${key}`);
          await db.ref(key).remove();
          nodesDeleted++;
        }
      }
    }

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
          console.log(`🚫 حذف مستخدم: ${user.email || user.uid}`);
          await auth.deleteUser(user.uid).catch((error) => {
            console.error(`⚠️ خطأ في الحذف: ${error.message}`);
          });
          usersDeleted++;
        }
      }
    } while (nextPageToken);

    console.log(`✅ اكتملت الدورة: ${nodesDeleted} عقدة, ${usersDeleted} مستخدم`);
    return true;
    
  } catch (error) {
    console.error('❌ خطأ:', error);
    return false;
  }
}

// التشغيل
cleanDatabase().then(success => {
  process.exit(success ? 0 : 1);
});
