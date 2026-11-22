import test from 'node:test';
import assert from 'node:assert/strict';

// dotenv never overrides vars that are already set, so these win over server/.env.
process.env.USE_REDIS = 'false';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ||= 'postgres://test';
process.env.APP_JWT_SECRET ||= 'test';

const { isOpenForDelivery } = await import('./deliveries.js');

const now = Date.parse('2026-11-22T12:00:00Z');
const row = (over = {}) => ({
  ride_accepts_delivery: true,
  ride_max_delivery_slots: 3,
  ride_delivery_slots_taken: 2,
  ride_departure_time: '2026-11-22T13:00:00Z',
  ...over,
});

test('offers a future ride with a free slot', () => {
  assert.equal(isOpenForDelivery(row(), now), true);
});

test('hides rides CreateDelivery would refuse or that already left', () => {
  assert.equal(isOpenForDelivery(row({ ride_accepts_delivery: false }), now), false);
  assert.equal(isOpenForDelivery(row({ ride_delivery_slots_taken: 3 }), now), false);
  assert.equal(isOpenForDelivery(row({ ride_departure_time: '2026-11-22T11:59:00Z' }), now), false);
});
