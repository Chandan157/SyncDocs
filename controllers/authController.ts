import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

const secretKey = process.env.JWT_SECRET || 'super-secret-key-for-local-dev';

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Missing fields' });
      return;
    }

    const userArray = await db.query.users.findMany({ where: eq(users.email, email) });
    const user = userArray[0];
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = jwt.sign({ sub: user.id, email: user.email }, secretKey, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (error) {
    console.error('Error in login:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Missing fields' });
      return;
    }

    const existingArray = await db.query.users.findMany({ where: eq(users.email, email) });
    if (existingArray.length > 0) {
      res.status(400).json({ error: 'User already exists' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [newUser] = await db.insert(users).values({
      email,
      password: hashedPassword,
    }).returning();

    const token = jwt.sign({ sub: newUser.id, email: newUser.email }, secretKey, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: newUser.id, email: newUser.email } });
  } catch (error) {
    console.error('Error in register:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getMe = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const userArray = await db.query.users.findMany({ where: eq(users.id, userId) });
    const user = userArray[0];
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ id: user.id, email: user.email });
  } catch (error) {
    console.error('Error in getMe:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getToken = (req: Request, res: Response) => {
  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies && req.cookies.session) {
    token = req.cookies.session;
  }

  if (token) {
    res.json({ token });
  } else {
    res.status(401).json({ error: 'No token found' });
  }
};
