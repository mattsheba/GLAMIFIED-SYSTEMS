// ============================================================
// Netlify Function: /api/job (single job by ?id=)
// GET — fetch full job detail + increment view count
// ============================================================

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const { id } = event.queryStringParameters || {};

  if (!id) {
    return {
      statusCode: 400,
      headers: CORS,
      body: JSON.stringify({ error: 'Job ID required. Use ?id=<uuid>' }),
    };
  }

  try {
    const { data: job, error } = await supabase
      .from('jobs')
      .select(`
        id, title, company_name, location, province, job_type,
        category, salary_min, salary_max, salary_currency,
        salary_visible, description, requirements, benefits,
        deadline, views, created_at, status, posted_via
      `)
      .eq('id', id)
      .eq('status', 'active')
      .single();

    if (error || !job) {
      return {
        statusCode: 404,
        headers: CORS,
        body: JSON.stringify({ error: 'Job not found or no longer active' }),
      };
    }

    // Increment view count (fire and forget)
    supabase.rpc('increment_job_views', { job_uuid: id }).then(() => {});

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ job }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
