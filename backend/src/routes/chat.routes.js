import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { createMessage, getMessages, getUsers } from '../services/chat.service.js';

const router = Router();

router.use(requireAuth);

router.get('/users', async (req, res) => {
  const users = await getUsers(req.user.id);
  res.json(users);
});

router.get('/messages/:peerId', async (req, res) => {
  const peerId = Number(req.params.peerId);

  if (Number.isNaN(peerId)) {
    return res.status(400).json({ message: 'Invalid peer id' });
  }

  const messages = await getMessages(req.user.id, peerId);
  res.json(messages);
});

router.post('/messages', async (req, res) => {
  const { receiverId, body } = req.body ?? {};

  if (!receiverId || !body?.trim()) {
    return res.status(400).json({ message: 'receiverId and body are required' });
  }

  const message = await createMessage(req.user.id, Number(receiverId), body.trim());
  res.status(201).json(message);
});

export default router;
