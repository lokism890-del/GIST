declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_SUPABASE_URL: string;
    NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
    NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: string;
    NEXT_PUBLIC_PADDLE_PRICE_ID: string;
    NEXT_PUBLIC_PADDLE_ENV: string;
    PADDLE_API_KEY: string;
    PADDLE_WEBHOOK_SECRET_KEY: string;
  }
}