// ============================================================
// Netlify Function: /api/jobs
// GET  — list / search jobs
// POST — employer posts a new job
// ============================================================

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  // ── GET /api/jobs ──────────────────────────────────────────
  if (event.httpMethod === 'GET') {
    try {
      const {
        search,
        category,
        location,
        job_type,
        province,
        page = 1,
        limit = 20,
      } = event.queryStringParameters || {};

      const offset = (parseInt(page) - 1) * parseInt(limit);

      let query = supabase
        .from('jobs')
        .select(`
          id, title, company_name, location, province, job_type,
          category, salary_min, salary_max, salary_currency,
          salary_visible, deadline, views, created_at,
          description
        `, { count: 'exact' })
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .range(offset, offset + parseInt(limit) - 1);

      if (search) {
        query = query.or(
          `title.ilike.%${search}%,company_name.ilike.%${search}%,description.ilike.%${search}%`
        );
      }
      if (category)  query = query.eq('category', category);
      if (location)  query = query.ilike('location', `%${location}%`);
      if (province)  query = query.eq('province', province);
      if (job_type)  query = query.eq('job_type', job_type);

      const { data, error, count } = await query;

      if (error) throw error;

      // Trim description to snippet for listing view
      const jobs = data.map(j => ({
        ...j,
        description: j.description.slice(0, 200) + (j.description.length > 200 ? '…' : ''),
      }));

      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({
          jobs,
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / parseInt(limit)),
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

  // ── POST /api/jobs ─────────────────────────────────────────
  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}');

      const {
        // Employer fields
        employer_name,
        employer_email,
        company_name,
        company_tpin,
        employer_phone,
        posted_via = 'web',

        // Job fields
        title,
        location,
        province,
        job_type = 'full_time',
        category,
        salary_min,
        salary_max,
        salary_visible = true,
        description,
        requirements,
        benefits,
        deadline,
      } = body;

      // Validate required fields
      const required = { employer_name, employer_email, company_name, title, location, description };
      const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
      if (missing.length > 0) {
        return {
          statusCode: 400,
          headers: CORS,
          body: JSON.stringify({ error: `Missing required fields: ${missing.join(', ')}` }),
        };
      }

      // Upsert employer (by email)
      const { data: employer, error: empError } = await supabase
        .from('employers')
        .upsert(
          {
            email: employer_email,
            name: employer_name,
            company_name,
            company_tpin,
            phone: employer_phone,
            source: posted_via,
          },
          { onConflict: 'email', ignoreDuplicates: false }
        )
        .select('id')
        .single();

      if (empError) throw empError;

      // Insert job
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .insert({
          employer_id: employer.id,
          title,
          company_name,
          location,
          province,
          job_type,
          category,
          salary_min: salary_min || null,
          salary_max: salary_max || null,
          salary_visible,
          description,
          requirements,
          benefits,
          deadline: deadline || null,
          posted_via,
          status: 'active',
        })
        .select('id, title, created_at')
        .single();

      if (jobError) throw jobError;

      return {
        statusCode: 201,
        headers: CORS,
        body: JSON.stringify({
          success: true,
          message: 'Job posted successfully',
          job,
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
