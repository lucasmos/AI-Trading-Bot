// src/services/deriv-balance-listener.ts

export type ListenerStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';

interface BalanceData {
  balance: number;
  currency: string;
  loginid: string;
}

type BalanceUpdateCallback = (balanceData: BalanceData) => void;
type ErrorCallback = (error: Error) => void;
type CloseCallback = (event: CloseEvent) => void;
type StatusChangeCallback = (status: ListenerStatus, message?: string) => void;

export class DerivBalanceListener {
  private ws: WebSocket | null = null;
  // private token: string; // Will be replaced by effectiveToken logic
  private accountId: string;
  private effectiveToken: string; // Added
  private onBalanceUpdate: BalanceUpdateCallback;
  private onError: ErrorCallback;
  private onClose?: CloseCallback;
  private onStatusChange: StatusChangeCallback;
  private currentAppId: string = process.env.NEXT_PUBLIC_DERIV_APP_ID || '80447';
  private derivWsUrl: string = process.env.NEXT_PUBLIC_DERIV_WS_URL || 'wss://ws.derivws.com/websockets/v3';

  private connectionPromise: Promise<void> | null = null;
  private resolveConnectionPromise: (() => void) | null = null;
  private rejectConnectionPromise: ((reason?: any) => void) | null = null;

  private messageQueue: any[] = [];
  private isSwitchingAccount: boolean = false;
  private isAuthorized: boolean = false;
  private isSubscribed: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 5000; // 5 seconds

  constructor(
    token: string, // Dynamic session token, will be a fallback
    accountId: string,
    onBalanceUpdate: BalanceUpdateCallback,
    onError: ErrorCallback,
    onStatusChange: StatusChangeCallback,
    onClose?: CloseCallback
  ) {
    // this.token = token; // No longer directly store the passed token like this
    this.accountId = accountId;
    this.onBalanceUpdate = onBalanceUpdate;
    this.onError = onError;
    this.onStatusChange = onStatusChange;
    this.onClose = onClose;

    const staticDemoToken = process.env.NEXT_PUBLIC_DERIV_API_TOKEN_DEMO;
    const staticRealToken = process.env.NEXT_PUBLIC_DERIV_API_TOKEN;

    if (this.accountId === 'VRTC13200397' && staticDemoToken) {
      this.effectiveToken = staticDemoToken;
      console.log(`[DerivBalanceListener] Using static demo token for account ${this.accountId}.`);
    } else if (this.accountId === 'CR8821305' && staticRealToken) {
      this.effectiveToken = staticRealToken;
      console.log(`[DerivBalanceListener] Using static real token (from NEXT_PUBLIC_DERIV_API_TOKEN) for account ${this.accountId}.`);
    } else {
      this.effectiveToken = token; // Fallback to dynamic token
      console.log(`[DerivBalanceListener] Using dynamic session token for account ${this.accountId}.`);
      if (this.accountId === 'VRTC13200397' && !staticDemoToken) {
          console.warn(`[DerivBalanceListener] Static demo token (NEXT_PUBLIC_DERIV_API_TOKEN_DEMO) not found for VRTC13200397, falling back to session token.`);
      }
      if (this.accountId === 'CR8821305' && !staticRealToken) {
          console.warn(`[DerivBalanceListener] Static real token (NEXT_PUBLIC_DERIV_API_TOKEN) not found for CR8821305, falling back to session token.`);
      }
    }

    this.currentAppId = process.env.NEXT_PUBLIC_DERIV_APP_ID || '80447';
    this.derivWsUrl = process.env.NEXT_PUBLIC_DERIV_WS_URL || 'wss://ws.derivws.com/websockets/v3';

    if (!this.currentAppId) {
        const errMsg = "NEXT_PUBLIC_DERIV_APP_ID is not set.";
        console.error(`[DerivBalanceListener] ${errMsg}`);
        this.onStatusChange('error', errMsg);
        this.onStatusChange('disconnected', 'Configuration error.');
        throw new Error(errMsg); // Propagate error
    }
    if (!this.derivWsUrl) {
        const errMsg = "NEXT_PUBLIC_DERIV_WS_URL is not set.";
        console.error(`[DerivBalanceListener] ${errMsg}`);
        this.onStatusChange('error', errMsg);
        this.onStatusChange('disconnected', 'Configuration error.');
        throw new Error(errMsg); // Propagate error
    }
    if (!this.effectiveToken) {
      const errorMsg = `No effective API token available for DerivBalanceListener on account ${this.accountId}.`;
      console.error(`[DerivBalanceListener] ${errorMsg}`);
      this.onStatusChange('error', 'Token configuration error.');
      this.onStatusChange('disconnected', 'Token error.');
      throw new Error(errorMsg);
    }

    this.onStatusChange('idle'); // Initial status before connect attempt
    this.connect();
  }

