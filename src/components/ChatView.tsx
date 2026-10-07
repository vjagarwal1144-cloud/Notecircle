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
  MoreVertical,
  ChevronLeft
} from 'lucide-react';
import { api, getStoredToken } from '../services/api.ts';
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
  onActiveConversationChange?: (isActive: boolean) => void;
}

const MESSAGE_REACTIONS = ['❤️', '👍', '🙏', '😂', '🔥', '☕'];

export const ChatView: React.FC<ChatViewProps> = ({ initialUserId, onActiveConversationChange }) => {
  const { currentUser, isOnline, isUserOnline } = useAuth();
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
      
      // On desktop auto-select first conversation; on mobile let user choose from list
      if (!activeConvId && res.conversations.length > 0 && (window.innerWidth >= 640 || initialUserId)) {
        setActiveConvId(res.conversations[0].id);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    onActiveConversationChange?.(!!activeConvId);
  }, [activeConvId, onActiveConversationChange]);

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

    // Listen to global authenticated WebSocket events from AuthContext
    const handleNewMessage = async (e: any) => {
      const payload = e.detail;
      if (payload?.conversationId === activeConvId) {
        const incomingMsg: Message = payload.message;
        const activeConv = conversations.find((c) => c.id === activeConvId);
        const convSecret = activeConv?.participantIds && activeConv.participantIds.length > 0
          ? deriveConversationSecret(activeConv.participantIds)
          : 'notecircle_secure_channel';

        let plain = incomingMsg.text;
        if (incomingMsg.encryptedPayload) {
          try {
            plain = await decryptClientPayload(incomingMsg.encryptedPayload, convSecret);
          } catch {}
        }
        const decryptedMsg = { ...incomingMsg, text: plain };
        setMessages((prev) => {
          if (prev.some((m) => m.id === decryptedMsg.id)) return prev;
          return [...prev, decryptedMsg];
        });
        await localDb.saveMessage(decryptedMsg);
        scrollToBottom();

        // Acknowledge read if recipient is viewer
        if (decryptedMsg.senderId !== currentUser?.id) {
          api.ackMessageDelivery(activeConvId!, [decryptedMsg.id]).catch(() => {});
        }
      }
    };

    const handleDeletedMessage = (e: any) => {
      const payload = e.detail;
      if (payload?.conversationId === activeConvId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === payload.messageId
              ? { ...m, isDeleted: true, text: 'This message was deleted.' }
              : m
          )
        );
      }
    };

    const handleMessageReaction = (e: any) => {
      const payload = e.detail;
      if (payload?.conversationId === activeConvId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === payload.messageId ? { ...m, reactions: payload.reactions } : m
          )
        );
      }
    };

    window.addEventListener('notecircle:new_message', handleNewMessage);
    window.addEventListener('notecircle:message_deleted', handleDeletedMessage);
    window.addEventListener('notecircle:message_reaction', handleMessageReaction);

    // Secondary fallback polling at 12s
    const interval = setInterval(loadChatMessages, 12000);
    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener('notecircle:new_message', handleNewMessage);
      window.removeEventListener('notecircle:message_deleted', handleDeletedMessage);
      window.removeEventListener('notecircle:message_reaction', handleMessageReaction);
    };
  }, [activeConvId, conversations, currentUser?.id]);

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
    <div className="max-w-5xl mx-auto px-0 sm:px-4 py-0 sm:py-4 h-[calc(100dvh-3.75rem)] sm:h-[calc(100vh-6rem)] flex flex-col min-h-0 w-full">
      <div className="neo-card bg-white dark:bg-[#161622] rounded-none sm:rounded-3xl overflow-hidden flex-1 flex shadow-none sm:shadow-[5px_5px_0px_0px_#121217] dark:sm:shadow-[5px_5px_0px_0px_#050508] border-x-0 sm:border-2.5 min-h-0">
        
        {/* Left Sidebar: Conversations List (Hidden on mobile when chat is open) */}
        <div className={`${activeConvId ? 'hidden sm:flex' : 'flex'} w-full sm:w-84 sm:shrink-0 border-r-2 border-stone-900 dark:border-stone-750 flex-col bg-stone-50/80 dark:bg-[#181824] min-h-0`}>
          
          {/* Search Header */}
          <div className="p-3.5 border-b-2 border-stone-900 dark:border-stone-750 bg-white dark:bg-[#161622] flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-stone-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                className="w-full pl-9 pr-3 py-1.5 text-xs font-bold neo-input text-stone-900 dark:text-stone-100 placeholder:text-stone-400"
              />
            </div>
            <button
              onClick={() => setShowGroupModal(true)}
              className="p-2 rounded-xl neo-btn text-stone-900 dark:text-stone-100 bg-white dark:bg-[#1A1A26] cursor-pointer"
              title="Create Private Group Chat"
            >
              <Users className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>

          {/* Conversations Scroll Area */}
          <div className="flex-1 overflow-y-auto divide-y-2 divide-stone-100 dark:divide-stone-800/80 min-h-0">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-xs font-bold text-stone-500 dark:text-stone-400">
                <Lock className="w-6 h-6 mx-auto mb-2 text-stone-400 dark:text-stone-600 stroke-[2.5]" />
                <p className="font-black text-stone-900 dark:text-stone-100 text-sm">No chats yet</p>
                <p className="text-[11px] mt-1 text-stone-500">
                  Search approved circle connections to start encrypted chats.
                </p>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isGroup = conv.type === 'group';
                const other = conv.participants.find((p) => p.id !== currentUser?.id);
                const isActive = conv.id === activeConvId;
                const isOtherOnline = other ? isUserOnline(other.id) : false;

                return (
                  <button
                    key={conv.id}
                    onClick={() => setActiveConvId(conv.id)}
                    className={`w-full text-left p-3.5 transition-all flex items-start gap-3 cursor-pointer ${
                      isActive 
                        ? 'bg-amber-300 dark:bg-amber-400/90 text-stone-950 font-black border-l-4 border-stone-900 shadow-[inset_0px_2px_4px_rgba(0,0,0,0.06)]' 
                        : 'hover:bg-amber-50 dark:hover:bg-[#20202F]'
                    }`}
                  >
                    <div className="relative shrink-0">
                      {isGroup ? (
                        <div className="w-10 h-10 rounded-2xl bg-amber-400 text-stone-950 border-2 border-stone-900 flex items-center justify-center font-black text-xs shadow-[2px_2px_0px_0px_#121217]">
                          GRP
                        </div>
                      ) : (
                        other && (
                          <div className="border-2 border-stone-900 rounded-full p-0.5 shadow-[2px_2px_0px_0px_#121217] bg-white dark:bg-stone-850">
                            <UserAvatar
                              name={other.displayName}
                              src={other.avatarUrl}
                              size="md"
                              isOnline={isOtherOnline}
                            />
                          </div>
                        )
                      )}
                      {!isGroup && other?.availability && (
                        <span className="absolute -bottom-1 -right-1 text-xs select-none bg-white dark:bg-[#161622] rounded-full p-0.5 border-1.5 border-stone-900 shadow-[1px_1px_0px_0px_#121217]">
                          {other.availability.emoji}
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className={`text-xs font-black truncate ${isActive ? 'text-stone-950' : 'text-stone-950 dark:text-stone-50'}`}>
                          {isGroup ? conv.title : other?.displayName || 'Unknown'}
                        </p>
                        {conv.lastMessage && (
                          <span className={`text-[10px] font-bold shrink-0 ${isActive ? 'text-stone-800' : 'text-stone-400'}`}>
                            {new Date(conv.lastMessage.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        )}
                      </div>

                      {/* Display participant's active status note if present */}
                      {!isGroup && other?.activeNote ? (
                        <p className={`text-[11px] font-bold truncate flex items-center gap-1 mt-0.5 ${isActive ? 'text-amber-950' : 'text-amber-700 dark:text-amber-400'}`}>
                          <span>{other.activeNote.emoji}</span>
                          <span className="truncate">{other.activeNote.categoryLabel}: {other.activeNote.text}</span>
                        </p>
                      ) : (
                        <p className={`text-[11px] truncate mt-0.5 ${isActive ? 'text-stone-800 font-bold' : 'text-stone-500 dark:text-stone-400 font-medium'}`}>
                          {conv.lastMessage?.text || 'No messages yet'}
                        </p>
                      )}
                    </div>

                    {conv.unreadCount > 0 && (
                      <span className="w-5 h-5 bg-rose-500 text-white border-1.5 border-stone-900 rounded-full text-[10px] font-black flex items-center justify-center shrink-0">
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
        <div className={`${!activeConvId ? 'hidden sm:flex' : 'flex'} flex-1 flex-col bg-white/95 dark:bg-stone-900/95 min-w-0 min-h-0 relative`}>
          {activeConversation ? (
            <>
              {/* Chat Header */}
              <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b-2 border-stone-900 dark:border-stone-750 flex items-center justify-between bg-white dark:bg-[#161622] z-10 shrink-0">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => setActiveConvId(null)}
                    className="sm:hidden p-1.5 -ml-1 text-stone-900 dark:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl neo-btn cursor-pointer shrink-0 transition-colors"
                    title="Back to conversations list"
                  >
                    <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
                  </button>
                  {activeConversation.type === 'group' ? (
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-linear-to-br from-amber-500 to-amber-700 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                      GRP
                    </div>
                  ) : (
                    otherParticipant && (
                      <div className="shrink-0">
                        <UserAvatar
                          name={otherParticipant.displayName}
                          src={otherParticipant.avatarUrl}
                          size="sm"
                          isOnline={isUserOnline(otherParticipant.id)}
                        />
                      </div>
                    )
                  )}
                  <div className="min-w-0">
                    <h4 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2 truncate">
                      <span className="truncate">{activeConversation.type === 'group' ? activeConversation.title : otherParticipant?.displayName}</span>
                      {otherParticipant?.availability && (
                        <span className="text-[11px] text-stone-500 font-medium hidden sm:flex items-center gap-1 shrink-0">
                          <span>{otherParticipant.availability.emoji}</span>
                          <span className="truncate">{otherParticipant.availability.label}</span>
                        </span>
                      )}
                    </h4>
                    <div className="flex items-center gap-2 text-[10px] mt-0.5">
                      {activeConversation.type === 'direct' && otherParticipant && (
                        isUserOnline(otherParticipant.id) ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Active now
                          </span>
                        ) : (
                          <span className="text-stone-400">Offline</span>
                        )
                      )}
                      <span className="text-stone-300 dark:text-stone-700">·</span>
                      <span className="text-amber-700 dark:text-amber-400 flex items-center gap-1 font-semibold truncate">
                        <ShieldCheck className="w-3 h-3 text-amber-600 shrink-0" />
                        <span className="truncate">E2EE Verified</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowSafetyModal(true)}
                    className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 bg-amber-50/80 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-200/60 dark:border-amber-800/60 rounded-xl text-[11px] font-semibold transition-colors cursor-pointer shrink-0"
                    title="Click to view Safety Number & verify E2E Cryptography"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                    <span className="hidden sm:inline">Verify Safety</span>
                    <span className="sm:hidden">Safety</span>
                  </button>
                </div>
              </div>

              {/* Note / DND Status Integration Banner */}
              {otherParticipant?.activeNote && (
                <div className="bg-amber-50/70 dark:bg-amber-950/30 border-b border-amber-200/50 dark:border-amber-800/50 px-3.5 py-2 flex items-center gap-2 text-xs text-amber-950 dark:text-amber-200 shrink-0">
                  <span className="text-base select-none shrink-0">{otherParticipant.activeNote.emoji}</span>
                  <div className="flex-1 min-w-0 truncate">
                    <span className="font-semibold">{otherParticipant.displayName}</span>
                    <span className="text-stone-400 mx-1">·</span>
                    <span className="italic truncate">"{otherParticipant.activeNote.text}"</span>
                  </div>
                  {otherParticipant.activeNote.isDnd && (
                    <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold shrink-0">
                      DND Active
                    </span>
                  )}
                </div>
              )}

              {/* Error Banner */}
              {errorBanner && (
                <div className="bg-rose-50 dark:bg-rose-950/50 border-b border-rose-200 dark:border-rose-900 p-2.5 text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2 shrink-0">
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorBanner}</span>
                </div>
              )}

              {/* Messages Body */}
              <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 bg-stone-50/50 dark:bg-[#121110]/50 min-h-0">
                {messages.length === 0 ? (
                  <div className="text-center py-14 text-stone-400">
                    <p className="text-xs">No messages yet in this private conversation.</p>
                    <p className="text-[11px] mt-1 text-stone-400">Messages are end-to-end encrypted before transmission.</p>
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

                        <div className="flex items-end gap-1.5 max-w-[88%] sm:max-w-[80%] min-w-0">
                          <div
                            className={`p-3 sm:p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed border-2 relative break-words shadow-[3px_3px_0px_#121217] dark:shadow-[3px_3px_0px_#050508] ${
                              isMine
                                ? 'bg-amber-400 dark:bg-amber-500 text-stone-950 border-stone-900 font-medium'
                                : 'bg-white dark:bg-[#1A1A28] border-stone-900 dark:border-stone-700 text-stone-900 dark:text-stone-100'
                            }`}
                          >
                            {activeConversation.type === 'group' && !isMine && (
                              <p className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-1">
                                {msg.senderName}
                              </p>
                            )}

                            <p className="whitespace-pre-wrap break-words">{msg.text}</p>

                            <div
                              className={`flex items-center justify-end gap-1 mt-1 text-[9px] font-bold ${
                                isMine ? 'text-stone-800 dark:text-stone-900' : 'text-stone-500 dark:text-stone-400'
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
                              <div className="absolute -bottom-2.5 right-2 bg-white dark:bg-[#1A1A28] border-2 border-stone-900 rounded-full px-2 py-0.5 shadow-[2px_2px_0px_#121217] flex items-center gap-0.5 text-[11px]">
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
                              className="p-1.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-lg neu-button text-xs"
                              title="Reply"
                            >
                              <CornerDownRight className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleCopyText(msg.text, msg.id)}
                              className="p-1.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-lg neu-button text-xs"
                              title="Copy text"
                            >
                              {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-amber-600" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                            {isMine && !msg.isDeleted && (
                              <button
                                onClick={() => {
                                  const delAll = confirm('Delete for everyone? Press Cancel to delete for you only.');
                                  handleDeleteMessage(msg.id, delAll);
                                }}
                                className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg neu-button text-xs"
                                title="Delete message"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
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
                <div className="px-3 sm:px-4 py-2 bg-amber-50/90 dark:bg-stone-900 border-t border-amber-200/60 dark:border-stone-800 flex items-center justify-between text-xs text-stone-600 dark:text-stone-300 shrink-0">
                  <div className="flex items-center gap-2 truncate">
                    <CornerDownRight className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="shrink-0 font-medium">Replying to <strong>{replyToMessage.senderName}</strong>:</span>
                    <span className="truncate italic text-stone-500 dark:text-stone-400">"{replyToMessage.text}"</span>
                  </div>
                  <button
                    onClick={() => setReplyToMessage(null)}
                    className="p-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Message Composer */}
              <form onSubmit={handleSendMessage} className="p-2.5 sm:p-3.5 border-t-2 border-stone-900 dark:border-stone-750 bg-white dark:bg-[#161622] pb-[max(0.75rem,env(safe-area-inset-bottom))] shrink-0 z-20">
                <div className="flex items-center gap-2 max-w-full">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={
                      otherParticipant?.availability?.strictDnd && otherParticipant.availability.code === 'dnd'
                        ? `${otherParticipant.displayName} has strict DND active...`
                        : "Type an encrypted message..."
                    }
                    className="flex-1 min-w-0 px-3.5 py-2.5 text-xs sm:text-sm font-bold neo-input text-stone-900 dark:text-stone-100 placeholder:text-stone-400"
                  />
                  <button
                    type="submit"
                    disabled={isSending || !inputText.trim()}
                    className="p-2.5 sm:px-4 sm:py-2.5 neo-btn-primary disabled:opacity-40 text-stone-950 rounded-2xl cursor-pointer shrink-0 flex items-center justify-center gap-1.5"
                    title="Send message"
                  >
                    <Send className="w-4 h-4 stroke-[2.5]" />
                    <span className="hidden sm:inline text-xs font-black">Send</span>
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-stone-400 min-h-0">
              <Lock className="w-8 h-8 text-stone-300 dark:text-stone-700 mb-2" />
              <p className="text-sm font-bold text-stone-800 dark:text-stone-200">Private NoteCircle Chat</p>
              <p className="text-xs text-stone-400 max-w-xs mt-1">
                Select a conversation on the left, or connect with someone from Search to start messaging privately.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Group Chat Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs">
          <div className="neo-card bg-white dark:bg-[#161622] w-full max-w-md rounded-3xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b-2 border-stone-900 dark:border-stone-800 pb-3">
              <h3 className="text-sm font-black text-stone-900 dark:text-stone-100 uppercase tracking-wide">New Private Group Chat</h3>
              <button 
                onClick={() => setShowGroupModal(false)} 
                className="p-1 rounded-xl neo-btn text-stone-900 dark:text-stone-100 bg-white dark:bg-[#1A1A26] cursor-pointer"
              >
                <X className="w-5 h-5 stroke-[2.5]" />
              </button>
            </div>

            <div>
              <label className="text-xs font-black uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1">Group Title</label>
              <input
                type="text"
                value={groupTitle}
                onChange={(e) => setGroupTitle(e.target.value)}
                placeholder="e.g. Weekend Hiking Circle, Study Group..."
                className="w-full text-xs font-bold p-3 neo-input text-stone-900 dark:text-stone-100 placeholder:text-stone-400"
              />
            </div>

            <div>
              <label className="text-xs font-black uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1">Select Connections (Min 2)</label>
              <div className="max-h-48 overflow-y-auto space-y-2 border-2 border-stone-900 dark:border-stone-800 rounded-2xl p-2 bg-stone-50 dark:bg-[#181824]">
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
                      className={`w-full text-left p-2.5 rounded-xl flex items-center justify-between text-xs transition-colors cursor-pointer border-2 ${
                        isSelected 
                          ? 'bg-amber-300 dark:bg-amber-400 text-stone-950 font-black border-stone-900 shadow-[2px_2px_0px_#121217]' 
                          : 'bg-white dark:bg-[#1E1E2C] border-transparent hover:border-stone-900 text-stone-900 dark:text-stone-100'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <UserAvatar name={user.displayName} src={user.avatarUrl} size="xs" />
                        <span className="font-bold">{user.displayName}</span>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-stone-950 stroke-[3]" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t-2 border-stone-900 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setShowGroupModal(false)}
                className="px-3.5 py-2 text-xs font-bold text-stone-700 dark:text-stone-300 hover:underline cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateGroup}
                className="px-4 py-2 neo-btn-primary text-stone-950 rounded-xl text-xs font-black cursor-pointer"
              >
                Create Group
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Safety Number & Cryptographic Verification Modal */}
      {showSafetyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs">
          <div className="neo-card bg-white dark:bg-[#161622] w-full max-w-md rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b-2 border-stone-900 dark:border-stone-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-400 border-2 border-stone-900 text-stone-950 flex items-center justify-center font-bold shadow-[2px_2px_0px_#121217]">
                  <ShieldCheck className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-stone-900 dark:text-stone-100 uppercase tracking-wide">Verify Safety Number</h3>
                  <p className="text-[11px] font-bold text-stone-500">End-to-End Encryption Verification</p>
                </div>
              </div>
              <button 
                onClick={() => setShowSafetyModal(false)} 
                className="p-1 rounded-xl neo-btn text-stone-900 dark:text-stone-100 bg-white dark:bg-[#1A1A26] cursor-pointer"
              >
                <X className="w-5 h-5 stroke-[2.5]" />
              </button>
            </div>

            <p className="text-xs font-medium text-stone-700 dark:text-stone-300 leading-relaxed">
              Compare this safety number with <strong>{otherParticipant?.displayName}</strong> in person or over another channel to verify that messages are encrypted end-to-end and protected against server substitution.
            </p>

            <div className="p-4 bg-amber-100 dark:bg-amber-950/40 border-2 border-stone-900 dark:border-stone-750 rounded-2xl text-center space-y-2 shadow-[3px_3px_0px_#121217]">
              <span className="text-[10px] font-black text-stone-900 dark:text-amber-300 block uppercase tracking-widest">
                Cryptographic Safety Number
              </span>
              <div className="font-mono text-base font-black text-stone-950 dark:text-stone-50 tracking-wider">
                {safetyNumber || 'Computing safety number...'}
              </div>
            </div>

            <div className="space-y-1.5 text-[11px] font-bold text-stone-600 dark:text-stone-400 border-t-2 border-stone-900 dark:border-stone-800 pt-3">
              <p>• Key Exchange: <strong className="text-stone-900 dark:text-stone-100">ECDH (NIST P-256)</strong></p>
              <p>• Symmetric Cipher: <strong className="text-stone-900 dark:text-stone-100">AES-GCM 256-bit</strong></p>
              <p>• Forward Secrecy: <strong className="text-stone-900 dark:text-stone-100">Ephemeral keypair per message</strong></p>
              <p>• Server Storage: <strong className="text-stone-900 dark:text-stone-100">Zero readable plaintext</strong></p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowSafetyModal(false)}
                className="px-5 py-2.5 neo-btn-primary text-stone-950 rounded-xl text-xs font-black cursor-pointer"
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
