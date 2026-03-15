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
  const { company, contactName, email, jobTitle, location, jobType, salary, description } = body;
  // Map to internal names for email
  const name = contactName;
  const title = jobTitle;
  const type = jobType;
  if (!company || !name || !email || !title || !location || !type || !description) {
    return { statusCode: 400, body: 'Missing required fields' };
  }
  
  // Build job object for email
  const job = { company, name, email, title, location, type, salary, description };
  
  // Email admin (don't fail if email fails - we still got the submission)
  try {
    if (process.env.SMTP_PASS && process.env.ADMIN_EMAIL) {
      await sendEmail(job);
      console.log('Job posting email sent successfully');
    } else {
      console.log('SMTP not configured - job posting received but email not sent:', JSON.stringify(job));
    }
  } catch (err) {
    // Log error but don't fail - at least log the job details
    console.error('Failed to send email:', err.message);
    console.log('Job posting data:', JSON.stringify(job));
  }
  return {
    statusCode: 200,
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ success: true, message: 'Job posting received' }),
  };
};
