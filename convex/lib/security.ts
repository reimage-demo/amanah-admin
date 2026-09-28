const enc = new TextEncoder();
const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const bytes = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
function secret(name: string) {
  const value = process.env[name];
  if (!value) throw new Error("Security configuration unavailable");
  return bytes(value);
}
export async function encrypt(value: unknown, context: string) {
  const key = await crypto.subtle.importKey("raw", secret("SIGNUP_DATA_KEY_V1"), "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({name:"AES-GCM", iv, additionalData:enc.encode(context)}, key, enc.encode(JSON.stringify(value)));
  return `v1.${b64(iv)}.${b64(new Uint8Array(data))}`;
}
export async function decrypt(value: string, context: string) {
  const [version, iv, data] = value.split(".");
  if (version !== "v1") throw new Error("Unsupported encryption version");
  const key = await crypto.subtle.importKey("raw", secret("SIGNUP_DATA_KEY_V1"), "AES-GCM", false, ["decrypt"]);
  return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:"AES-GCM",iv:bytes(iv),additionalData:enc.encode(context)},key,bytes(data))));
}
export async function privateIndex(value: string) {
  const key = await crypto.subtle.importKey("raw", secret("SIGNUP_INDEX_KEY_V1"), {name:"HMAC",hash:"SHA-256"}, false, ["sign"]);
  return b64(new Uint8Array(await crypto.subtle.sign("HMAC",key,enc.encode(value))));
}
async function derive(password: string, salt: Uint8Array<ArrayBuffer>) {
  const pepper = await crypto.subtle.importKey("raw",secret("ADMIN_PASSWORD_PEPPER"),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const material = await crypto.subtle.sign("HMAC",pepper,enc.encode(password));
  const key = await crypto.subtle.importKey("raw",material,"PBKDF2",false,["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt,iterations:600000},key,256));
}
export async function hashSecret(password: string) {
  const salt=crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2-sha256-v1.${b64(salt)}.${b64(await derive(password,salt))}`;
}
export async function verifySecret(password: string, hash: string) {
  const [version,salt,digest]=hash.split(".");
  if(version!=="pbkdf2-sha256-v1") return false;
  const actual=await derive(password,bytes(salt)), expected=bytes(digest);
  if(actual.length!==expected.length) return false;
  let diff=0; for(let i=0;i<actual.length;i++) diff |= actual[i]^expected[i];
  return diff===0;
}
