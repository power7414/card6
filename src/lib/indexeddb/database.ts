/**
 * IndexedDB Database Connection and Management
 * 
 * This file provides a singleton database connection and core database operations.
 * It handles database initialization, connection management, and error recovery.
 */

import { DB_NAME, DB_VERSION, upgradeDatabase } from './schema';

export class DatabaseError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'DatabaseError';
  }
}

class DatabaseManager {
  private db: IDBDatabase | null = null;
  private opening: Promise<IDBDatabase> | null = null;
  private isSupported: boolean | null = null;

  /**
   * Check if IndexedDB is supported in the current environment
   */
  isIndexedDBSupported(): boolean {
    if (this.isSupported !== null) {
      return this.isSupported;
    }

    this.isSupported = 'indexedDB' in window && 
                      typeof window.indexedDB !== 'undefined' &&
                      window.indexedDB !== null;
    
    return this.isSupported;
  }

  /**
   * Get the database connection, opening it if necessary
   */
  async getDatabase(): Promise<IDBDatabase> {
    if (!this.isIndexedDBSupported()) {
      throw new DatabaseError('IndexedDB is not supported in this environment');
    }

    if (this.db && !this.db.objectStoreNames.length) {
      // Database was closed or corrupted, reset
      this.db = null;
    }

    if (this.db) {
      return this.db;
    }

    if (this.opening) {
      return this.opening;
    }

    this.opening = this.openDatabase();
    try {
      this.db = await this.opening;
      this.opening = null;
      return this.db;
    } catch (error) {
      this.opening = null;
      throw error;
    }
  }

  /**
   * Open the IndexedDB database
   */
  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        const error = new DatabaseError(
          `Failed to open database: ${request.error?.message || 'Unknown error'}`,
          request.error || undefined
        );
        reject(error);
      };

      request.onsuccess = () => {
        const db = request.result;
        
        // Handle unexpected database closure
        db.onclose = () => {
          console.warn('Database connection was unexpectedly closed');
          this.db = null;
        };

        db.onerror = (event) => {
          console.error('Database error:', event);
        };

        resolve(db);
      };

      request.onupgradeneeded = (event) => {
        const db = request.result;
        const oldVersion = event.oldVersion;
        const newVersion = event.newVersion;
        
        try {
          upgradeDatabase(db, oldVersion, newVersion);
        } catch (error) {
          console.error('Error during database upgrade:', error);
          reject(new DatabaseError('Failed to upgrade database schema', error as Error));
        }
      };

      request.onblocked = () => {
        console.warn('Database upgrade blocked. Please close other tabs using this application.');
      };
    });
  }

  /**
   * Close the database connection
   */
  closeDatabase(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Delete the entire database (for testing or reset purposes)
   */
  async deleteDatabase(): Promise<void> {
    if (!this.isIndexedDBSupported()) {
      throw new DatabaseError('IndexedDB is not supported in this environment');
    }

    this.closeDatabase();

    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DB_NAME);
      
      request.onerror = () => {
        reject(new DatabaseError(
          `Failed to delete database: ${request.error?.message || 'Unknown error'}`,
          request.error || undefined
        ));
      };

      request.onsuccess = () => {
        console.log('Database deleted successfully');
        resolve();
      };

      request.onblocked = () => {
        console.warn('Database deletion blocked. Please close other tabs using this application.');
      };
    });
  }

  /**
   * Execute a transaction with automatic retry and error handling
   */
  async withTransaction<T>(
    storeNames: string | string[],
    mode: IDBTransactionMode,
    callback: (transaction: IDBTransaction, stores: { [storeName: string]: IDBObjectStore }) => Promise<T>
  ): Promise<T> {
    const db = await this.getDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeNames, mode);
      
      transaction.onerror = () => {
        reject(new DatabaseError(
          `Transaction failed: ${transaction.error?.message || 'Unknown error'}`,
          transaction.error || undefined
        ));
      };

      transaction.onabort = () => {
        reject(new DatabaseError('Transaction was aborted'));
      };

      // Create stores object for easy access
      const stores: { [storeName: string]: IDBObjectStore } = {};
      const storeNameArray = Array.isArray(storeNames) ? storeNames : [storeNames];
      
      storeNameArray.forEach(storeName => {
        stores[storeName] = transaction.objectStore(storeName);
      });

      // Execute the callback
      callback(transaction, stores)
        .then(resolve)
        .catch(reject);
    });
  }

  /**
   * Execute a read-only operation with error handling
   */
  async withReadTransaction<T>(
    storeNames: string | string[],
    callback: (stores: { [storeName: string]: IDBObjectStore }) => Promise<T>
  ): Promise<T> {
    return this.withTransaction(storeNames, 'readonly', async (transaction, stores) => {
      return callback(stores);
    });
  }

  /**
   * Execute a read-write operation with error handling
   */
  async withWriteTransaction<T>(
    storeNames: string | string[],
    callback: (stores: { [storeName: string]: IDBObjectStore }) => Promise<T>
  ): Promise<T> {
    return this.withTransaction(storeNames, 'readwrite', async (transaction, stores) => {
      return callback(stores);
    });
  }
}

// Export singleton instance
export const dbManager = new DatabaseManager();

/**
 * Utility function to convert IDBRequest to Promise
 */
export function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new DatabaseError(
      `Request failed: ${request.error?.message || 'Unknown error'}`,
      request.error || undefined
    ));
  });
}

/**
 * Utility function to convert IDBCursor operations to arrays
 */
export function cursorToArray<T>(request: IDBRequest<IDBCursorWithValue | null>): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const results: T[] = [];
    
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    
    request.onerror = () => reject(new DatabaseError(
      `Cursor operation failed: ${request.error?.message || 'Unknown error'}`,
      request.error || undefined
    ));
  });
}