import { Router } from 'express';
import { getAuthUser } from './auth.ts';

export const supportRouter = Router();

const FAQS = [
  {
    q: 'Why are all accounts private by default on NoteCircle?',
    a: 'NoteCircle was designed specifically to eliminate public performance metrics, follower competitions, and unsolicited discovery. Your thoughts and availability updates should only be visible to people you consciously verify.'
  },
  {
    q: 'What is the Local-First and Privacy-First architecture?',
    a: 'Unlike traditional social networks that permanently archive your private communications in plaintext on remote servers, NoteCircle stores your active notes, drafts, and chats primarily in your device’s secure local storage (IndexedDB on Web, Keystore/Room on Android). Messages are end-to-end encrypted before wire transit, and server relay data is ephemeral.'
  },
  {
    q: 'How does Note Expiration work?',
    a: 'When you create a note, you choose an availability window (e.g. 1 hour, 6 hours, 1 day, 3 days). Once expired, the note automatically disappears from your circle’s feed. You can always view or repost past notes from your local My Notes archive.'
  },
  {
    q: 'What does Strict Do Not Disturb do?',
    a: 'When you set an Availability Status or Note to Do Not Disturb / Sleeping and enable "Strict DND Mode", NoteCircle will reject incoming messages until your status expires, protecting your peace of mind.'
  },
  {
    q: 'How does Close Friends audience work?',
    a: 'You can hand-select Close Friends among your approved connections. Notes posted with the "Close Friends" audience are strictly visible to them; normal followers cannot view them.'
  }
];

const POLICIES = {
  terms: `NoteCircle Terms of Service (Updated 2026)\n\n1. Private Connection Agreement: NoteCircle is a private, calm communications network. Commercial advertising, scraping, automated bots, harassment, and unauthorized disclosure of members' private notes are strictly prohibited.\n2. User Authorization: Content shared with your approved circle is licensed solely for display within that circle. Zero public feeds or syndication are permitted.\n3. Account Termination: Users may delete their accounts and local data at any time via Account Settings.`,
  privacyPolicy: `NoteCircle Local-First Privacy Policy\n\n1. Architecture: NoteCircle employs a Local-First + Minimal Server storage paradigm. Private status notes, drafts, and conversation histories are persisted on your local device.\n2. Server Storage: The backend retains only identity tokens, cryptographic hashes of credentials, connection status records, and ephemeral encrypted transit envelopes.\n3. Zero Profiling: We do not track cross-site behavior, sell personal telemetry, or run recommendation algorithms.\n4. Data Portability: You can download your full personal data archive anytime via Account Settings (GDPR Article 20 compliant).`,
  communityGuidelines: `Community Guidelines:\n• Respect private boundaries: Do not screenshot or share friends' private availability notes without their permission.\n• No harassment, hate speech, spam, or impersonation.\n• Maintain a calm, low-pressure atmosphere.`
};

supportRouter.get('/faqs', (_req, res) => {
  return res.json({ faqs: FAQS });
});

supportRouter.get('/policies', (_req, res) => {
  return res.json({ policies: POLICIES });
});

supportRouter.post('/tickets', (req, res) => {
  const viewer = getAuthUser(req);
  const { subject, message, email } = req.body;

  if (!subject || !message) {
    return res.status(400).json({ error: 'Subject and message are required' });
  }

  const ticket = {
    id: `ticket_${Date.now()}`,
    userId: viewer?.id || 'anonymous',
    username: viewer?.username || 'guest',
    email: email || viewer?.email,
    subject: subject.trim(),
    message: message.trim(),
    status: 'SUBMITTED',
    createdAt: new Date().toISOString()
  };

  return res.status(201).json({ success: true, ticket });
});
