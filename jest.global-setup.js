'use strict';

// Run every Jest suite in a far-from-UTC zone (UTC+14), so a test that relies on
// local time fails if the code under test uses UTC instead. CI runs in UTC, where
// both give the same date. Setting TZ inside a test file has no effect, so it is
// set here, before Jest starts its workers.
module.exports = () => {
  process.env.TZ = 'Pacific/Kiritimati';
};
