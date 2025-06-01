import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

// User Operations
export async function createUser(email: string, name?: string) {
  return await prisma.user.create({
    data: {
      email,
      name,
      settings: {
        create: {
          theme: 'light',
          language: 'en',
          notifications: true,
          settings: {}
        }
      }
    },
    include: {
      settings: true
    }
  });
}

export async function getUserWithSettings(userId: string) {
  return await prisma.user.findUnique({
    where: { id: userId },
    include: {
      settings: true,
      savedItems: true,
      notifications: {
        where: { read: false },
        orderBy: { createdAt: 'desc' }
      }
    }
  });
}

export async function createUserWithGoogle(
  email: string,
  googleId: string,
  name: string,
  picture?: string
) {
  return await prisma.user.create({
    data: {
      id: googleId,
      email,
      googleId,
      name,
      picture,
      settings: {
        create: {
          theme: 'light',
          language: 'en',
          notifications: true,
          settings: Prisma.JsonNull
        }
      }
    },
    include: {
      settings: true
    }
  });
}

export async function getUserByGoogleId(googleId: string) {
  return await prisma.user.findUnique({
    where: { googleId },
    include: {
      settings: true,
      savedItems: true,
      notifications: {
        where: { read: false },
        orderBy: { createdAt: 'desc' }
      }
    }
  });
}

// Settings Operations
type UserSettingsUpdate = {
  theme?: string;
  language?: string;
  notifications?: boolean;
  settings?: Prisma.InputJsonValue;
};

export async function updateUserSettings(userId: string, settings: UserSettingsUpdate) {
  return await prisma.userSettings.update({
    where: { userId },
    data: settings
  });
}

// Session Tracking
export async function startUserSession(userId: string, userAgent?: string, ipAddress?: string) {
  return await prisma.session.create({
    data: {
      userId,
      userAgent,
      ipAddress
    }
  });
}

export async function endUserSession(sessionId: string) {
  return await prisma.session.update({
    where: { id: sessionId },
    data: { endTime: new Date() }
  });
}

// SavedItem Operations
export async function saveBrowserItem(
  userId: string,
  title: string,
  content: string,
  url?: string,
  tags: string[] = []
) {
  return await prisma.savedItem.create({
    data: {
      userId,
      title,
      content,
      url,
      tags
    }
  });
}

export async function getSavedItems(userId: string, tag?: string) {
  return await prisma.savedItem.findMany({
    where: {
      userId,
      ...(tag ? { tags: { has: tag } } : {})
    },
    orderBy: { createdAt: 'desc' }
  });
}

// Notification Operations
export async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: 'info' | 'warning' | 'error' | 'success' = 'info'
) {
  return await prisma.notification.create({
    data: {
      userId,
      title,
      message,
      type
    }
  });
}

export async function markNotificationAsRead(notificationId: string) {
  return await prisma.notification.update({
    where: { id: notificationId },
    data: { read: true }
  });
}

// Usage Statistics
export async function trackUserAction(userId: string, action: string, metadata?: Prisma.InputJsonValue) {
  return await prisma.usageStats.create({
    data: {
      userId,
      action,
      metadata
    }
  });
}

// Extension Logging
export async function logExtensionEvent(
  level: 'info' | 'warn' | 'error',
  message: string,
  metadata?: Prisma.InputJsonValue
) {
  return await prisma.extensionLog.create({
    data: {
      level,
      message,
      metadata
    }
  });
}

// Trade Operations
export async function createTrade(
  userId: string,
  symbol: string,
  type: 'buy' | 'sell',
  amount: number,
  price: number,
  metadata?: Prisma.InputJsonValue
) {
  const totalValue = amount * price;
  
  return await prisma.trade.create({
    data: {
      userId,
      symbol,
      type,
      amount,
      price,
      totalValue,
      status: 'open',
      metadata
    }
  });
}

