/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Persistent audio sample storage with IndexedDB local caching + Cloud Server synchronization.
 * Retains custom audio files and mic recordings across all devices (PC, mobile, tablet).
 */

const DB_NAME = 'beatbuddy_studio_db';
const DB_VERSION = 1;
const STORE_NAME = 'custom_samples';

export interface StoredSampleRecord {
  id: string;
  name: string;
  blob: Blob;
  mimeType: string;
  createdAt: number;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert blob to base64'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function saveSampleToStorage(
  id: string,
  name: string,
  blob: Blob
): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const record: StoredSampleRecord = {
        id,
        name,
        blob,
        mimeType: blob.type || 'audio/wav',
        createdAt: Date.now(),
      };
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    // Also sync to server immediately for cross-device availability (PC <-> Mobile)
    try {
      await syncSampleToServer(id, name, blob);
    } catch (err) {
      console.warn('Sync of sample to server fallback (offline mode):', err);
    }

    // Also sync to Firebase Firestore database if user is authenticated
    try {
      const { firebaseSyncService } = await import('../services/firebaseSyncService');
      await firebaseSyncService.saveSampleRecord({
        id,
        name,
        blob,
        mimeType: blob.type || 'audio/wav',
        createdAt: Date.now(),
      });
    } catch (err) {
      // Offline or unauthenticated fallback
    }
  } catch (err) {
    console.error('Failed to save sample to IndexedDB:', err);
  }
}

export async function getAllStoredSamples(): Promise<StoredSampleRecord[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to load samples from IndexedDB:', err);
    return [];
  }
}

export async function deleteSampleFromStorage(id: string): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    // Also delete from server
    fetch(`/api/samples/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch((e) => {
      console.warn('Failed to delete sample on server:', e);
    });

    // Also delete from Firebase Firestore
    try {
      const { firebaseSyncService } = await import('../services/firebaseSyncService');
      await firebaseSyncService.deleteSample(id);
    } catch {}
  } catch (err) {
    console.error('Failed to delete sample from IndexedDB:', err);
  }
}

export async function renameSampleInStorage(id: string, newName: string): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const record = getReq.result as StoredSampleRecord | undefined;
        if (record) {
          record.name = newName;
          const putReq = store.put(record);
          putReq.onsuccess = () => resolve();
          putReq.onerror = () => reject(putReq.error);
        } else {
          resolve();
        }
      };
      getReq.onerror = () => reject(getReq.error);
    });

    // Also rename on server
    fetch(`/api/samples/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    }).catch((e) => {
      console.warn('Failed to rename sample on server:', e);
    });
  } catch (err) {
    console.error('Failed to rename sample in IndexedDB:', err);
  }
}

// ================= CLOUD SYNC HELPERS ================= //

export async function syncSampleToServer(id: string, name: string, blob: Blob): Promise<boolean> {
  try {
    const base64Data = await blobToBase64(blob);
    const resp = await fetch('/api/samples', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        name,
        mimeType: blob.type || 'audio/wav',
        base64Data,
      }),
    });
    return resp.ok;
  } catch (err) {
    console.warn('Error syncing sample to server:', err);
    return false;
  }
}

export interface RemoteSampleMeta {
  id: string;
  name: string;
  mimeType: string;
  fileName: string;
  size: number;
  createdAt: number;
}

/**
 * Downloads missing samples from server into local IndexedDB
 */
export async function syncSamplesFromServer(): Promise<number> {
  try {
    let serverSamples: RemoteSampleMeta[] = [];
    try {
      const resp = await fetch('/api/samples');
      if (resp.ok) {
        const json = await resp.json();
        serverSamples = json.samples || [];
      }
    } catch {}

    // Fallback to static public/samples/index.json if API was unavailable (e.g. static host/Vercel)
    if (serverSamples.length === 0) {
      try {
        const staticResp = await fetch('/samples/index.json');
        if (staticResp.ok) {
          const list = await staticResp.json();
          serverSamples = Array.isArray(list) ? list : (list.samples || []);
        }
      } catch {}
    }

    if (serverSamples.length === 0) return 0;

    const localSamples = await getAllStoredSamples();
    const localIds = new Set(localSamples.map((s) => s.id));
    let downloadedCount = 0;

    for (const remote of serverSamples) {
      if (!localIds.has(remote.id)) {
        try {
          let audioResp = await fetch(`/api/samples/${encodeURIComponent(remote.id)}/audio`);
          if (!audioResp.ok && remote.fileName) {
            audioResp = await fetch(`/samples/${encodeURIComponent(remote.fileName)}`);
          }
          if (!audioResp.ok) {
            audioResp = await fetch(`/samples/${encodeURIComponent(remote.id)}.wav`);
          }
          if (audioResp.ok) {
            const blob = await audioResp.blob();
            // Save to IndexedDB
            const db = await openDatabase();
            await new Promise<void>((res, rej) => {
              const tx = db.transaction(STORE_NAME, 'readwrite');
              const store = tx.objectStore(STORE_NAME);
              const record: StoredSampleRecord = {
                id: remote.id,
                name: remote.name,
                blob,
                mimeType: remote.mimeType || 'audio/wav',
                createdAt: remote.createdAt || Date.now(),
              };
              const req = store.put(record);
              req.onsuccess = () => res();
              req.onerror = () => rej(req.error);
            });
            downloadedCount++;
          }
        } catch (e) {
          console.warn(`Failed to fetch audio for sample ${remote.name}:`, e);
        }
      }
    }

    // Also upload any local sample that server does not have yet
    const remoteIds = new Set(serverSamples.map((s) => s.id));
    for (const local of localSamples) {
      if (!remoteIds.has(local.id)) {
        await syncSampleToServer(local.id, local.name, local.blob);
      }
    }

    return downloadedCount;
  } catch (err) {
    console.warn('Error syncing samples from server:', err);
    return 0;
  }
}

export async function fetchRhythmsFromServer(): Promise<unknown[] | null> {
  try {
    const resp = await fetch('/api/rhythms');
    if (resp.ok) {
      const data = await resp.json();
      if (Array.isArray(data.rhythms) && data.rhythms.length > 0) {
        return data.rhythms;
      }
    }
    // Fallback to static public/rhythms.json
    const staticResp = await fetch('/rhythms.json');
    if (staticResp.ok) {
      const list = await staticResp.json();
      if (Array.isArray(list) && list.length > 0) {
        return list;
      }
    }
  } catch (err) {
    console.warn('Failed to load rhythms from server:', err);
  }
  return null;
}

export async function saveRhythmsToServer(rhythms: unknown[]): Promise<boolean> {
  try {
    const resp = await fetch('/api/rhythms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rhythms }),
    });
    return resp.ok;
  } catch (err) {
    console.warn('Failed to save rhythms to server:', err);
    return false;
  }
}

export async function fetchActiveRhythmFromServer(): Promise<string | null> {
  try {
    const res = await fetch('/api/active_rhythm');
    if (res.ok) {
      const data = await res.json();
      if (data.rhythmId) return data.rhythmId;
    }
    const staticRes = await fetch('/active_rhythm.json');
    if (staticRes.ok) {
      const data = await staticRes.json();
      if (data.rhythmId) return data.rhythmId;
    }
  } catch (e) {
    console.warn('Failed to fetch active rhythm from server:', e);
  }
  return null;
}

export async function saveActiveRhythmToServer(rhythmId: string): Promise<void> {
  try {
    await fetch('/api/active_rhythm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rhythmId }),
    });
  } catch (e) {
    console.warn('Failed to save active rhythm to server:', e);
  }
}
