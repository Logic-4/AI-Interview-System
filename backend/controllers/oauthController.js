const User = require('../models/User');
const { generateAccessToken, generateRefreshToken, getTokenExpiry } = require('../utils/tokenUtils');
const logger = require('../utils/logger');

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

/**
 * Helper — finish OAuth login: find-or-create user, generate tokens, redirect to frontend
 */
const finishOAuth = async (res, { provider, providerId, email, name, avatar }) => {
  try {
    let user = await User.findOne({ provider, providerId });

    if (!user) {
      user = await User.findOne({ email });
      if (user) {
        user.provider = provider;
        user.providerId = providerId;
        if (avatar && !user.avatar) user.avatar = avatar;
        await user.save();
      } else {
        user = await User.create({
          name,
          email,
          provider,
          providerId,
          avatar: avatar || '',
          isEmailVerified: true,
        });
      }
    }

    const accessToken = generateAccessToken({ id: user._id, email: user.email, role: user.role });
    const refreshToken = generateRefreshToken({ id: user._id });

    user.refreshTokens.push({
      token: refreshToken,
      expiresAt: getTokenExpiry(process.env.JWT_REFRESH_EXPIRES_IN || '7d'),
    });
    user.lastLogin = new Date();
    await user.save();

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    logger.info(`OAuth login: ${provider} — ${email}`);

    res.redirect(`${CLIENT_URL}/auth/callback?accessToken=${accessToken}`);
  } catch (error) {
    logger.error(`OAuth error: ${error.message}`);
    res.redirect(`${CLIENT_URL}/login?error=${encodeURIComponent('OAuth login failed. Please try again.')}`);
  }
};

// ─── Google ─────────────────────────────────────────

const googleRedirect = (_req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${process.env.API_BASE_URL || 'http://localhost:5000'}/api/v1/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
};

const googleCallback = async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect(`${CLIENT_URL}/login?error=Missing+authorization+code`);

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${process.env.API_BASE_URL || 'http://localhost:5000'}/api/v1/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = await tokenRes.json();
    if (tokenData.error) throw new Error(tokenData.error_description || tokenData.error);

    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json();

    await finishOAuth(res, {
      provider: 'google',
      providerId: profile.id,
      email: profile.email,
      name: profile.name,
      avatar: profile.picture,
    });
  } catch (error) {
    logger.error(`Google OAuth failed: ${error.message}`);
    res.redirect(`${CLIENT_URL}/login?error=${encodeURIComponent('Google sign-in failed.')}`);
  }
};

module.exports = { googleRedirect, googleCallback };
