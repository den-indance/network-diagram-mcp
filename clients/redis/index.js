import redisCli from "./redis-cli.js";
import redisinsight from "./redisinsight.js";
import anotherRedis from "./another-redis.js";
import medis from "./medis.js";
import rdm from "./rdm.js";

// Priority: CLI first (zero config, cross-platform), then most-popular GUIs.
export default [redisCli, redisinsight, anotherRedis, medis, rdm];