  private connect() {
    console.log(`[DerivBalanceListener] Attempting to connect for ${this.accountId}... AppID: ${this.currentAppId}`);
    this.onStatusChange('connecting');
    this.ws = new WebSocket(`${this.derivWsUrl}?app_id=${this.currentAppId}`);
    this.isAuthorized = false;
    this.isSubscribed = false;
    this.isSwitchingAccount = false; // Reset state for new connection

    this.connectionPromise = new Promise<void>((resolve, reject) => {
      this.resolveConnectionPromise = resolve;
      this.rejectConnectionPromise = reject;
    });

    this.ws.onopen = this.handleOpen.bind(this);
    this.ws.onmessage = this.handleMessage.bind(this);
    this.ws.onerror = this.handleError.bind(this);
    this.ws.onclose = this.handleClose.bind(this);
  }

  private handleOpen() {
    console.log(`[DerivBalanceListener] WebSocket connected for ${this.accountId}. Authorizing...`);
    this.sendMessage({ authorize: this.effectiveToken });
  }

  private handleMessage(event: MessageEvent) {
    const response = JSON.parse(event.data as string);
    // console.log(`[DerivBalanceListener] (${this.accountId}) Received:`, response.msg_type, response);

    if (response.error) {
      const errorMsg = response.error.message || 'Unknown API error';
      console.error(`[DerivBalanceListener] (${this.accountId}) API Error: ${errorMsg}`, response.error);
      this.onError(new Error(errorMsg));
      this.onStatusChange('error', errorMsg);
      if (response.error.code === 'AuthorizationRequired' || response.error.code === 'InvalidToken' || response.error.code === 'AccountSwitchFailed') {
        if (this.rejectConnectionPromise) this.rejectConnectionPromise(new Error(errorMsg));
        this.onStatusChange('disconnected', 'Critical API error.');
        this.close(true); // Permanent error, stop and don't reconnect.
      }
      return;
    }

    switch (response.msg_type) {
      case 'authorize':
        if (response.authorize?.loginid === this.accountId) {
          console.log(`[DerivBalanceListener] (${this.accountId}) Authorized successfully with account-specific token. Account: ${response.authorize.loginid}.`);
          this.isAuthorized = true;
          this.isSwitchingAccount = false; // No switch needed/performed
          this.flushMessageQueue();
          if (this.resolveConnectionPromise) this.resolveConnectionPromise();
          this.onStatusChange('connected', 'Authorized with account-specific token.');
          this.subscribeToBalance();
        } else if (response.authorize?.loginid) {
          const errorMsg = `Token authorized for ${response.authorize.loginid}, but listener expected ${this.accountId}.`;
          console.error(`[DerivBalanceListener] (${this.accountId}) ${errorMsg}`);
          this.isAuthorized = false;
          this.onError(new Error(errorMsg));
          this.onStatusChange('error', 'Token-account mismatch.');
          this.onStatusChange('disconnected', 'Token mismatch.');
          if (this.rejectConnectionPromise) this.rejectConnectionPromise(new Error(errorMsg));
          this.close(true); // Use true to indicate permanent error
        } else {
          const errorMsg = `Authorization failed for account ${this.accountId}. Response: ${JSON.stringify(response)}`;
          console.error(`[DerivBalanceListener] (${this.accountId}) ${errorMsg}`);
          this.isAuthorized = false;
          this.onError(new Error(errorMsg));
          this.onStatusChange('error', 'Authorization failed.');
          this.onStatusChange('disconnected', 'Authorization error.');
          if (this.rejectConnectionPromise) this.rejectConnectionPromise(new Error(errorMsg));
          this.close(true); // Use true to indicate permanent error
        }
        break;
      // Removed: case 'account_switch': ...
      case 'balance':
        if (!this.isSubscribed && response.subscription?.id) {
            console.log(`[DerivBalanceListener] (${this.accountId}) Successfully subscribed to balance updates. Sub ID: ${response.subscription.id}`);
            this.isSubscribed = true;
            // this.onStatusChange('connected'); // Status 'connected' is now set earlier, after account is ready.
        }
        if (response.balance?.loginid === this.accountId) {
          this.onBalanceUpdate(response.balance as BalanceData);
        } else {
          console.warn(`[DerivBalanceListener] (${this.accountId}) Received balance data for unexpected account: ${response.balance?.loginid}. Expected: ${this.accountId}`);
        }
        break;
      default:
        // console.log(`[DerivBalanceListener] (${this.accountId}) Received unhandled message type: ${response.msg_type}`);
        break;
    }
  }

