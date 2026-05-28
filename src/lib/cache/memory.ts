import NodeCache from 'node-cache';

// TTL: 3 hours = 10800 seconds
export const memoryCache = new NodeCache({ stdTTL: 10800, checkperiod: 1200 });
