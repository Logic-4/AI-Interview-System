const test = require('node:test');
const assert = require('node:assert/strict');
const Application = require('../models/Application');
const controller = require('../controllers/companyPortalController');

function createResponse() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('Candidates excludes shortlisted applications', async () => {
  const originalFind = Application.find;
  let filter;
  Application.find = (query) => {
    filter = query;
    const chain = {
      populate: () => chain,
      sort: () => chain,
      lean: async () => [],
    };
    return chain;
  };

  try {
    const response = createResponse();
    await controller.getCandidates({ query: {}, companyId: 'company-1' }, response, (error) => { throw error; });
    assert.deepEqual(filter, { company: 'company-1', isShortlisted: { $ne: true } });
    assert.equal(response.body.data.candidates.length, 0);
  } finally {
    Application.find = originalFind;
  }
});

test('Adding a candidate to the shortlist marks the application as shortlisted', async () => {
  const originalFindOne = Application.findOne;
  const application = {
    isShortlisted: false,
    status: 'applied',
    save: async () => {},
  };
  Application.findOne = async () => application;

  try {
    const response = createResponse();
    await controller.toggleShortlist({ params: { id: 'application-1' }, companyId: 'company-1' }, response, (error) => { throw error; });
    assert.equal(application.isShortlisted, true);
    assert.equal(application.status, 'shortlisted');
    assert.match(response.body.message, /added to shortlist/i);
  } finally {
    Application.findOne = originalFindOne;
  }
});

test('Removing a shortlisted candidate returns them to under review', async () => {
  const originalFindOne = Application.findOne;
  const application = {
    isShortlisted: true,
    status: 'shortlisted',
    save: async () => {},
  };
  Application.findOne = async () => application;

  try {
    const response = createResponse();
    await controller.toggleShortlist({ params: { id: 'application-1' }, companyId: 'company-1' }, response, (error) => { throw error; });
    assert.equal(application.isShortlisted, false);
    assert.equal(application.status, 'under_review');
    assert.match(response.body.message, /removed from shortlist/i);
  } finally {
    Application.findOne = originalFindOne;
  }
});
