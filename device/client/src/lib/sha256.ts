/**
 * Pure TypeScript SHA-256 and HMAC-SHA256 — no external dependencies.
 * Works in any JavaScript environment including Hermes (React Native).
 * Based on NIST FIPS 180-4.
 */

// SHA-256 round constants (first 32 bits of the fractional parts of
// the cube roots of the first 64 primes)
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
  0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

export function sha256(data: Uint8Array): Uint8Array {
  // Initial hash values (first 32 bits of fractional parts of square roots
  // of the first 8 primes)
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  // Padding: append 0x80, zero bytes, then 64-bit big-endian bit-length.
  // Total length must be a multiple of 64 bytes and at least data.length + 9.
  const padLen = Math.ceil((data.length + 9) / 64) * 64;
  const msg = new Uint8Array(padLen);
  msg.set(data);
  msg[data.length] = 0x80;
  const dv = new DataView(msg.buffer);
  // 64-bit bit-length, big-endian. High word is 0 for any message < 512 MB.
  dv.setUint32(padLen - 8, 0, false);
  dv.setUint32(padLen - 4, (data.length * 8) >>> 0, false);

  const w = new Uint32Array(64);

  for (let bi = 0; bi < padLen; bi += 64) {
    // Load 16 message schedule words from this block
    for (let i = 0; i < 16; i++) {
      w[i] = dv.getUint32(bi + i * 4, false);
    }
    // Extend to 64 words
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0, b = h1, c = h2, d = h3;
    let e = h4, f = h5, g = h6, h = h7;

    for (let i = 0; i < 64; i++) {
      const S1  = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch  = (e & f) ^ (~e & g);
      const t1  = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0  = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2  = (S0 + maj) >>> 0;

      h = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }

    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }

  const digest = new Uint8Array(32);
  const out = new DataView(digest.buffer);
  out.setUint32(0,  h0, false); out.setUint32(4,  h1, false);
  out.setUint32(8,  h2, false); out.setUint32(12, h3, false);
  out.setUint32(16, h4, false); out.setUint32(20, h5, false);
  out.setUint32(24, h6, false); out.setUint32(28, h7, false);
  return digest;
}

/**
 * HMAC-SHA256(key, message) per RFC 2104.
 * Both arguments are raw byte arrays.
 */
export function hmacSha256(key: Uint8Array, message: Uint8Array): Uint8Array {
  const BLOCK = 64;

  // If key is longer than the block size, hash it first
  const k = key.length > BLOCK ? sha256(key) : key;

  // Pad / truncate key to exactly BLOCK bytes
  const kpad = new Uint8Array(BLOCK);
  kpad.set(k);

  const ikey = new Uint8Array(BLOCK);
  const okey = new Uint8Array(BLOCK);
  for (let i = 0; i < BLOCK; i++) {
    ikey[i] = kpad[i] ^ 0x36; // inner pad
    okey[i] = kpad[i] ^ 0x5c; // outer pad
  }

  // inner = SHA256(ikey || message)
  const innerInput = new Uint8Array(BLOCK + message.length);
  innerInput.set(ikey, 0);
  innerInput.set(message, BLOCK);
  const innerHash = sha256(innerInput);

  // HMAC = SHA256(okey || inner)
  const outerInput = new Uint8Array(BLOCK + 32);
  outerInput.set(okey, 0);
  outerInput.set(innerHash, BLOCK);
  return sha256(outerInput);
}
