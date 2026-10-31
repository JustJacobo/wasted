import { CryptoDigestAlgorithm, digest, getRandomValues } from "expo-crypto";

// Hermes no trae WebCrypto. Sin esto supabase-js arma el PKCE del login con
// Math.random y método "plain"; con esto usa números aleatorios seguros y S256.
// Solo lo que usa: getRandomValues y subtle.digest.
const g = globalThis as { crypto?: { -readonly [K in keyof Crypto]?: Crypto[K] } };
g.crypto ??= {};
g.crypto.getRandomValues ??= getRandomValues as Crypto["getRandomValues"];
g.crypto.subtle ??= {
  digest: (algorithm: AlgorithmIdentifier, data: BufferSource) =>
    digest((typeof algorithm === "string" ? algorithm : algorithm.name) as CryptoDigestAlgorithm, data),
} as SubtleCrypto;
