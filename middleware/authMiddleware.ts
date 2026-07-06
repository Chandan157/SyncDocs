import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  try {
    let token = null;

    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.session) {
      token = req.cookies.session;
    }

    if (!token) {
      res.status(401).json({ error: 'Unauthorized: No token provided' });
      return;
    }
    
    const secretKey = process.env.JWT_SECRET || 'super-secret-key-for-local-dev';
    const decoded = jwt.verify(token, secretKey);
    
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
    return;
  }
};
