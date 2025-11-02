import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  categories: defineTable({
    name: v.string(),
    image: v.string(),
    description: v.optional(v.string()),
  }),

  products: defineTable({
    name: v.string(),
    description: v.string(),
    price: v.number(),
    originalPrice: v.optional(v.number()),
    image: v.string(),
    categoryId: v.id("categories"),
    inStock: v.boolean(),
    unit: v.string(), // "kg", "piece", "liter", etc.
    minQuantity: v.optional(v.number()),
  }).index("by_category", ["categoryId"]),

  carts: defineTable({
    userId: v.id("users"),
    productId: v.id("products"),
    quantity: v.number(),
  }).index("by_user", ["userId"]),

  sharedOrders: defineTable({
    creatorId: v.id("users"),
    title: v.string(),
    description: v.string(),
    deliveryAddress: v.string(),
    deliveryTime: v.string(),
    maxParticipants: v.number(),
    currentParticipants: v.number(),
    minOrderAmount: v.number(),
    currentAmount: v.number(),
    status: v.union(
      v.literal("open"), 
      v.literal("closed"), 
      v.literal("confirmed"),
      v.literal("preparing"),
      v.literal("out_for_delivery"),
      v.literal("delivered")
    ),
    expiresAt: v.number(),
    // New time constraint fields
    orderDeadline: v.optional(v.number()), // When ordering must stop
    preparationTime: v.optional(v.number()), // Minutes needed to prepare
    deliveryStartTime: v.optional(v.number()), // When delivery actually starts
    estimatedDeliveryTime: v.optional(v.number()), // Estimated completion
    // Delivery tracking
    riderId: v.optional(v.string()),
    riderName: v.optional(v.string()),
    riderPhone: v.optional(v.string()),
  }).index("by_status", ["status"])
    .index("by_delivery_time", ["deliveryStartTime"]),

  sharedOrderParticipants: defineTable({
    sharedOrderId: v.id("sharedOrders"),
    userId: v.id("users"),
    totalAmount: v.number(),
    joinedAt: v.number(),
    // Delivery tracking for each participant
    deliveryAddress: v.string(),
    estimatedArrival: v.optional(v.number()),
    deliveryOrder: v.optional(v.number()), // Order in delivery route
    isDelivered: v.optional(v.boolean()),
    deliveredAt: v.optional(v.number()),
  }).index("by_shared_order", ["sharedOrderId"])
    .index("by_user", ["userId"])
    .index("by_delivery_order", ["sharedOrderId", "deliveryOrder"]),

  sharedOrderItems: defineTable({
    sharedOrderId: v.id("sharedOrders"),
    userId: v.id("users"),
    productId: v.id("products"),
    quantity: v.number(),
    price: v.number(),
  }).index("by_shared_order", ["sharedOrderId"])
    .index("by_user_and_order", ["userId", "sharedOrderId"]),

  orders: defineTable({
    userId: v.id("users"),
    items: v.array(v.object({
      productId: v.id("products"),
      quantity: v.number(),
      price: v.number(),
    })),
    totalAmount: v.number(),
    deliveryAddress: v.string(),
    status: v.union(v.literal("pending"), v.literal("confirmed"), v.literal("delivered")),
    sharedOrderId: v.optional(v.id("sharedOrders")),
  }).index("by_user", ["userId"]),

  // New table for live tracking
  deliveryTracking: defineTable({
    sharedOrderId: v.id("sharedOrders"),
    riderId: v.string(),
    currentLocation: v.object({
      lat: v.number(),
      lng: v.number(),
      timestamp: v.number(),
    }),
    route: v.array(v.object({
      participantId: v.id("sharedOrderParticipants"),
      address: v.string(),
      lat: v.number(),
      lng: v.number(),
      estimatedArrival: v.number(),
      isCompleted: v.boolean(),
      completedAt: v.optional(v.number()),
    })),
    totalDistance: v.optional(v.number()),
    estimatedDuration: v.optional(v.number()),
    lastUpdated: v.number(),
  }).index("by_shared_order", ["sharedOrderId"])
    .index("by_rider", ["riderId"]),

  // Notifications for participants
  notifications: defineTable({
    userId: v.id("users"),
    sharedOrderId: v.id("sharedOrders"),
    type: v.union(
      v.literal("order_confirmed"),
      v.literal("preparation_started"),
      v.literal("out_for_delivery"),
      v.literal("rider_nearby"),
      v.literal("next_stop"),
      v.literal("delivered")
    ),
    title: v.string(),
    message: v.string(),
    isRead: v.boolean(),
    createdAt: v.number(),
  }).index("by_user", ["userId"])
    .index("by_shared_order", ["sharedOrderId"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
