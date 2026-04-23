import { createClient } from "redis";

const redisClient = createClient({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
  socket: {
    reconnectStrategy: (retries: number) => Math.min(retries * 50, 500),
  },
});

redisClient.on("error", (err) => console.error("Redis error:", err));
redisClient.on("connect", () => console.log("✓ Connected to Redis"));

// Connect to Redis
export async function connectRedis() {
  await redisClient.connect();
}

// Publish a message to the channel
export async function publishMessage(channel: string, message: unknown) {
  await redisClient.publish(channel, JSON.stringify(message));
}

// Subscribe to messages
export function subscribeToMessages(callback: (message: unknown) => void) {
  const subscriber = redisClient.duplicate();

  const safeDisconnect = (reason: string) => {
    subscriber.disconnect().catch((err) => {
      console.error(`subscriber disconnect failed after ${reason}:`, err);
    });
  };

  subscriber.connect().then(() => {
    subscriber.subscribe("messages", (message: string) => {
      try {
        callback(JSON.parse(message));
      } catch (err) {
        console.error("Failed to parse message:", err);
      }
    }).catch((err) => {
      console.error("subscriber subscribe failed", err);
      safeDisconnect("subscribe error");
    });
  }).catch((err) => {
    console.error("subscriber connect failed", err);
    safeDisconnect("connect error");
  });

  return subscriber;
}

export default redisClient;
