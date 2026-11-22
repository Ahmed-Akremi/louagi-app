// Client-safe config. NEXT_PUBLIC_* values are inlined into the browser bundle
// at build time. The browser makes data calls directly to `${API_URL}/graphql`
// with a Bearer access token, so the backend's CORS_ORIGINS must allow this
// app's origin.
export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"
).replace(/\/$/, "");
