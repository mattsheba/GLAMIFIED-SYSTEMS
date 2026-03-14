/**
 * submit-job.js
 * Netlify Function — endpoint: /api/submit-job
 *
 * Accepts job posting submissions from the frontend.
 * Saves each submission to a JSON file and emails the admin.
 *
 * Requires environment variables:
 *   ADMIN_EMAIL — where to send notifications (e.g. info.glamifiedsystems@gmail.com)
 *   FROM_EMAIL, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS — for nodemailer
 */

const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const DATA_PATH = path.join(__dirname, '../data/job-postings.json');

function saveJobPosting(job) {
  let jobs = [];
  if (fs.existsSync(DATA_PATH)) {
    try {
      jobs = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    } catch {}
  }
  jobs.push({ ...job, submitted: new Date().toISOString() });
  fs.writeFileSync(DATA_PATH, JSON.stringify(jobs, null, 2));
}

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
      <li><b>Company:</b> ${job.company}</li>
      <li><b>Contact Name:</b> ${job.name}</li>
      <li><b>Email:</b> ${job.email}</li>
      <li><b>Job Title:</b> ${job.title}</li>
      <li><b>Location:</b> ${job.location}</li>
      <li><b>Type:</b> ${job.type}</li>
      <li><b>Salary:</b> ${job.salary}</li>
      <li><b>Description:</b> ${job.description}</li>
    </ul>`;
  await transporter.sendMail({ from, to, subject, html });
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
  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }
  const { company, name, email, title, location, type, salary, description } = body;
  if (!company || !name || !email || !title || !location || !type || !description) {
    return { statusCode: 400, body: 'Missing required fields' };
  }
  // Save to file
  try {
    saveJobPosting(body);
  } catch (err) {
    return { statusCode: 500, body: 'Failed to save job posting' };
  }
  // Email admin
  try {
    await sendEmail(body);
  } catch (err) {
    // Still return success if email fails, but log error
    console.error('Failed to send email:', err);
  }
  return {
    statusCode: 200,
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ success: true }),
  };
};
