const dns = require('dns');

// Hardcode Supabase IPs to bypass DNS issues in Docker
const SUPABASE_HOSTS = {
  'db.pemveuponvfncukbsbdn.supabase.co': '2600:1f16:1cd0:3330:35b4:c919:d44f:1a74',
};

// Store original
const originalLookup = dns.lookup;

// Override DNS lookup for Supabase
dns.lookup = function(hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  if (hostname in SUPABASE_HOSTS) {
    const address = SUPABASE_HOSTS[hostname];
    console.log(`🔧 DNS Override: ${hostname} -> ${address}`);
    // Return with family 6 for IPv6
    setImmediate(() => callback(null, address, 6));
  } else {
    originalLookup.call(this, hostname, options, callback);
  }
};

module.exports = dns;
