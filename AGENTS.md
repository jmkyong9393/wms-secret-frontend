<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# JWT Authentication Architecture Rule
When handling JWT authentication in this project, DO NOT store tokens in `sessionStorage` or `localStorage`. 
- **Storage**: Store the JWT exclusively in an `HttpOnly`, `Secure` Cookie. This allows Next.js Edge Middleware to read it safely while preventing XSS attacks.
- **Expiration**: Rely entirely on the JWT's `exp` (Expiration) claim.
- **Logout Flow**: When the token expires, the backend will return a `401 Unauthorized` error. The frontend must catch this `401` error globally (e.g., using an Axios Interceptor), clear the state/cookie, and redirect the user to `/login`. Do not manage timeouts manually in the frontend state.