export async function closeTrade(
  tradeId: string,
  closePrice: number,
  metadata?: Prisma.InputJsonValue
) {
  const trade = await prisma.trade.findUnique({
    where: { id: tradeId }
  });

  if (!trade) throw new Error('Trade not found');

  const profit = trade.type === 'buy' 
    ? (closePrice - trade.price) * trade.amount
    : (trade.price - closePrice) * trade.amount;

  const updatedTrade = await prisma.trade.update({
    where: { id: tradeId },
    data: {
      status: 'closed',
      closeTime: new Date(),
      profit,
      metadata: metadata ? { ...(trade.metadata as object), ...(metadata as object) } : (trade.metadata as Prisma.InputJsonValue)
    }
  });

  // Update profit summary
  await updateProfitSummary(trade.userId);

  return updatedTrade;
}

export async function getOpenTrades(userId: string) {
  return await prisma.trade.findMany({
    where: {
      userId,
      status: 'open'
    },
    orderBy: { openTime: 'desc' }
  });
}

export async function getTradeHistory(
  userId: string,
  options?: {
    symbol?: string;
    startDate?: Date;
    endDate?: Date;
    status?: 'open' | 'closed' | 'cancelled';
  }
) {
  return await prisma.trade.findMany({
    where: {
      userId,
      ...(options?.symbol && { symbol: options.symbol }),
      ...(options?.status && { status: options.status }),
      ...(options?.startDate && { openTime: { gte: options.startDate } }),
      ...(options?.endDate && { openTime: { lte: options.endDate } })
    },
    orderBy: { openTime: 'desc' }
  });
}

// Profit Summary Operations
async function updateProfitSummary(userId: string) {
  const trades = await prisma.trade.findMany({
    where: {
      userId,
      status: 'closed'
    }
  });

  const totalProfit = trades.reduce((sum: number, trade: { profit: number | null }) => sum + (trade.profit || 0), 0);
  const winningTrades = trades.filter((trade: { profit: number | null }) => (trade.profit || 0) > 0).length;
  const losingTrades = trades.filter((trade: { profit: number | null }) => (trade.profit || 0) < 0).length;
  const totalTrades = trades.length;
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

  return await prisma.profitSummary.upsert({
    where: { userId },
    create: {
      userId,
      totalProfit,
      totalTrades,
      winningTrades,
      losingTrades,
      winRate
    },
    update: {
      totalProfit,
      totalTrades,
      winningTrades,
      losingTrades,
      winRate
    }
  });
}

export async function getProfitSummary(userId: string) {
  return await prisma.profitSummary.findUnique({
    where: { userId }
  });
}

// Watchlist Operations
export async function createWatchlist(userId: string, name: string, symbols: string[]) {
  return await prisma.watchlist.create({
    data: {
      userId,
      name,
      symbols
    }
  });
}

export async function updateWatchlist(watchlistId: string, data: { name?: string; symbols?: string[] }) {
  return await prisma.watchlist.update({
    where: { id: watchlistId },
    data
  });
}

export async function getWatchlists(userId: string) {
  return await prisma.watchlist.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' }
  });
}

// Price Alert Operations
export async function createPriceAlert(
  userId: string,
  symbol: string,
  price: number,
  condition: 'above' | 'below'
) {
  return await prisma.priceAlert.create({
    data: {
      userId,
      symbol,
      price,
      condition
    }
  });
}

export async function updatePriceAlert(
  alertId: string,
  data: { price?: number; condition?: 'above' | 'below'; triggered?: boolean }
) {
  return await prisma.priceAlert.update({
    where: { id: alertId },
    data
  });
}

export async function getActiveAlerts(userId: string) {
  return await prisma.priceAlert.findMany({
    where: {
      userId,
      triggered: false
    },
    orderBy: { createdAt: 'desc' }
  });
}

// API Key Operations
export async function storeApiKey(
  userId: string,
  exchange: string,
  apiKey: string,
  secretKey: string,
  passphrase?: string
) {
  return await prisma.apiKey.create({
    data: {
      userId,
      exchange,
      apiKey,
      secretKey,
      passphrase
    }
  });
}

export async function getApiKeys(userId: string, exchange?: string) {
  return await prisma.apiKey.findMany({
    where: {
      userId,
      ...(exchange && { exchange })
    }
  });
}

export async function deleteApiKey(apiKeyId: string) {
  return await prisma.apiKey.delete({
    where: { id: apiKeyId }
  });
} 