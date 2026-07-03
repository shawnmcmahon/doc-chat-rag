import { config as loadEnv } from "dotenv";

import { ensurePineconeIndex } from "../lib/pinecone";

loadEnv({ path: ".env.local" });

async function main() {
  console.info("Ensuring Pinecone integrated index exists...");
  await ensurePineconeIndex();
  console.info("Pinecone index is ready.");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
