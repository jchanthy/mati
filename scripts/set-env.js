const fs = require('fs');
const path = require('path');

const envDir = path.resolve(__dirname, '../src/environments');
const targetPath = path.join(envDir, 'environment.ts');

if (!fs.existsSync(envDir)) {
  fs.mkdirSync(envDir, { recursive: true });
}

const hasCustomEnv = !!(process.env.FIREBASE_API_KEY || process.env.FIREBASE_PROJECT_ID);

// If environment.ts does not exist, or custom environment variables are provided on Vercel / CI
if (!fs.existsSync(targetPath) || hasCustomEnv) {
  const apiKey = process.env.FIREBASE_API_KEY || 'AIzaSyAK0Hd8sD5Qtnj-kbZruuwa6AnjOmS2miE';
  const authDomain = process.env.FIREBASE_AUTH_DOMAIN || 'mati-f31f7.firebaseapp.com';
  const projectId = process.env.FIREBASE_PROJECT_ID || 'mati-f31f7';
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || 'mati-f31f7.firebasestorage.app';
  const messagingSenderId = process.env.FIREBASE_MESSAGING_SENDER_ID || '1074170838948';
  const appId = process.env.FIREBASE_APP_ID || '1:1074170838948:web:9acef703ed95f8cc040b31';

  const envContent = `export const environment = {
  production: true,
  firebase: {
    apiKey: '${apiKey}',
    authDomain: '${authDomain}',
    projectId: '${projectId}',
    storageBucket: '${storageBucket}',
    messagingSenderId: '${messagingSenderId}',
    appId: '${appId}'
  }
};
`;

  fs.writeFileSync(targetPath, envContent, 'utf-8');
  console.log('[scripts/set-env.js] Successfully prepared src/environments/environment.ts for build.');
} else {
  console.log('[scripts/set-env.js] Existing src/environments/environment.ts detected.');
}
