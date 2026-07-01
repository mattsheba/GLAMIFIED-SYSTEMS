/**
 * submit-job.js
 * Netlify Function — endpoint: /api/submit-job
 *
 * Accepts job posting submissions from the frontend and emails the admin.
 * Note: Netlify Functions are serverless — no filesystem writes allowed.
 *
 * Requires environment variables:
 *   ADMIN_EMAIL — where to send notifications (e.g. info.glamifiedsystems@gmail.com)
 *   FROM_EMAIL, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS — for nodemailer
 */

const nodemailer = require('nodemailer');

// ── security: input validation & sanitization ──
// Strip control chars (incl. CR/LF → blocks email header injection), trim, cap length.
function cleanLine(v, max) {
  if (typeof v !== 'string') return '';
  let out = '';
  for (let i = 0; i < v.length; i++) { const c = v.charCodeAt(i); out += (c < 32 || c === 127) ? ' ' : v[i]; }
  return out.trim().slice(0, max);
}
// Multi-line fields: keep newlines/tabs, drop other control chars.
function cleanText(v, max) {
  if (typeof v !== 'string') return '';
  const s = v.replace(/\r\n?/g, '\n');
  let out = '';
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); out += (c === 9 || c === 10 || (c >= 32 && c !== 127)) ? s[i] : ''; }
  return out.trim().slice(0, max);
}
function validEmail(v) { return typeof v === 'string' && v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
// HTML-escape before inserting user input into an HTML email body.
function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

async function sendEmail(job) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  const to = process.env.ADMIN_EMAIL;
  const from = process.env.FROM_EMAIL;
  const subject = `New Job Posting: ${job.title} at ${job.company}`;
  const html = `<h2>New Job Posting Submitted</h2>
    <ul>
      <li><b>Company:</b> ${esc(job.company)}</li>
      <li><b>Contact Name:</b> ${esc(job.name)}</li>
      <li><b>Email:</b> ${esc(job.email)}</li>
      <li><b>Job Title:</b> ${esc(job.title)}</li>
      <li><b>Location:</b> ${esc(job.location)}</li>
      <li><b>Type:</b> ${esc(job.type)}</li>
      <li><b>Salary:</b> ${esc(job.salary) || '&mdash;'}</li>
    </ul>
    <p><b>Description:</b></p>
    <p style="white-space:pre-wrap;">${esc(job.description)}</p>`;
  await transporter.sendMail({ from, to, replyTo: job.email, subject, html });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }
  if (!event.body || event.body.length > 20000) {
    return { statusCode: 400, body: 'Invalid request' };
  }
  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  // Validate & sanitize all inputs
  const company     = cleanLine(body.company, 150);
  const name        = cleanLine(body.contactName, 100);
  const email       = cleanLine(body.email, 254);
  const title       = cleanLine(body.jobTitle, 150);
  const location    = cleanLine(body.location, 100);
  const type        = cleanLine(body.jobType, 60);
  const salary      = cleanLine(body.salary, 80);
  const description = cleanText(body.description, 5000);

  if (!company || !name || !email || !title || !location || !type || !description) {
    return { statusCode: 400, body: 'Missing required fields' };
  }
  if (!validEmail(email)) {
    return { statusCode: 400, body: 'Invalid email address' };
  }

  // Build job object for email
  const job = { company, name, email, title, location, type, salary, description };

  // Email admin (don't fail if email fails - we still got the submission)
  try {
    if (process.env.SMTP_PASS && process.env.ADMIN_EMAIL) {
      await sendEmail(job);
      console.log('Job posting email sent successfully');
    } else {
      console.log('SMTP not configured - job posting received but email not sent');
    }
  } catch (err) {
    console.error('Failed to send email:', err.message);
  }
  return {
    statusCode: 200,
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ success: true, message: 'Job posting received' }),
  };
};
