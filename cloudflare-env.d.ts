declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    GROQ_API_KEY?: string;
    BUCKET?: R2Bucket;
  }
}
