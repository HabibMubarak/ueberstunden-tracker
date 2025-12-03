import { Request, Response, NextFunction } from 'express';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  // @ts-ignore - express-session types
  if (req.session.authenticated) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
}
