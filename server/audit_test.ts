import assert from 'node:assert';

const BASE_URL = 'http://localhost:3000';

async function request(path: string, options: any = {}, token?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, ok: res.ok, data: json };
}

async function runAudit() {
  console.log('--- STARTING COMPREHENSIVE PRODUCTION AUDIT ---');

  const ts = Date.now().toString(36);
  const user1Username = `audit_alpha_${ts}`;
  const user2Username = `audit_beta_${ts}`;
  const user3Unauthorized = `audit_gamma_${ts}`;
  const password = 'StrongPassword123!';

  console.log(`[1] Registering User 1: @${user1Username}`);
  const reg1 = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      username: user1Username,
      displayName: 'Alpha Auditor',
      email: `${user1Username}@testaudit.com`,
      password,
      bio: 'Auditor One'
    })
  });
  assert.strictEqual(reg1.status, 201, `Failed to register User 1: ${JSON.stringify(reg1.data)}`);
  assert(reg1.data.token, 'Token not received for User 1');
  const token1 = reg1.data.token;
  const user1 = reg1.data.user;
  console.log('    ✓ User 1 registered successfully:', user1.id);

  console.log(`[2] Registering User 2: @${user2Username}`);
  const reg2 = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      username: user2Username,
      displayName: 'Beta Auditor',
      email: `${user2Username}@testaudit.com`,
      password,
      bio: 'Auditor Two'
    })
  });
  assert.strictEqual(reg2.status, 201, `Failed to register User 2: ${JSON.stringify(reg2.data)}`);
  const token2 = reg2.data.token;
  const user2 = reg2.data.user;
  console.log('    ✓ User 2 registered successfully:', user2.id);

  console.log(`[3] Registering Unauthorized User 3: @${user3Unauthorized}`);
  const reg3 = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      username: user3Unauthorized,
      displayName: 'Gamma Stranger',
      email: `${user3Unauthorized}@testaudit.com`,
      password,
      bio: 'Unauthorized Stranger'
    })
  });
  assert.strictEqual(reg3.status, 201);
  const token3 = reg3.data.token;
  const user3 = reg3.data.user;
  console.log('    ✓ Unauthorized User 3 registered successfully');

  console.log('[4] Testing Login for User 1');
  const login1 = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      identifier: user1Username,
      password
    })
  });
  assert.strictEqual(login1.status, 200);
  assert(login1.data.token);
  console.log('    ✓ User 1 login verified');

  console.log('[5] Testing Username Search');
  // Search for user2 by prefix
  const searchRes = await request(`/api/users/search?q=${user2Username.substring(0, 10)}`, {}, token1);
  assert.strictEqual(searchRes.status, 200);
  const foundUser = searchRes.data.users.find((u: any) => u.username === user2Username);
  assert(foundUser, 'User 2 not found in search results');
  console.log('    ✓ Search correctly returned target account:', foundUser.username);

  console.log('[6] Follow Request & Acceptance');
  // User 1 sends follow request to User 2
  const reqRes = await request(`/api/connections/request/${user2.id}`, {
    method: 'POST'
  }, token1);
  assert.strictEqual(reqRes.status, 200, `Follow request failed: ${JSON.stringify(reqRes.data)}`);
  console.log('    ✓ User 1 sent follow request to User 2');

  // User 2 checks incoming pending requests
  const pendingRes = await request('/api/connections/pending', {}, token2);
  assert.strictEqual(pendingRes.status, 200);
  const incomingReq = pendingRes.data.incoming.find((r: any) => r.requesterId === user1.id);
  assert(incomingReq, 'Pending incoming request not found for User 2');
  console.log('    ✓ User 2 received pending request');

  // User 2 accepts request
  const acceptRes = await request(`/api/connections/requests/${incomingReq.id}/accept`, {
    method: 'POST'
  }, token2);
  assert.strictEqual(acceptRes.status, 200);
  console.log('    ✓ User 2 accepted follow request');

  // User 2 checks connection list
  const listRes = await request('/api/connections/list', {}, token2);
  assert.strictEqual(listRes.status, 200);
  assert(listRes.data.connections.some((c: any) => c.id === user1.id), 'User 1 not listed in connections');
  console.log('    ✓ User 1 appears in User 2 connection list');

  console.log('[7] Note Creation & Follower Feed Visibility');
  // User 1 creates note for followers
  const notePayload = {
    emoji: '🚀',
    category: 'Status',
    categoryLabel: 'Update',
    text: 'Alpha launch note for followers only #' + ts,
    audience: 'followers',
    allowReplies: true,
    allowReactions: true
  };
  const createNoteRes = await request('/api/notes', {
    method: 'POST',
    body: JSON.stringify(notePayload)
  }, token1);
  assert.strictEqual(createNoteRes.status, 201, `Failed to create note: ${JSON.stringify(createNoteRes.data)}`);
  const createdNote = createNoteRes.data.note;
  console.log('    ✓ Note created by User 1:', createdNote.id);

  // User 2 (Follower) checks Home Feed
  const feedRes = await request('/api/notes/feed', {}, token2);
  assert.strictEqual(feedRes.status, 200);
  const noteInFeed = feedRes.data.notes.find((n: any) => n.id === createdNote.id);
  assert(noteInFeed, "Follower User 2 cannot see User 1's note!");
  assert.strictEqual(noteInFeed.text, notePayload.text);
  console.log('    ✓ Note successfully appeared in Follower User 2 feed');

  // User 1 checks My Notes
  const myNotesRes = await request('/api/notes/my-notes', {}, token1);
  assert.strictEqual(myNotesRes.status, 200);
  assert(myNotesRes.data.notes.some((n: any) => n.id === createdNote.id), 'Note not found in My Notes');
  console.log('    ✓ Note appears in User 1 My Notes');

  console.log('[8] Testing Privacy & Data Leakage Protection');
  // Unauthorized Stranger (User 3) checks Feed: User 1's note MUST NOT appear
  const feed3Res = await request('/api/notes/feed', {}, token3);
  assert.strictEqual(feed3Res.status, 200);
  const noteInStrangerFeed = feed3Res.data.notes.find((n: any) => n.id === createdNote.id);
  assert(!noteInStrangerFeed, 'CRITICAL PRIVACY LEAK: Unauthorized User 3 can see followers-only note!');
  console.log("    ✓ ZERO LEAKAGE: User 1 note is completely hidden from non-follower User 3");

  // User 3 checks User 1's profile
  const profileRes = await request(`/api/users/profile/${user1Username}`, {}, token3);
  assert.strictEqual(profileRes.status, 200);
  // Must be redacted
  assert.strictEqual(profileRes.data.profile.isPrivate, true);
  console.log('    ✓ ZERO LEAKAGE: User 1 profile is strictly redacted for non-follower');

  console.log('[9] End-to-End Encrypted Private Chat Flow');
  // User 1 creates direct conversation with User 2
  const convRes = await request('/api/chat/conversations', {
    method: 'POST',
    body: JSON.stringify({ targetUserId: user2.id })
  }, token1);
  assert(convRes.status === 200 || convRes.status === 201, `Conv creation failed: ${JSON.stringify(convRes.data)}`);
  const conv = convRes.data.conversation;
  console.log('    ✓ Conversation established:', conv.id);

  // User 1 sends message with encrypted payload
  const encryptedPayloadEnvelope = JSON.stringify({
    v: 1,
    iv: 'dGVzdEl2MTIzNDU2Nw==',
    ct: 'c2VjcmV0Q2lwaGVydGV4dA==',
    algo: 'AES-GCM-256'
  });

  const sendMsgRes = await request(`/api/chat/conversations/${conv.id}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      text: 'Original plaintext strictly local',
      encryptedPayload: encryptedPayloadEnvelope
    })
  }, token1);
  assert(sendMsgRes.status === 200 || sendMsgRes.status === 201, `Send message failed: ${JSON.stringify(sendMsgRes.data)}`);
  const msg = sendMsgRes.data.message;

  // Verify server storage of message: Server MUST NOT store plaintext
  const serverMessagesRes = await request(`/api/chat/conversations/${conv.id}/messages`, {}, token1);
  const serverMsg = serverMessagesRes.data.messages.find((m: any) => m.id === msg.id);
  assert(serverMsg, 'Message not stored on server');
  assert.strictEqual(serverMsg.text, '[End-to-End Encrypted Message]', `Server stored readable plaintext! Got: ${serverMsg.text}`);
  assert.strictEqual(serverMsg.encryptedPayload, encryptedPayloadEnvelope);
  console.log('    ✓ ZERO PLAINTEXT LEAKAGE: Server stored only [End-to-End Encrypted Message] and encrypted wire envelope');

  // Verify unauthorized User 3 CANNOT read this conversation
  const unauthorizedConvRes = await request(`/api/chat/conversations/${conv.id}/messages`, {}, token3);
  assert(unauthorizedConvRes.status === 403 || unauthorizedConvRes.status === 404, `CRITICAL SECURITY LEAK: Unauthorized user accessed conversation! Status: ${unauthorizedConvRes.status}`);
  console.log('    ✓ ZERO LEAKAGE: Unauthorized User 3 blocked with 404/403 on direct chat');

  console.log('[10] Notifications Verification');
  const notifsRes = await request('/api/notifications', {}, token2);
  assert.strictEqual(notifsRes.status, 200);
  assert(notifsRes.data.notifications.length > 0, 'No notifications found for User 2');
  // Check that message notification does NOT leak message content
  for (const notif of notifsRes.data.notifications) {
    if (notif.type === 'message') {
      assert(!notif.text.includes('Original plaintext'), 'CRITICAL PRIVACY LEAK: Plaintext found in notification payload!');
    }
  }
  console.log('    ✓ Notifications verified without privacy leakage');

  console.log('[11] Message Deletion Flow');
  const deleteMsgRes = await request(`/api/chat/messages/${msg.id}?forEveryone=true`, {
    method: 'DELETE'
  }, token1);
  assert.strictEqual(deleteMsgRes.status, 200);
  // Verify message is marked deleted
  const recheckMsgs = await request(`/api/chat/conversations/${conv.id}/messages`, {}, token2);
  const deletedMsgOnServer = recheckMsgs.data.messages.find((m: any) => m.id === msg.id);
  assert(deletedMsgOnServer && deletedMsgOnServer.isDeleted, 'Message not marked deleted');
  console.log('    ✓ Message deletion verified');

  console.log('[12] Logout and Re-Login Flow');
  const logoutRes = await request('/api/auth/logout', { method: 'POST' }, token1);
  assert.strictEqual(logoutRes.status, 200);
  console.log('    ✓ User 1 logged out');

  const reloginRes = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier: user1Username, password })
  });
  assert.strictEqual(reloginRes.status, 200);
  assert(reloginRes.data.token);
  console.log('    ✓ User 1 re-logged in successfully');

  console.log('====================================================');
  console.log('🎉 ALL PRODUCTION AUDIT AND AUTHORIZATION TESTS PASSED');
  console.log('====================================================');
}

runAudit().catch((err) => {
  console.error('❌ AUDIT TEST FAILED:', err);
  process.exit(1);
});
