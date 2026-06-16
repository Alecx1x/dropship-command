import { handlers } from "@/auth";

// NextAuth's own endpoints (signin, callback, session, csrf, etc.).
export const { GET, POST } = handlers;
