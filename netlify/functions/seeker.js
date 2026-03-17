// ============================================================
// Netlify Function: /api/seeker
// POST — register or update a job seeker profile
// GET  — fetch seeker profile + their applications (by email)
// ============================================================

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  // ── POST — register / update seeker profile ────────────────
  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}');

      const {
        full_name,
        email,
        phone,
        location,
        cv_url,
        cvpro_reference, // reference ID from cvprozambia.com
        headline,
      } = body;

      const required = { full_name, email };
      const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
      if (missing.length > 0) {
        return {
          statusCode: 400,
          headers: CORS,
          body: JSON.stringify({ error: `Missing required fields: ${missing.join(', ')}` }),
        };
      }

      // Upsert seeker profile by email
      const { data: seeker, error } = await supabase
        .from('job_seekers')
        .upsert(
          {
            email: email.toLowerCase(),
            full_name,
            phone,
            location,
            cv_url,
            cvpro_reference,
            headline,
          },
          { onConflict: 'email', ignoreDuplicates: false }
        )
        .select('id, full_name, email, created_at')
        .single();

      if (error) throw error;

      return {
        statusCode: 201,
        headers: CORS,
        body: JSON.stringify({
          success: true,
          message: 'Seeker profile saved',
          seeker,
        }),
      };
    } catch (err) {
      return {
        statusCode: 500,
        headers: CORS,
        body: JSON.stringify({ error: err.message }),
      };
    }
  }

  // ── GET — fetch seeker profile + applications ──────────────
  if (event.httpMethod === 'GET') {
    try {
      const { email } = event.queryStringParameters || {};

      if (!email) {
        return {
          statusCode: 400,
          headers: CORS,
          body: JSON.stringify({ error: 'Email required. Use ?email=...' }),
        };
      }

      const { data: seeker, error } = await supabase
        .from('job_seekers')
        .select('id, full_name, email, phone, location, cv_url, headline, created_at')
        .eq('email', email.toLowerCase())
        .single();

      if (error || !seeker) {
        return {
          statusCode: 404,
          headers: CORS,
          body: JSON.stringify({ error: 'Seeker profile not found' }),
        };
      }

      // Fetch their applications with job details
      const { data: applications } = await supabase
        .from('applications')
        .select(`
          id, status, applied_at, source,
          jobs (id, title, company_name, location)
        `)
        .eq('seeker_id', seeker.id)
        .order('applied_at', { ascending: false });

      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({
          seeker,
          applications: applications || [],
        }),
      };
    } catch (err) {
      return {
        statusCode: 500,
        headers: CORS,
        body: JSON.stringify({ error: err.message }),
      };
    }
  }

  return {
    statusCode: 405,
    headers: CORS,
    body: JSON.stringify({ error: 'Method not allowed' }),
  };
};
