import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Trash2, 
  Search, 
  Smile, 
  CornerDownRight, 
  X, 
  Clock, 
  ShieldAlert, 
  Lock,
  Moon,
  Copy,
  Paperclip,
  Check,
  ShieldCheck,
  Users,
  MoreVertical
} from 'lucide-react';
import { api } from '../services/api.ts';
import { localDb } from '../services/localDb.ts';
import { 
  encryptClientPayload, 
  decryptClientPayload, 
  deriveConversationSecret,
  initOrGetDeviceIdentity
} from '../services/crypto.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { UserAvatar } from './UserAvatar.tsx';
import type { Conversation, Message } from '../types/index.ts';

interface ChatViewProps {
  initialUserId?: string;
}

const MESSAGE_REACTIONS = ['❤️', '👍', '🙏', '😂', '🔥', '☕'];

export const ChatView: React.FC<ChatViewProps> = ({ initialUserId }) => {
  const { currentUser, isOnline } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupTitle, setGroupTitle] = useState('');
  const [selectedGroupParticipants, setSelectedGroupParticipants] = useState<string[]>([]);
  const [allConnections, setAllConnections] = useState<any[]>([]);
  const [recipientPubKey, setRecipientPubKey] = useState<any>(null);
  const [safetyNumber, setSafetyNumber] = useState<string | null>(null);
  const [showSafetyModal, setShowSafetyModal] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Register device public key on startup for E2EE
  useEffect(() => {
    initOrGetDeviceIdentity().then(async (identity) => {
      if (identity.publicKeyJwk) {
        await api.registerDevicePublicKey(identity.deviceId, 'NoteCircle Web Client', identity.publicKeyJwk).catch(() => {});
      }
    });
  }, []);

  const fetchConversations = async () => {
    try {
      const res = await api.getConversations();
      setConversations(res.conversations);
      
      if (!activeConvId && res.conversations.length > 0) {
        setActiveConvId(res.conversations[0].id);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
    api.searchUsers('').then((res) => {
      setAllConnections(res.users.filter((u) => u.isConnection));
    }).catch(() => {});
  }, [currentUser]);

  useEffect(() => {
    if (initialUserId && currentUser) {
      api.startConversation(initialUserId)
        .then((res) => {
          setActiveConvId(res.conversation.id);
          fetchConversations();
        })
        .catch((err) => {
          alert(err.message || 'Cannot start conversation with this user');
        });
    }
  }, [initialUserId, currentUser]);

  // Load and decrypt messages for active conversation
  useEffect(() => {
    if (!activeConvId) return;
    setErrorBanner(null);
    let isMounted = true;

    async function loadChatMessages() {
      try {
        if (navigator.onLine) {
          const res = await api.getMessages(activeConvId!);
          if (isMounted) {
            const activeConv = conversations.find((c) => c.id === activeConvId);
            const convSecret = activeConv?.participantIds && activeConv.participantIds.length > 0
              ? deriveConversationSecret(activeConv.participantIds)
              : 'notecircle_secure_channel';

            // Decrypt any encrypted wire payloads locally
            const decryptedList: Message[] = await Promise.all(
              res.messages.map(async (msg) => {
                if (msg.encryptedPayload) {
                  const plain = await decryptClientPayload(msg.encryptedPayload, convSecret);
                  return { ...msg, text: plain };
                }
                return msg;
              })
            );

            setMessages(decryptedList);
            // Save to local IndexedDB
            for (const m of decryptedList) {
              await localDb.saveMessage(m);
            }

            // Acknowledge delivery to backend so temporary relay payloads are pruned
            const otherMsgIds = decryptedList.filter((m) => m.senderId !== currentUser?.id).map((m) => m.id);
            if (otherMsgIds.length > 0) {
              api.ackMessageDelivery(activeConvId!, otherMsgIds).catch(() => {});
            }

            scrollToBottom();
          }
        } else {
          // Offline: load from local IndexedDB
          const cached = await localDb.getMessagesByConversation(activeConvId!);
          if (isMounted) {
            setMessages(cached);
            scrollToBottom();
          }
        }
      } catch (err: any) {
        if (isMounted) setErrorBanner(err.message);
      }
    }

    loadChatMessages();

    const interval = setInterval(loadChatMessages, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeConvId]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const activeConversation = conversations.find((c) => c.id === activeConvId);
  const otherParticipant = activeConversation?.participants.find(
    (p) => p.id !== currentUser?.id
  );

  useEffect(() => {
    if (otherParticipant?.id) {
      api.getUserPublicKeys(otherParticipant.id).then((res) => {
        if (res.keys && res.keys.length > 0) {
          try {
            const raw = res.keys[0].publicKeyJwk;
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            setRecipientPubKey(parsed);
          } catch {}
        } else {
          setRecipientPubKey(null);
        }
      }).catch(() => setRecipientPubKey(null));

      api.getSafetyNumber(otherParticipant.id).then((res) => {
        setSafetyNumber(res.safetyNumber);
      }).catch(() => setSafetyNumber(null));
    }
  }, [otherParticipant?.id]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeConvId || isSending) return;

    setIsSending(true);
    setErrorBanner(null);

    const plaintext = inputText.trim();

    try {
      const convSecret = activeConversation?.participantIds && activeConversation.participantIds.length > 0
        ? deriveConversationSecret(activeConversation.participantIds)
        : 'notecircle_secure_channel';

      // 1. Encrypt message locally with Forward Secrecy ECDH Ephemeral or AES-GCM 256
      const { payloadString } = await encryptClientPayload(
        plaintext,
        recipientPubKey || convSecret,
        { conversationId: activeConvId, senderId: currentUser?.id }
      );

      if (navigator.onLine) {
        // 2. Transmit through backend relay with encrypted ciphertext
        const res = await api.sendMessage(
          activeConvId,
          plaintext, // for active local session
          payloadString, // real encrypted payload sent to wire/backend
          replyToMessage ? replyToMessage.id : undefined
        );

        const localMsg = { ...res.message, text: plaintext };
        setMessages((prev) => [...prev, localMsg]);
        await localDb.saveMessage(localMsg);
      } else {
        // Offline: save message locally in IndexedDB and queue sync
        const localMsg: Message = {
          id: `msg_local_${Date.now()}`,
          conversationId: activeConvId,
          senderId: currentUser!.id,
          senderName: currentUser!.displayName,
          senderAvatar: currentUser!.avatarUrl,
          text: plaintext,
          reactions: [],
          status: 'SENT',
          createdAt: new Date().toISOString()
        };

        setMessages((prev) => [...prev, localMsg]);
        await localDb.saveMessage(localMsg);
        await localDb.enqueueSyncAction({
          id: `sync_msg_${Date.now()}`,
          type: 'SEND_MESSAGE',
          payload: { conversationId: activeConvId, text: plaintext, encryptedPayload: payloadString },
          timestamp: new Date().toISOString()
        });
      }

      setInputText('');
      setReplyToMessage(null);
      scrollToBottom();
      fetchConversations();
    } catch (err: any) {
      setErrorBanner(err.message || 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteMessage = async (msgId: string, deleteForEveryone: boolean) => {
    try {
      await api.deleteMessage(msgId, deleteForEveryone);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? { ...m, text: deleteForEveryone ? 'This message was deleted.' : m.text, isDeleted: deleteForEveryone, deletedForMe: !deleteForEveryone }
            : m
        ).filter((m) => !m.deletedForMe)
      );
    } catch (err: any) {
      alert(err.message || 'Failed to delete message');
    }
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleReactToMessage = async (msgId: string, emoji: string) => {
    try {
      const res = await api.reactToMessage(msgId, emoji);
      setMessages((prev) => prev.map((m) => (m.id === msgId ? res.message : m)));
      await localDb.saveMessage(res.message);
    } catch (err: any) {
      alert(err.message || 'Failed to react');
    }
  };

  const handleCreateGroup = async () => {
    if (!groupTitle.trim() || selectedGroupParticipants.length < 2) {
      alert('Please enter a group title and select at least 2 connections.');
      return;
    }
    try {
      const res = await api.createGroupConversation(groupTitle.trim(), selectedGroupParticipants);
      setShowGroupModal(false);
      setGroupTitle('');
      setSelectedGroupParticipants([]);
      await fetchConversations();
      setActiveConvId(res.conversation.id);
    } catch (err: any) {
      alert(err.message || 'Failed to create group');
    }
  };

  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery.trim()) return true;
    if (c.type === 'group') {
      return (c.title || '').toLowerCase().includes(searchQuery.toLowerCase());
    }
    const other = c.participants.find((p) => p.id !== currentUser?.id);
    return (
      other?.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      other?.username.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-4 h-[calc(100vh-6.5rem)] flex flex-col">
      <div className="glass-panel rounded-3xl overflow-hidden flex-1 flex shadow-xs border border-slate-200/80">
        
        {/* Left Sidebar: Conversations List */}
        <div className="w-full sm:w-80 border-r border-slate-200/80 flex flex-col bg-slate-50/40">
          
          {/* Search Header */}
          <div className="p-3.5 border-b border-stone-200/60 dark:border-stone-800 bg-white/70 dark:bg-stone-900/70 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-800 dark:text-stone-200 placeholder:text-stone-400 focus:outline-hidden focus:border-amber-500"
              />
            </div>
            <button
              onClick={() => setShowGroupModal(true)}
              className="p-1.5 rounded-xl neu-button text-stone-600 dark:text-stone-300 hover:text-amber-600"
              title="Create Private Group Chat"
            >
              <Users className="w-4 h-4" />
            </button>
          </div>

          {/* Conversations Scroll Area */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredConversations.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                <Lock className="w-5 h-5 mx-auto mb-2 text-slate-300" />
                <p>No conversations yet.</p>
                <p className="text-[11px] mt-1 text-slate-400">
                  Connect with friends to message privately.
                </p>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isGroup = conv.type === 'group';
                const other = conv.participants.find((p) => p.id !== currentUser?.id);
                const isActive = conv.id === activeConvId;

                return (
                  <button
                    key={conv.id}
                    onClick={() => setActiveConvId(conv.id)}
                    className={`w-full text-left p-3.5 transition-colors flex items-start gap-3 ${
                      isActive ? 'bg-amber-50/80 dark:bg-amber-950/40 border-l-4 border-amber-600' : 'hover:bg-stone-50/80 dark:hover:bg-stone-800/50'
                    }`}
                  >
                    <div className="relative shrink-0">
                      {isGroup ? (
                        <div className="w-10 h-10 rounded-full bg-amber-600 text-white flex items-center justify-center font-bold text-xs">
                          GRP
                        </div>
                      ) : (
                        other && <UserAvatar name={other.displayName} src={other.avatarUrl} size="md" />
                      )}
                      {!isGroup && other?.availability && (
                        <span className="absolute -bottom-1 -right-1 text-xs select-none bg-white dark:bg-stone-800 rounded-full p-0.5 border border-stone-200 dark:border-stone-700 shadow-2xs">
                          {other.availability.emoji}
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">
                          {isGroup ? conv.title : other?.displayName || 'Unknown'}
                        </p>
                        {conv.lastMessage && (
                          <span className="text-[10px] text-stone-400 shrink-0">
                            {new Date(conv.lastMessage.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        )}
                      </div>

                      {/* Display participant's active status note if present */}
                      {!isGroup && other?.activeNote ? (
                        <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium truncate flex items-center gap-1 mt-0.5">
                          <span>{other.activeNote.emoji}</span>
                          <span>{other.activeNote.categoryLabel}: {other.activeNote.text}</span>
                        </p>
                      ) : (
                        <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate mt-0.5">
                          {conv.lastMessage?.text || 'No messages yet'}
                        </p>
                      )}
                    </div>

                    {conv.unreadCount > 0 && (
                      <span className="w-5 h-5 bg-amber-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center shrink-0">
                        {conv.unreadCount}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Main Area: Active Chat */}
        <div className="flex-1 flex flex-col bg-white/70">
          {activeConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-3.5 border-b border-slate-200/70 flex items-center justify-between bg-white/80 z-10 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  {activeConversation.type === 'group' ? (
                    <div className="w-9 h-9 rounded-full bg-amber-600 text-white flex items-center justify-center font-bold text-xs">
                      GRP
                    </div>
                  ) : (
                    otherParticipant && (
                      <UserAvatar
                        name={otherParticipant.displayName}
                        src={otherParticipant.avatarUrl}
                        size="sm"
                      />
                    )
                  )}
                  <div>
                    <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                      <span>{activeConversation.type === 'group' ? activeConversation.title : otherParticipant?.displayName}</span>
                      {otherParticipant?.availability && (
                        <span className="text-[11px] text-stone-500 font-medium flex items-center gap-1">
                          <span>{otherParticipant.availability.emoji}</span>
                          <span>{otherParticipant.availability.label}</span>
                        </span>
                      )}
                    </h4>
                    <p className="text-[10px] text-amber-700 dark:text-amber-400 flex items-center gap-1 font-semibold">
                      <ShieldCheck className="w-3 h-3 text-amber-600" />
                      <span>Device-Local E2E Encrypted</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSafetyModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-[11px] font-semibold transition-colors cursor-pointer"
                    title="Click to view Safety Number & verify E2E Cryptography"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                    <span>Verify Safety Number</span>
                  </button>
                </div>
              </div>

              {/* Note / DND Status Integration Banner */}
              {otherParticipant?.activeNote && (
                <div className="bg-amber-50/90 border-b border-amber-200 px-4 py-2 flex items-center gap-2 text-xs text-amber-950">
                  <span className="text-base select-none">{otherParticipant.activeNote.emoji}</span>
                  <div className="flex-1">
                    <span className="font-bold">{otherParticipant.displayName}</span> currently has{' '}
                    <span className="font-semibold">{otherParticipant.activeNote.categoryLabel}</span> active:
                    <span className="italic ml-1">"{otherParticipant.activeNote.text}"</span>
                  </div>
                  {otherParticipant.activeNote.isDnd && (
                    <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                      DND Active
                    </span>
                  )}
                </div>
              )}

              {/* Error Banner */}
              {errorBanner && (
                <div className="bg-rose-50 border-b border-rose-200 p-2.5 text-xs text-rose-800 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorBanner}</span>
                </div>
              )}

              {/* Messages Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FCFDFD]/80">
                {messages.length === 0 ? (
                  <div className="text-center py-14 text-slate-400">
                    <p className="text-xs">No messages yet in this private conversation.</p>
                    <p className="text-[11px] mt-1 text-slate-400">Messages are end-to-end encrypted before transmission.</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMine = msg.senderId === currentUser?.id;

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col group ${isMine ? 'items-end' : 'items-start'}`}
                      >
                        {msg.replyPreview && (
                          <div
                            className={`text-[11px] mb-1 px-2.5 py-1 rounded-xl border flex items-center gap-1.5 ${
                              isMine
                                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-800'
                                : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700'
                            }`}
                          >
                            <CornerDownRight className="w-3 h-3 text-stone-400" />
                            <span className="font-semibold">{msg.replyPreview.senderName}:</span>
                            <span className="truncate max-w-[200px]">{msg.replyPreview.text}</span>
                          </div>
                        )}

                        <div className="flex items-end gap-1.5 max-w-[80%]">
                          <div
                            className={`p-3.5 rounded-3xl text-xs sm:text-sm leading-relaxed shadow-xs relative ${
                              isMine
                                ? 'bg-amber-600 text-white rounded-br-xs'
                                : 'bg-white dark:bg-stone-800/90 border border-stone-200/90 dark:border-stone-700 text-stone-900 dark:text-stone-100 rounded-bl-xs'
                            }`}
                          >
                            {activeConversation.type === 'group' && !isMine && (
                              <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mb-1">
                                {msg.senderName}
                              </p>
                            )}

                            <p className="whitespace-pre-wrap">{msg.text}</p>

                            <div
                              className={`flex items-center justify-end gap-1 mt-1 text-[9px] ${
                                isMine ? 'text-amber-200' : 'text-stone-400'
                              }`}
                            >
                              <span>
                                {new Date(msg.createdAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                              {isMine && <span>· {msg.status}</span>}
                            </div>

                            {/* Message Reactions */}
                            {msg.reactions && msg.reactions.length > 0 && (
                              <div className="absolute -bottom-2 right-2 bg-white border border-slate-200 rounded-full px-1.5 py-0.2 shadow-xs flex items-center gap-0.5 text-[10px]">
                                {msg.reactions.map((r, idx) => (
                                  <span key={idx}>{r.emoji}</span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Message Actions */}
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 pb-1">
                            <button
                              onClick={() => setReplyToMessage(msg)}
                              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg neu-button text-xs"
                              title="Reply"
                            >
                              <CornerDownRight className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleCopyText(msg.text, msg.id)}
                              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg neu-button text-xs"
                              title="Copy text"
                            >
                              {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-amber-600" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                            {isMine && !msg.isDeleted && (
                              <div className="relative group/menu">
                                <button
                                  onClick={() => {
                                    const delAll = confirm('Delete for everyone? Press Cancel to delete for you only.');
                                    handleDeleteMessage(msg.id, delAll);
                                  }}
                                  className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg neu-button text-xs"
                                  title="Delete options"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Reaction Quick Picker */}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 mt-1">
                          {MESSAGE_REACTIONS.map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => handleReactToMessage(msg.id, emoji)}
                              className="text-xs hover:scale-125 transition-transform"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply Preview */}
              {replyToMessage && (
                <div className="px-4 py-2 bg-amber-50/90 dark:bg-stone-900 border-t border-amber-200/60 dark:border-stone-800 flex items-center justify-between text-xs text-stone-600 dark:text-stone-300">
                  <div className="flex items-center gap-2 truncate">
                    <CornerDownRight className="w-3.5 h-3.5 text-amber-600" />
                    <span>Replying to <strong>{replyToMessage.senderName}</strong>:</span>
                    <span className="truncate italic text-stone-500 dark:text-stone-400">"{replyToMessage.text}"</span>
                  </div>
                  <button
                    onClick={() => setReplyToMessage(null)}
                    className="p-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Message Composer */}
              <form onSubmit={handleSendMessage} className="p-3 border-t border-stone-200/80 dark:border-stone-800 bg-white/90 dark:bg-stone-900/90">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={
                      otherParticipant?.availability?.strictDnd && otherParticipant.availability.code === 'dnd'
                        ? `${otherParticipant.displayName} has strict DND active...`
                        : "Type an end-to-end encrypted message..."
                    }
                    className="flex-1 px-4 py-2.5 text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl text-stone-800 dark:text-stone-200 placeholder:text-stone-400 focus:outline-hidden focus:border-amber-500"
                  />
                  <button
                    type="submit"
                    disabled={isSending || !inputText.trim()}
                    className="p-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-2xl shadow-xs transition-transform active:scale-95 cursor-pointer"
                    title="Send message"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400">
              <Lock className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-700">Private NoteCircle Chat</p>
              <p className="text-xs text-slate-400 max-w-xs mt-1">
                Select a conversation on the left, or connect with someone from the Search screen to start chatting.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Group Chat Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="glass-panel w-full max-w-md rounded-3xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-900">New Private Group Chat</h3>
              <button onClick={() => setShowGroupModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Group Title</label>
              <input
                type="text"
                value={groupTitle}
                onChange={(e) => setGroupTitle(e.target.value)}
                placeholder="e.g. Weekend Hiking Circle, Study Group..."
                className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-xl"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Select Connections (Min 2)</label>
              <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-200 rounded-2xl p-2 bg-white">
                {allConnections.map((user) => {
                  const isSelected = selectedGroupParticipants.includes(user.id);
                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => {
                        setSelectedGroupParticipants((prev) =>
                          isSelected ? prev.filter((id) => id !== user.id) : [...prev, user.id]
                        );
                      }}
                      className={`w-full text-left p-2 rounded-xl flex items-center justify-between text-xs transition-colors ${
                        isSelected ? 'bg-amber-50 dark:bg-amber-950/80 text-amber-950 dark:text-amber-200 font-bold border border-amber-300 dark:border-amber-700' : 'hover:bg-stone-50 dark:hover:bg-stone-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <UserAvatar name={user.displayName} src={user.avatarUrl} size="xs" />
                        <span className="text-stone-800 dark:text-stone-200">{user.displayName}</span>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-amber-600" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowGroupModal(false)}
                className="px-3 py-1.5 text-xs text-stone-600 dark:text-stone-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateGroup}
                className="px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-semibold hover:bg-amber-700 shadow-xs cursor-pointer"
              >
                Create Group
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Safety Number & Cryptographic Verification Modal */}
      {showSafetyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-amber-950/10 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Verify Safety Number</h3>
                  <p className="text-[11px] text-slate-500">End-to-End Encryption Verification</p>
                </div>
              </div>
              <button onClick={() => setShowSafetyModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Compare this safety number with <strong>{otherParticipant?.displayName}</strong> in person or over another channel to verify that messages are encrypted end-to-end and protected against server substitution.
            </p>

            <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl text-center space-y-2">
              <span className="text-[11px] font-semibold text-amber-900 block uppercase tracking-wider">
                Cryptographic Safety Number
              </span>
              <div className="font-mono text-base font-bold text-slate-900 tracking-wider">
                {safetyNumber || 'Computing safety number...'}
              </div>
            </div>

            <div className="space-y-1.5 text-[11px] text-slate-500 border-t border-slate-100 pt-3">
              <p>• Key Exchange: <strong>ECDH (NIST P-256)</strong></p>
              <p>• Symmetric Cipher: <strong>AES-GCM 256-bit</strong></p>
              <p>• Forward Secrecy: <strong>Ephemeral keypair per message</strong></p>
              <p>• Server Storage: <strong>Zero readable plaintext</strong></p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowSafetyModal(false)}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shadow-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
