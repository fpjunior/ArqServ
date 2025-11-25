const fetch = global.fetch || require('node-fetch');
const { createClient } = require('@supabase/supabase-js');
const User = require('../models/user.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SUPABASE_URL = process.env.SUPABASE_URL;

// Helper to generate backend JWT
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      user_type: user.user_type,
      municipality: user.municipality
    },
    process.env.JWT_SECRET || 'arqserv_secret_key',
    { expiresIn: '24h' }
  );
};

exports.syncSupabaseUser = async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Missing or invalid Authorization header' });
    }

    const supabaseToken = authHeader.replace('Bearer ', '');

    // DEV BYPASS: If TEST_BYPASS_SUPABASE is enabled, accept a mock user from headers or body for local testing
    let supabaseUser = null;
    if (process.env.TEST_BYPASS_SUPABASE === 'true') {
      // Check for JSON in header X-SUPABASE-MOCK-USER as base64 encoded or raw JSON
      const headerMock = req.headers['x-supabase-mock-user'];
      if (headerMock) {
        try {
          const decoded = Buffer.from(String(headerMock), 'base64').toString('utf-8');
          supabaseUser = JSON.parse(decoded);
        } catch (err) {
          try { supabaseUser = JSON.parse(String(headerMock)); } catch (inner) { /* ignore */ }
        }
      }
      // Also accept mock user in body: { mock_user: { ... } }
      if (!supabaseUser && req.body && req.body.mock_user) {
        supabaseUser = req.body.mock_user;
      }
      // If we still don't have a supabase user and we don't have a SUPABASE_URL, create a simulated user from token
      if (!supabaseUser && !SUPABASE_URL) {
        // token is used as id or email for dev convenience
        supabaseUser = {
          id: supabaseToken || ('dev-' + Math.random().toString(36).substring(2, 8)),
          email: `${supabaseToken || 'dev'}@example.com`,
          user_metadata: {
            name: `Dev User ${supabaseToken || 'dev'}`,
            role: 'user',
            user_type: 'prefeitura'
          }
        };
        console.warn('[AUTH/SUPABASE] TEST_BYPASS_SUPABASE: Simulated user created for dev', supabaseUser.email);
      }
    }

    if (!supabaseUser) {
      if (!SUPABASE_URL) {
        // Provide a helpful message to indicate how to fix the deployment configuration
        const msg = 'Supabase URL not configured on server. Set SUPABASE_URL in backend environment variables (or via Docker env_file)';
        console.error('[AUTH/SUPABASE] ' + msg);
        return res.status(500).json({ success: false, message: msg });
      }
      // Call Supabase to retrieve user info
      const headers = { Authorization: `Bearer ${supabaseToken}`, Accept: 'application/json' };
      if (process.env.SUPABASE_SERVICE_ROLE_KEY) headers.apikey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        const text = await response.text();
        console.error('Error fetching supabase user:', response.status, text);
        return res.status(401).json({ success: false, message: 'Invalid Supabase token' });
      }

      supabaseUser = await response.json();
    }
    // Extract user data from Supabase response
    const email = supabaseUser.email;
    const name = supabaseUser.user_metadata?.name || supabaseUser.email;
    // Use let so we can prefer DB-stored role if user already exists
    let role = supabaseUser.user_metadata?.role || 'user';
    let user_type = supabaseUser.user_metadata?.user_type || 'prefeitura';
    const municipality = supabaseUser.user_metadata?.municipality || null;

    // Find or create local user
    let user = await User.findByEmail(email);

    if (!user) {
      // Create placeholder password (random) and hash
      const placeholderPassword = Math.random().toString(36).substring(2, 12);
      const hashedPassword = await bcrypt.hash(placeholderPassword, 10);
      user = await User.create({ name, email, password: hashedPassword, user_type, municipality, role });
    }

    // If the user already exists, prefer the role stored in the database
    if (user && user.role) {
      role = user.role;
      user_type = user.user_type || user_type;
    }

    console.log(`[AUTH/SUPABASE] Syncing user '${email}'; final role: ${role}, user_type: ${user_type}`);

    // Generate backend token
    const token = generateToken(user);

    res.json({ success: true, message: 'User synced', data: { token, user } });
  } catch (error) {
    console.error('❌ [AUTH/SUPABASE] Error syncing user:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// POST /api/auth/invite
exports.inviteUser = async (req, res) => {
  try {
    const { email, redirectTo } = req.body || {};
    if (!email) return res.status(400).json({ success: false, message: 'Missing email' });

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const SUPABASE_URL = process.env.SUPABASE_URL;
    if (!serviceKey || !SUPABASE_URL) {
      return res.status(500).json({ success: false, message: 'Supabase service role key or URL not configured' });
    }

    // If not in bypass mode, require a backend JWT with admin role
    if (process.env.TEST_BYPASS_SUPABASE !== 'true') {
      const authHeader = req.headers['authorization'];
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }
      const token = authHeader.replace('Bearer ', '');
      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET || 'arqserv_secret_key');
        if (!payload || (payload.role !== 'admin' && payload.user_type !== 'admin')) {
          return res.status(403).json({ success: false, message: 'Forbidden: admin required' });
        }
      } catch (err) {
        console.error('[AUTH/SUPABASE] invite verify token error:', err.message);
        return res.status(401).json({ success: false, message: 'Invalid token' });
      }
    }

    const adminClient = createClient(SUPABASE_URL, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    // Invite the user via admin api
    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, { redirectTo });
    if (error) {
      console.error('[AUTH/SUPABASE] invite error:', error);
      return res.status(400).json({ success: false, message: error.message || 'Error inviting user', error });
    }

    return res.json({ success: true, message: 'Invitation sent', data });
  } catch (err) {
    console.error('[AUTH/SUPABASE] invite internal error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
