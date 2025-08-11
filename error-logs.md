2025-08-11T09:53:34.235Z [info] [Trade History API] Fetching trades for user: 17315277
2025-08-11T09:53:34.872Z [info] [Trade History API] Prisma connection successful
2025-08-11T09:53:34.984Z [info] [Trade History API] Sample of all trades in database: []
2025-08-11T09:53:34.989Z [info] prisma:error 
Invalid `prisma.trade.findMany()` invocation:

{
  where: {
    userId: "17315277"
  },
  orderBy: {
    openTime: "desc",
    ~~~~~~~~
?   id?: SortOrder,
?   userId?: SortOrder,
?   symbol?: SortOrder,
?   status?: SortOrder,
?   derivContractId?: SortOrder | SortOrderInput,
?   derivAccountId?: SortOrder | SortOrderInput,
?   accountType?: SortOrder | SortOrderInput,
?   derivLongcode?: SortOrder | SortOrderInput,
?   derivShortcode?: SortOrder | SortOrderInput,
?   derivBuyPrice?: SortOrder | SortOrderInput,
?   derivPayout?: SortOrder | SortOrderInput,
?   derivPurchaseTime?: SortOrder | SortOrderInput,
?   derivSellPrice?: SortOrder | SortOrderInput,
?   derivSellTime?: SortOrder | SortOrderInput,
?   derivContractType?: SortOrder | SortOrderInput,
?   derivUnderlyingSymbol?: SortOrder | SortOrderInput,
?   derivDurationType?: SortOrder | SortOrderInput,
?   derivAppId?: SortOrder | SortOrderInput,
?   derivTransactionId?: SortOrder | SortOrderInput,
?   user?: UserOrderByWithRelationInput
  }
}

Unknown argument `openTime`. Available options are marked with ?.
2025-08-11T09:53:34.994Z [error] [Trade History API] Error in trade history API: Error [PrismaClientValidationError]: 
Invalid `prisma.trade.findMany()` invocation:

{
  where: {
    userId: "17315277"
  },
  orderBy: {
    openTime: "desc",
    ~~~~~~~~
?   id?: SortOrder,
?   userId?: SortOrder,
?   symbol?: SortOrder,
?   status?: SortOrder,
?   derivContractId?: SortOrder | SortOrderInput,
?   derivAccountId?: SortOrder | SortOrderInput,
?   accountType?: SortOrder | SortOrderInput,
?   derivLongcode?: SortOrder | SortOrderInput,
?   derivShortcode?: SortOrder | SortOrderInput,
?   derivBuyPrice?: SortOrder | SortOrderInput,
?   derivPayout?: SortOrder | SortOrderInput,
?   derivPurchaseTime?: SortOrder | SortOrderInput,
?   derivSellPrice?: SortOrder | SortOrderInput,
?   derivSellTime?: SortOrder | SortOrderInput,
?   derivContractType?: SortOrder | SortOrderInput,
?   derivUnderlyingSymbol?: SortOrder | SortOrderInput,
?   derivDurationType?: SortOrder | SortOrderInput,
?   derivAppId?: SortOrder | SortOrderInput,
?   derivTransactionId?: SortOrder | SortOrderInput,
?   user?: UserOrderByWithRelationInput
  }
}

Unknown argument `openTime`. Available options are marked with ?.
    at async c (.next/server/app/api/trades/history/route.js:1:1598) {
  clientVersion: '6.13.0'
}