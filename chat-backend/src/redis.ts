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
// biome-ignore lint/suspicious/noExplicitAny : message
export async function publishMessage(channel: string, message: any) {
  await redisClient.publish(channel, JSON.stringify(message));
}

// Subscribe to messages
// biome-ignore lint/suspicious/noExplicitAny : message
export function subscribeToMessages(callback: (message: any) => void) {
  const subscriber = redisClient.duplicate();
  subscriber.connect().then(() => {
    subscriber.subscribe("messages", (message: string) => {
      try {
        callback(JSON.parse(message));
      } catch (err) {
        console.error("Failed to parse message:", err);
      }
    });
  });

  return subscriber;
}

export default redisClient;
