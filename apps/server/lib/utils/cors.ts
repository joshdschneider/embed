import { CorsOptions } from 'cors';

export const corsOptions: CorsOptions = {
  origin: ['http://localhost:3000', 'https://app.useembed.com'],
  credentials: true,
};
