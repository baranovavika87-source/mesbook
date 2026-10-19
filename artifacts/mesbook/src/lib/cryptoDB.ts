const DB_NAME = 'MesoSecureDB';
const DB_VERSION = 1;

// Инициализация локальной базы данных
const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e: any) => {
      const db = e.target.result;
      // Хранилище для мастер-ключа
      if (!db.objectStoreNames.contains('keys')) db.createObjectStore('keys');
      // Хранилище для зашифрованных сообщений
      if (!db.objectStoreNames.contains('data')) db.createObjectStore('data');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Получение или генерация уникального ключа шифрования для устройства
const getDbKey = async (db: IDBDatabase): Promise<CryptoKey> => {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('keys', 'readonly');
    const req = tx.objectStore('keys').get('masterKey');
    
    req.onsuccess = async () => {
      if (req.result) {
        resolve(req.result);
      } else {
        // Если ключа нет — создаем новый AES-GCM ключ
        const newKey = await crypto.subtle.generateKey(
          { name: 'AES-GCM', length: 256 },
          false, // Ключ нельзя экспортировать (повышает безопасность)
          ['encrypt', 'decrypt']
        );
        const txWrite = db.transaction('keys', 'readwrite');
        txWrite.objectStore('keys').put(newKey, 'masterKey');
        txWrite.oncomplete = () => resolve(newKey);
      }
    };
    req.onerror = () => reject(req.error);
  });
};

// Зашифровать и сохранить
export const saveSecureData = async (key: string, data: any) => {
  try {
    const db = await initDB();
    const cryptoKey = await getDbKey(db);
    const iv = crypto.getRandomValues(new Uint8Array(12)); // Вектор инициализации
    const encodedData = new TextEncoder().encode(JSON.stringify(data));
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      encodedData
    );

    return new Promise((resolve, reject) => {
      const tx = db.transaction('data', 'readwrite');
      tx.objectStore('data').put({ iv, data: encrypted }, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error('CryptoDB Save Error:', error);
  }
};

// Извлечь и расшифровать
export const loadSecureData = async (key: string): Promise<any> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('data', 'readonly');
      const req = tx.objectStore('data').get(key);
      
      req.onsuccess = async () => {
        if (!req.result) return resolve(null);
        try {
          const cryptoKey = await getDbKey(db);
          const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: req.result.iv },
            cryptoKey,
            req.result.data
          );
          resolve(JSON.parse(new TextDecoder().decode(decrypted)));
        } catch (e) {
          console.error('Decryption failed, data might be corrupted or key changed.');
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch (error) {
    console.error('CryptoDB Load Error:', error);
    return null;
  }
};
