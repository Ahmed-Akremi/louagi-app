import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The admin dashboard is a client SPA talking to the Louagi CQRS backend over
  // HTTP. No image optimization or special server features needed.
  poweredByHeader: false,
  // Pin the file-tracing root to this project (the parent dir contains other
  // lockfiles, which would otherwise be inferred as the workspace root).
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
