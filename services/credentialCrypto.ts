const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

interface CredentialCipherPayload {
  v: 1;
  alg: 'AES-GCM';
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  salt: string;
  iv: string;
  data: string;
}

const ITERATIONS = 210000;

const bytesToBase64 = (bytes: ArrayBuffer | Uint8Array) => {
  const array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const byte of array) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const base64ToBytes = (value: string) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const deriveKey = async (masterPassword: string, salt: Uint8Array) => {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(masterPassword),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
};

export const encryptCredentialPassword = async (plainText: string, masterPassword: string): Promise<string> => {
  if (!masterPassword) throw new Error('MASTER_PASSWORD_REQUIRED');

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(masterPassword, salt);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    textEncoder.encode(plainText)
  );

  const payload: CredentialCipherPayload = {
    v: 1,
    alg: 'AES-GCM',
    kdf: 'PBKDF2-SHA256',
    iterations: ITERATIONS,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    data: bytesToBase64(encrypted),
  };

  return JSON.stringify(payload);
};

export const decryptCredentialPassword = async (cipherText: string, masterPassword: string): Promise<string> => {
  if (!masterPassword) throw new Error('MASTER_PASSWORD_REQUIRED');

  const payload = JSON.parse(cipherText) as CredentialCipherPayload;
  if (payload.v !== 1 || payload.alg !== 'AES-GCM' || payload.kdf !== 'PBKDF2-SHA256') {
    throw new Error('UNSUPPORTED_CIPHER');
  }

  const salt = base64ToBytes(payload.salt);
  const iv = base64ToBytes(payload.iv);
  const key = await deriveKey(masterPassword, salt);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    base64ToBytes(payload.data)
  );

  return textDecoder.decode(decrypted);
};
