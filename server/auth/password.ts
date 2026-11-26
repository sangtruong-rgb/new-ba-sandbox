import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;

function derive(plain: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(plain, salt, KEY_LENGTH, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

/** node:crypto scrypt; the result is "scrypt$<salt hex>$<key hex>". */
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(plain, salt);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  const [scheme, saltHex, keyHex] = hash.split('$');
  if (scheme !== 'scrypt' || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, 'hex');
  if (expected.length !== KEY_LENGTH) return false;
  const key = await derive(plain, Buffer.from(saltHex, 'hex'));
  return timingSafeEqual(key, expected);
}
