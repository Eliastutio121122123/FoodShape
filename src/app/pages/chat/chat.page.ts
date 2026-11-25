import { Component, OnDestroy, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { RealtimeChannel } from '@supabase/supabase-js';
import { AuthService, FoodShareChatConversation, FoodShareChatMessage, FoodShareChatThread } from '../../services/auth.service';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.page.html',
  styleUrls: ['./chat.page.scss'],
  imports: [RouterLink],
})
export class ChatPage implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly role = this.auth.currentRole;
  readonly conversations = signal<FoodShareChatConversation[]>([]);
  readonly inboxError = signal('');
  readonly selectedId = signal<string | null>(null);
  readonly thread = signal<FoodShareChatThread | null>(null);
  readonly draft = signal('');
  readonly replyTo = signal<FoodShareChatMessage | null>(null);
  readonly confirmDeleteId = signal<string | null>(null);
  readonly deletingId = signal<string | null>(null);
  readonly inboxLoading = signal(true);
  readonly threadLoading = signal(false);
  readonly sending = signal(false);
  readonly error = signal('');
  private channel: RealtimeChannel | null = null;

  constructor() {
    const currentRole = this.role();
    if (!currentRole || !['person', 'donor', 'beneficiary'].includes(currentRole)) {
      void this.router.navigateByUrl('/app/profile');
      return;
    }
    this.route.paramMap.subscribe((params) => {
      const conversationId = params.get('conversationId');
      this.selectedId.set(conversationId);
      this.draft.set('');
      this.replyTo.set(null);
      this.confirmDeleteId.set(null);
      this.releaseChannel();
      void this.loadInbox();
      if (conversationId) void this.loadThread(conversationId);
      else this.thread.set(null);
    });
  }

  ngOnDestroy(): void { this.releaseChannel(); }

  async loadInbox(): Promise<void> {
    this.inboxLoading.set(true);
    this.inboxError.set('');
    try {
      this.conversations.set(await this.auth.loadChatConversations());
    } catch (reason) {
      this.inboxError.set(reason instanceof Error ? reason.message : 'No pudimos cargar tus conversaciones.');
    } finally {
      this.inboxLoading.set(false);
    }
  }

  async loadThread(conversationId: string, silent = false): Promise<void> {
    if (!silent) {
      this.threadLoading.set(true);
      this.error.set('');
    }
    try {
      const result = await this.auth.loadChatThread(conversationId);
      if (this.selectedId() !== conversationId) return;
      this.thread.set(result);
      if (!this.channel) {
        this.channel = this.auth.subscribeToChat(conversationId, () => {
          void this.loadThread(conversationId, true);
          void this.loadInbox();
        });
      }
    } catch (reason) {
      if (!silent) this.error.set(reason instanceof Error ? reason.message : 'No pudimos abrir esta conversación.');
    } finally {
      if (!silent) this.threadLoading.set(false);
    }
  }

  selectConversation(conversation: FoodShareChatConversation): void {
    void this.router.navigate(['/app/chat', conversation.id]);
  }

  updateDraft(event: Event): void { this.draft.set((event.target as HTMLTextAreaElement).value); }

  async send(event: Event): Promise<void> {
    event.preventDefault();
    const conversationId = this.selectedId();
    const content = this.draft().trim();
    if (!conversationId || !content || this.sending()) return;
    this.sending.set(true);
    this.error.set('');
    try {
      await this.auth.sendChatMessage(conversationId, content, this.replyTo()?.id ?? null);
      this.draft.set('');
      this.replyTo.set(null);
      await Promise.all([this.loadThread(conversationId, true), this.loadInbox()]);
    } catch (reason) {
      this.error.set(reason instanceof Error ? reason.message : 'No se pudo enviar el mensaje. Comprueba tu conexión e inténtalo otra vez.');
    } finally {
      this.sending.set(false);
    }
  }

  startReply(message: FoodShareChatMessage): void {
    if (message.deletedAt) return;
    this.confirmDeleteId.set(null);
    this.replyTo.set(message);
  }

  cancelReply(): void { this.replyTo.set(null); }

  askDelete(message: FoodShareChatMessage): void {
    this.replyTo.set(null);
    this.confirmDeleteId.set(message.id);
  }

  cancelDelete(): void { this.confirmDeleteId.set(null); }

  async confirmDelete(message: FoodShareChatMessage): Promise<void> {
    if (this.deletingId()) return;
    this.deletingId.set(message.id);
    this.error.set('');
    try {
      await this.auth.deleteOwnChatMessage(message.id);
      this.confirmDeleteId.set(null);
      await Promise.all([this.loadThread(message.conversationId, true), this.loadInbox()]);
    } catch (reason) {
      this.error.set(reason instanceof Error ? reason.message : 'No se pudo eliminar el mensaje. Comprueba tu conexión e inténtalo de nuevo.');
    } finally {
      this.deletingId.set(null);
    }
  }

  replyAuthor(message: FoodShareChatMessage, thread: FoodShareChatThread): string {
    return message.senderId === thread.currentUserId ? 'Tú' : this.roleLabel(thread.conversation);
  }

  replyPreview(message: FoodShareChatMessage, thread: FoodShareChatThread): FoodShareChatMessage | null {
    return message.replyToMessageId
      ? thread.messages.find((candidate) => candidate.id === message.replyToMessageId) ?? null
      : null;
  }

  formatMessageTime(value: string): string {
    return new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  }

  roleLabel(conversation: FoodShareChatConversation): string {
    if (this.role() !== 'person') return 'Persona usuaria';
    return conversation.organizationType === 'donor' ? 'Organización donante' : 'Organización beneficiaria';
  }

  backToPanel(): string { return `/app/${this.role()}`; }

  private releaseChannel(): void {
    if (!this.channel) return;
    this.auth.removeChatSubscription(this.channel);
    this.channel = null;
  }
}
