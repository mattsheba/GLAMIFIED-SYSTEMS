// ============================================================
// Netlify Function: /api/employer
// GET  — employer views applications for their posted jobs
// POST — employer updates application status (shortlist/reject)
// Used by: glamifiedsystems.com portal AND GlamifiedHR desktop
// ============================================================

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-employer-email',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  // Employer identified by their email (passed in header or query)
  const employerEmail =
    event.headers['x-employer-email'] ||
    (event.queryStringParameters || {}).employer_email;

  if (!employerEmail) {
    return {
      statusCode: 401,
      headers: CORS,
      body: JSON.stringify({ error: 'Employer email required (x-employer-email header)' }),
    };
  }

  // Resolve employer record
  const { data: employer, error: empError } = await supabase
    .from('employers')
    .select('id, name, company_name')
    .eq('email', employerEmail.toLowerCase())
    .single();

  if (empError || !employer) {
    return {
      statusCode: 404,
      headers: CORS,
      body: JSON.stringify({ error: 'Employer account not found' }),
    };
  }

  // ── GET — fetch jobs + applications ───────────────────────
  if (event.httpMethod === 'GET') {
    try {
      const { job_id, status } = event.queryStringParameters || {};

      // Fetch employer's jobs
      const { data: jobs, error: jobsError } = await supabase
        .from('jobs')
        .select('id, title, location, job_type, status, views, created_at, deadline')
        .eq('employer_id', employer.id)
        .order('created_at', { ascending: false });

      if (jobsError) throw jobsError;

      if (job_id) {
        // Fetch applications for a specific job
        let appQuery = supabase
          .from('applications')
          .select('id, full_name, email, phone, cv_url, cover_letter, status, source, applied_at')
          .eq('job_id', job_id)
          .order('applied_at', { ascending: false });

        if (status) appQuery = appQuery.eq('status', status);

        const { data: applications, error: appError } = await appQuery;
        if (appError) throw appError;

        return {
          statusCode: 200,
          headers: CORS,
          body: JSON.stringify({ employer, applications }),
        };
      }

      // Return job list with application counts
      const jobsWithCounts = await Promise.all(
        jobs.map(async (job) => {
          const { count } = await supabase
            .from('applications')
            .select('*', { count: 'exact', head: true })
            .eq('job_id', job.id);
          return { ...job, application_count: count || 0 };
        })
      );

      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({ employer, jobs: jobsWithCounts }),
      };
    } catch (err) {
      return {
        statusCode: 500,
        headers: CORS,
        body: JSON.stringify({ error: err.message }),
      };
    }
  }

  // ── POST — update application status ──────────────────────
  if (event.httpMethod === 'POST') {
    try {
      const { application_id, status, notes } = JSON.parse(event.body || '{}');

      const validStatuses = ['reviewed', 'shortlisted', 'rejected', 'hired'];
      if (!application_id || !validStatuses.includes(status)) {
        return {
          statusCode: 400,
          headers: CORS,
          body: JSON.stringify({
            error: `application_id and status required. Valid: ${validStatuses.join(', ')}`,
          }),
        };
      }

      // Verify this application belongs to one of this employer's jobs
      const { data: app, error: verifyError } = await supabase
        .from('applications')
        .select('id, jobs(employer_id)')
        .eq('id', application_id)
        .single();

      if (verifyError || !app || app.jobs.employer_id !== employer.id) {
        return {
          statusCode: 403,
          headers: CORS,
          body: JSON.stringify({ error: 'Not authorised to update this application' }),
        };
      }

      const { error: updateError } = await supabase
        .from('applications')
        .update({ status, employer_notes: notes || null })
        .eq('id', application_id);

      if (updateError) throw updateError;

      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({ success: true, message: `Application marked as ${status}` }),
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