  private subscribeToBalance() {
    if (!this.isSubscribed) {
        console.log(`[DerivBalanceListener] (${this.accountId}) Sending balance subscription request.`);
        this.sendMessage({ balance: 1, subscribe: 1 });
    }
  }

  private sendMessage(message: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      if (message.authorize || (this.isAuthorized && !this.isSwitchingAccount) || (this.isAuthorized && message.account_switch)) {
        // Allow authorize, or if authorized and not switching, or if authorized and trying to switch account
        this.ws.send(JSON.stringify(message));
      } else {
        // console.log(`[DerivBalanceListener] (${this.accountId}) Queuing message, WS not ready for this message type or switching:`, message);
        this.messageQueue.push(message);
      }
    } else {
      console.warn(`[DerivBalanceListener] (${this.accountId}) WS not open. Queuing message:`, message);
      this.messageQueue.push(message);
    }
  }

  private flushMessageQueue() {
    // console.log(`[DerivBalanceListener] (${this.accountId}) Flushing message queue. Length: ${this.messageQueue.length}`);
    while(this.messageQueue.length > 0) {
        const message = this.messageQueue.shift();
        // console.log(`[DerivBalanceListener] (${this.accountId}) Sending queued message:`, message);
        this.sendMessage(message); // Use sendMessage to re-check conditions
    }
  }

  private handleError(event: Event) {
    const errorMsg = 'WebSocket error occurred. See console for details.';
    console.error(`[DerivBalanceListener] (${this.accountId}) WebSocket Error:`, event);
    this.onError(new Error(errorMsg));
    this.onStatusChange('error', 'WebSocket error.');
    // Reconnect logic is handled in handleClose for unexpected closures
  }

  private handleClose(event: CloseEvent) {
    console.log(`[DerivBalanceListener] (${this.accountId}) WebSocket closed. Code: ${event.code}, Reason: "${event.reason}", Clean: ${event.wasClean}`);
    const wasConnected = this.isAuthorized && this.isSubscribed;
    this.isAuthorized = false;
    this.isSubscribed = false;

    if (this.onClose) {
      this.onClose(event);
    }

    if (this.rejectConnectionPromise) {
        this.connectionPromise?.catch(() => {});
        this.rejectConnectionPromise(new Error(`WebSocket closed before operation completed. Code: ${event.code}, Reason: ${event.reason}`));
        this.resolveConnectionPromise = null;
        this.rejectConnectionPromise = null;
    }

    if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const reconnectMsg = `Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`;
        console.log(`[DerivBalanceListener] (${this.accountId}) Attempting reconnect ${reconnectMsg} in ${this.reconnectDelay / 1000}s...`);
        this.onStatusChange('reconnecting', reconnectMsg);
        setTimeout(() => this.connect(), this.reconnectDelay);
    } else if (!event.wasClean) {
        const maxAttemptsMsg = 'Max reconnect attempts reached.';
        console.error(`[DerivBalanceListener] (${this.accountId}) WebSocket closed unexpectedly. ${maxAttemptsMsg}`);
        this.onError(new Error(`Balance updates stopped for ${this.accountId}. ${maxAttemptsMsg}`));
        this.onStatusChange('error', 'Connection failed permanently.');
        this.onStatusChange('disconnected', maxAttemptsMsg);
    } else { // Clean closure
        this.onStatusChange('disconnected', 'Connection closed.');
    }
  }

  public close(permanent: boolean = false) {
    console.log(`[DerivBalanceListener] (${this.accountId}) Manually closing WebSocket. Permanent: ${permanent}`);
    if (permanent) {
        this.reconnectAttempts = this.maxReconnectAttempts;
    }
    if (this.ws) {
      this.ws.onclose = null; // Prevent handleClose from triggering reconnect logic during manual close
      this.ws.close(1000, "Client closed connection");
    }
    this.isAuthorized = false;
    this.isSubscribed = false;
    this.messageQueue = [];
    this.resolveConnectionPromise = null;
    this.rejectConnectionPromise = null;
    this.onStatusChange('idle'); // Set to idle on explicit close
  }
}
