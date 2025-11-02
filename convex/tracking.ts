import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

// Get live tracking data for a shared order
export const getDeliveryTracking = query({
  args: { sharedOrderId: v.id("sharedOrders") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    // Check if user is participant
    const participant = await ctx.db
      .query("sharedOrderParticipants")
      .withIndex("by_shared_order", (q) => q.eq("sharedOrderId", args.sharedOrderId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .first();

    if (!participant) return null;

    const tracking = await ctx.db
      .query("deliveryTracking")
      .withIndex("by_shared_order", (q) => q.eq("sharedOrderId", args.sharedOrderId))
      .first();

    if (!tracking) return null;

    const sharedOrder = await ctx.db.get(args.sharedOrderId);
    
    return {
      ...tracking,
      sharedOrder,
      userDeliveryOrder: participant.deliveryOrder,
      userEstimatedArrival: participant.estimatedArrival,
      isUserDelivered: participant.isDelivered,
    };
  },
});

// Update rider location (would be called by delivery app)
export const updateRiderLocation = mutation({
  args: {
    sharedOrderId: v.id("sharedOrders"),
    riderId: v.string(),
    lat: v.number(),
    lng: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    const existingTracking = await ctx.db
      .query("deliveryTracking")
      .withIndex("by_shared_order", (q) => q.eq("sharedOrderId", args.sharedOrderId))
      .first();

    if (existingTracking) {
      await ctx.db.patch(existingTracking._id, {
        currentLocation: {
          lat: args.lat,
          lng: args.lng,
          timestamp: now,
        },
        lastUpdated: now,
      });
    }

    // Check if rider is near any participant and send notifications
    await ctx.scheduler.runAfter(0, internal.tracking.checkProximityNotifications, {
      sharedOrderId: args.sharedOrderId,
      riderLat: args.lat,
      riderLng: args.lng,
    });
  },
});

// Start delivery tracking
export const startDeliveryTracking = mutation({
  args: {
    sharedOrderId: v.id("sharedOrders"),
    riderId: v.string(),
    riderName: v.string(),
    riderPhone: v.string(),
  },
  handler: async (ctx, args) => {
    const sharedOrder = await ctx.db.get(args.sharedOrderId);
    if (!sharedOrder) throw new Error("Shared order not found");

    // Update shared order status
    await ctx.db.patch(args.sharedOrderId, {
      status: "out_for_delivery",
      riderId: args.riderId,
      riderName: args.riderName,
      riderPhone: args.riderPhone,
      deliveryStartTime: Date.now(),
    });

    // Get all participants and create delivery route
    const participants = await ctx.db
      .query("sharedOrderParticipants")
      .withIndex("by_shared_order", (q) => q.eq("sharedOrderId", args.sharedOrderId))
      .collect();

    // Create optimized route (simplified - in real app would use routing API)
    const route = participants.map((participant, index) => ({
      participantId: participant._id,
      address: participant.deliveryAddress,
      lat: 28.6139 + (Math.random() - 0.5) * 0.1, // Mock coordinates
      lng: 77.2090 + (Math.random() - 0.5) * 0.1,
      estimatedArrival: Date.now() + (index + 1) * 15 * 60 * 1000, // 15 min intervals
      isCompleted: false,
    }));

    // Update participants with delivery order and estimated arrival
    for (let i = 0; i < participants.length; i++) {
      await ctx.db.patch(participants[i]._id, {
        deliveryOrder: i + 1,
        estimatedArrival: route[i].estimatedArrival,
      });
    }

    // Create tracking record
    await ctx.db.insert("deliveryTracking", {
      sharedOrderId: args.sharedOrderId,
      riderId: args.riderId,
      currentLocation: {
        lat: 28.6139, // Starting location (mock)
        lng: 77.2090,
        timestamp: Date.now(),
      },
      route,
      totalDistance: route.length * 2, // Mock distance in km
      estimatedDuration: route.length * 15, // Mock duration in minutes
      lastUpdated: Date.now(),
    });

    // Send notifications to all participants
    for (const participant of participants) {
      await ctx.db.insert("notifications", {
        userId: participant.userId,
        sharedOrderId: args.sharedOrderId,
        type: "out_for_delivery",
        title: "🚚 Your order is out for delivery!",
        message: `${args.riderName} is on the way with your group order. Track live location in the app.`,
        isRead: false,
        createdAt: Date.now(),
      });
    }
  },
});

// Mark delivery as completed for a participant
export const completeDelivery = mutation({
  args: {
    sharedOrderId: v.id("sharedOrders"),
    participantId: v.id("sharedOrderParticipants"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // Update participant
    const participant = await ctx.db.get(args.participantId);
    if (!participant) throw new Error("Participant not found");

    await ctx.db.patch(args.participantId, {
      isDelivered: true,
      deliveredAt: now,
    });

    // Update tracking route
    const tracking = await ctx.db
      .query("deliveryTracking")
      .withIndex("by_shared_order", (q) => q.eq("sharedOrderId", args.sharedOrderId))
      .first();

    if (tracking) {
      const updatedRoute = tracking.route.map(stop => 
        stop.participantId === args.participantId 
          ? { ...stop, isCompleted: true, completedAt: now }
          : stop
      );

      await ctx.db.patch(tracking._id, {
        route: updatedRoute,
        lastUpdated: now,
      });
    }

    // Send delivery confirmation notification
    await ctx.db.insert("notifications", {
      userId: participant.userId,
      sharedOrderId: args.sharedOrderId,
      type: "delivered",
      title: "✅ Order Delivered!",
      message: "Your items have been delivered successfully. Enjoy your groceries!",
      isRead: false,
      createdAt: now,
    });

    // Check if all deliveries are complete
    const allParticipants = await ctx.db
      .query("sharedOrderParticipants")
      .withIndex("by_shared_order", (q) => q.eq("sharedOrderId", args.sharedOrderId))
      .collect();

    const allDelivered = allParticipants.every(p => p.isDelivered);
    
    if (allDelivered) {
      await ctx.db.patch(args.sharedOrderId, {
        status: "delivered",
      });
    }
  },
});

// Internal function to check proximity and send notifications
export const checkProximityNotifications = internalMutation({
  args: {
    sharedOrderId: v.id("sharedOrders"),
    riderLat: v.number(),
    riderLng: v.number(),
  },
  handler: async (ctx, args) => {
    const tracking = await ctx.db
      .query("deliveryTracking")
      .withIndex("by_shared_order", (q) => q.eq("sharedOrderId", args.sharedOrderId))
      .first();

    if (!tracking) return;

    // Find next undelivered stop
    const nextStop = tracking.route.find(stop => !stop.isCompleted);
    if (!nextStop) return;

    // Calculate distance (simplified - in real app would use proper distance calculation)
    const distance = Math.sqrt(
      Math.pow(args.riderLat - nextStop.lat, 2) + 
      Math.pow(args.riderLng - nextStop.lng, 2)
    ) * 111; // Rough conversion to km

    // If rider is within 500m of next stop
    if (distance < 0.5) {
      const participant = await ctx.db.get(nextStop.participantId);
      if (!participant) return;

      // Check if we already sent a "nearby" notification recently
      const recentNotification = await ctx.db
        .query("notifications")
        .withIndex("by_user", (q) => q.eq("userId", participant.userId))
        .filter((q) => 
          q.eq(q.field("type"), "rider_nearby") &&
          q.eq(q.field("sharedOrderId"), args.sharedOrderId) &&
          q.gt(q.field("createdAt"), Date.now() - 10 * 60 * 1000) // Within last 10 minutes
        )
        .first();

      if (!recentNotification) {
        await ctx.db.insert("notifications", {
          userId: participant.userId,
          sharedOrderId: args.sharedOrderId,
          type: "rider_nearby",
          title: "🚚 Rider is nearby!",
          message: "Your delivery rider is approaching your location. Please be ready to receive your order.",
          isRead: false,
          createdAt: Date.now(),
        });
      }
    }

    // Send "next stop" notifications to upcoming participants
    const currentStopIndex = tracking.route.findIndex(stop => stop.participantId === nextStop.participantId);
    const upcomingStop = tracking.route[currentStopIndex + 1];
    
    if (upcomingStop && distance < 1) { // Within 1km of current stop
      const upcomingParticipant = await ctx.db.get(upcomingStop.participantId);
      if (!upcomingParticipant) return;

      const recentNextStopNotification = await ctx.db
        .query("notifications")
        .withIndex("by_user", (q) => q.eq("userId", upcomingParticipant.userId))
        .filter((q) => 
          q.eq(q.field("type"), "next_stop") &&
          q.eq(q.field("sharedOrderId"), args.sharedOrderId) &&
          q.gt(q.field("createdAt"), Date.now() - 15 * 60 * 1000) // Within last 15 minutes
        )
        .first();

      if (!recentNextStopNotification) {
        await ctx.db.insert("notifications", {
          userId: upcomingParticipant.userId,
          sharedOrderId: args.sharedOrderId,
          type: "next_stop",
          title: "📍 You're next!",
          message: "Your stop is coming up next! The rider will be at your location in approximately 10-15 minutes.",
          isRead: false,
          createdAt: Date.now(),
        });
      }
    }
  },
});

// Get user notifications
export const getUserNotifications = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(20);
  },
});

// Mark notification as read
export const markNotificationRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const notification = await ctx.db.get(args.notificationId);
    if (!notification || notification.userId !== userId) {
      throw new Error("Notification not found");
    }

    await ctx.db.patch(args.notificationId, { isRead: true });
  },
});
