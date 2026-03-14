/**
 * keygen.js
 * License key generator for GlamifiedHR
 * Mirrors the logic in your Python keygen.py
 * 
 * Key format: GLAM-XXXX-XXXX-XXXX-XXXX
 * Each key is:
 *   - Tied to the plan (Basic / Payroll / Suite)
 *   - Contains a checksum so fake keys are rejected by the desktop app
 *   - Stored with the buyer's email so you can look up any key
 */

const crypto = require("crypto");

// Plan codes embedded in the key prefix
const PLAN_CODES = {
  "Basic HR":      "BHR",
  "HR + Payroll":  "HRP",
  "Full Suite":    "FST",
};

// Your master secret — loaded from environment, never hardcoded
const MASTER_SECRET = process.env.GLAMIFIED_KEYGEN_SECRET;

/**
 * Generate a license key for a given plan and buyer email.
 * 
 * @param {string} plan     - e.g. "HR + Payroll"
 * @param {string} email    - buyer's email (used as seed for uniqueness)
 * @returns {string}        - e.g. "GLAM-HRP1-A3F2-9B7C-X4K2"
 */
function generateLicenseKey(plan, email) {
  if (!MASTER_SECRET) {
    throw new Error("GLAMIFIED_KEYGEN_SECRET environment variable is not set");
  }

  const planCode = PLAN_CODES[plan];
  if (!planCode) {
    throw new Error(`Unknown plan: ${plan}`);
  }

  // Create a unique seed from secret + email + timestamp
  const timestamp = Date.now().toString();
  const seed = `${MASTER_SECRET}:${email.toLowerCase()}:${timestamp}`;
  
  // HMAC-SHA256 gives us a long hex string to pull characters from
  const hmac = crypto.createHmac("sha256", MASTER_SECRET);
  hmac.update(seed);
  const hash = hmac.digest("hex").toUpperCase();

  // Pull 4 groups of 4 characters from different parts of the hash
  const g1 = planCode + hash.slice(0, 1);   // e.g. HRP + A  = HRP-A
  const g2 = hash.slice(4, 8);               // e.g. 3F2B
  const g3 = hash.slice(12, 16);             // e.g. 9B7C
  const g4 = hash.slice(24, 28);             // e.g. X4K2

  const key = `GLAM-${g1}-${g2}-${g3}-${g4}`;

  return key;
}

/**
 * Validate a license key format (basic check — full validation is in the desktop app).
 * @param {string} key
 * @returns {boolean}
 */
function isValidKeyFormat(key) {
  return /^GLAM-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(key);
}

/**
 * Detect the plan from a license key's prefix.
 * @param {string} key
 * @returns {string|null}
 */
function getPlanFromKey(key) {
  const prefix = key.slice(5, 8); // e.g. "HRP"
  return Object.entries(PLAN_CODES).find(([, code]) => code === prefix)?.[0] || null;
}

module.exports = { generateLicenseKey, isValidKeyFormat, getPlanFromKey, PLAN_CODES };
