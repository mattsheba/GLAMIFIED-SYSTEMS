// ============================================================
// Netlify Function: /api/apply
// POST — job seeker submits an application
// Called from: glamifiedsystems.com AND cvprozambia.com
// ============================================================

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');

    const {
      job_id,
      full_name,
      email,
      phone,
      cv_url,
      cover_letter,
      source = 'glamifiedsystems', // or 'cvprozambia'
      seeker_id,                   // optional — if seeker has a profile
    } = body;

    // Validate required fields
    const required = { job_id, full_name, email, cv_url };
    const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
    if (missing.length > 0) {
      return {
        statusCode: 400,
        headers: CORS,
        body: JSON.stringify({ error: `Missing required fields: ${missing.join(', ')}` }),
      };
    }

    // Validate cv_url is a URL
    try { new URL(cv_url); } catch {
      return {
        statusCode: 400,
        headers: CORS,
        body: JSON.stringify({ error: 'cv_url must be a valid URL' }),
      };
    }

    // Check job exists and is active
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, title, company_name, deadline')
      .eq('id', job_id)
      .eq('status', 'active')
      .single();

    if (jobError || !job) {
      return {
        statusCode: 404,
        headers: CORS,
        body: JSON.stringify({ error: 'Job not found or is no longer accepting applications' }),
      };
    }

    // Check deadline
    if (job.deadline && new Date(job.deadline) < new Date()) {
      return {
        statusCode: 400,
        headers: CORS,
        body: JSON.stringify({ error: 'This job listing has passed its application deadline' }),
      };
    }

    // Prevent duplicate applications (same email + job)
    const { data: existing } = await supabase
      .from('applications')
      .select('id')
      .eq('job_id', job_id)
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (existing) {
      return {
        statusCode: 409,
        headers: CORS,
        body: JSON.stringify({ error: 'You have already applied for this position' }),
      };
    }

    // Insert application
    const { data: application, error: appError } = await supabase
      .from('applications')
      .insert({
        job_id,
        seeker_id: seeker_id || null,
        full_name,
        email: email.toLowerCase(),
        phone,
        cv_url,
        cover_letter,
        source,
        status: 'received',
      })
      .select('id, applied_at')
      .single();

    if (appError) throw appError;

    return {
      statusCode: 201,
      headers: CORS,
      body: JSON.stringify({
        success: true,
        message: `Application submitted for ${job.title} at ${job.company_name}`,
        application_id: application.id,
        applied_at: application.applied_at,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
