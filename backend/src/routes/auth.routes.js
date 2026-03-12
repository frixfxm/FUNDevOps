import { Router } from 'express';
import { loginUser } from '../services/auth.service.js';

const router = Router();

router.post('/login', async (req, res) => {
  const { login, password } = req.body ?? {};

  if (!login || !password) {
    return res.status(400).json({ message: 'login and password are required' });
  }

  const result = await loginUser(login, password);

  if (!result) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  return res.json(result);
});

export default router;
