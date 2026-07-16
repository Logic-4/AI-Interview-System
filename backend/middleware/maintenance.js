/**
 * Maintenance mode middleware.
 * Intercepts requests and returns a 503 response if maintenance mode is active,
 * except for allowed routes like health check and logout.
 */
const checkMaintenance = (req, res, next) => {
  if (process.env.MAINTENANCE_MODE === 'true') {
    // Allowed routes that are not blocked by maintenance mode
    const allowedSubpaths = ['/health', '/logout'];
    
    // Check if the current request URL matches any of the allowed routes
    const isAllowed = allowedSubpaths.some((subpath) => req.originalUrl.includes(subpath));

    if (!isAllowed) {
      return res.status(503).json({
        success: false,
        maintenance: true,
        message: 'The platform is currently undergoing scheduled maintenance. Please check back later.',
      });
    }
  }
  next();
};

module.exports = { checkMaintenance };
