const test = require("node:test");
const assert = require("node:assert/strict");

const cron = require("node-cron");

const { CRON_SCHEDULES } = require("../src/jobs/cronScheduler");

test("Cron: all configured expressions are valid", () => {
  for (const expression of CRON_SCHEDULES) {
    assert.equal(
      cron.validate(expression),
      true,
      `Invalid cron expression: ${expression}`,
    );
  }
});

test("Cron: schedule stops at 18:00 IST and runs weekdays only", () => {
  assert.deepEqual(CRON_SCHEDULES, ["0,30 9-17 * * 1-5", "0 18 * * 1-5"]);
});
