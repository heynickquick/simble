// Two auth modes:
// 1. serverAuthMiddleware — server-to-server (campaign-manager → sms-relay)
//    Uses `Authorization: Bearer ${SMS_RELAY_SECRET}`
// 2. authMiddleware — device-side (phone-agent → sms-relay)
//    Uses the device token in the URL path (no header needed)

const SERVER_SECRET = process.env.SMS_RELAY_SECRET;

export function serverAuthMiddleware(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token || token !== SERVER_SECRET) {
    return res.status(401).json({ error: 'invalid server secret' });
  }
  next();
}

export function authMiddleware(req, res, next) {
  // Device token is in the URL path: /devices/:token/...
  // The token validity is checked by the route handler (DB lookup).
  // This middleware just ensures the param exists.
  if (!req.params.token) {
    return res.status(401).json({ error: 'device token required' });
  }
  next();
}
