const localFiles = (() => {
  const databaseName = 'omnira-student-files';
  const storeName = 'files';

  function open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(storeName)) {
          const store = db.createObjectStore(storeName, { keyPath: 'id' });
          store.createIndex('folderId', 'folderId');
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function run(mode, operation) {
    const db = await open();
    try {
      return await new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, mode);
        const request = operation(transaction.objectStore(storeName));
        let value;
        request.onsuccess = () => { value = request.result; };
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => resolve(value);
        transaction.onerror = () => reject(transaction.error);
      });
    } finally {
      db.close();
    }
  }

  return {
    save(file, folderId) {
      return run('readwrite', store => store.put({
        id: crypto.randomUUID(), folderId, name: file.name,
        size: file.size, type: file.type, savedAt: Date.now(), blob: file
      }));
    },
    list(folderId) {
      return run('readonly', store => store.index('folderId').getAll(folderId));
    },
    get(id) {
      return run('readonly', store => store.get(id));
    }
  };
})();
