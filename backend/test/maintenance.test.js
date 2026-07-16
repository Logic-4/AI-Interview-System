const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const { checkMaintenance } = require('../middleware/maintenance');

describe('Maintenance Middleware', () => {
  let originalEnv;

  before(() => {
    originalEnv = process.env.MAINTENANCE_MODE;
  });

  after(() => {
    process.env.MAINTENANCE_MODE = originalEnv;
  });

  test('should pass request through when MAINTENANCE_MODE is not true', () => {
    process.env.MAINTENANCE_MODE = 'false';
    let called = false;
    const req = { originalUrl: '/api/v1/auth/login' };
    const res = {};
    const next = () => { called = true; };

    checkMaintenance(req, res, next);
    assert.strictEqual(called, true);
  });

  test('should pass request through for health check even when maintenance is active', () => {
    process.env.MAINTENANCE_MODE = 'true';
    let called = false;
    const req = { originalUrl: '/api/v1/health' };
    const res = {};
    const next = () => { called = true; };

    checkMaintenance(req, res, next);
    assert.strictEqual(called, true);
  });

  test('should pass request through for logout even when maintenance is active', () => {
    process.env.MAINTENANCE_MODE = 'true';
    let called = false;
    const req = { originalUrl: '/api/v1/auth/logout' };
    const res = {};
    const next = () => { called = true; };

    checkMaintenance(req, res, next);
    assert.strictEqual(called, true);
  });

  test('should block other routes with 503 when maintenance is active', () => {
    process.env.MAINTENANCE_MODE = 'true';
    let nextCalled = false;
    const req = { originalUrl: '/api/v1/auth/login' };
    
    let responseStatus;
    let responseJson;
    
    const res = {
      status(code) {
        responseStatus = code;
        return this;
      },
      json(data) {
        responseJson = data;
        return this;
      }
    };
    const next = () => { nextCalled = true; };

    checkMaintenance(req, res, next);
    
    assert.strictEqual(nextCalled, false);
    assert.strictEqual(responseStatus, 503);
    assert.deepStrictEqual(responseJson, {
      success: false,
      maintenance: true,
      message: 'The platform is currently undergoing scheduled maintenance. Please check back later.'
    });
  });
});
