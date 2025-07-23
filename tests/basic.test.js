const { expect } = require('chai');

describe('Basic Test Suite', () => {
  it('should pass a basic test', () => {
    expect(true).to.be.true;
  });

  it('should do basic math', () => {
    expect(2 + 2).to.equal(4);
  });
});