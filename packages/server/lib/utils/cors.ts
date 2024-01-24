import { CorsOptions } from 'cors';

export const corsOptions: CorsOptions = {
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
};
