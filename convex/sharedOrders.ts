import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getActiveSharedOrders = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const orders = await ctx.db
      .query("sharedOrders")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .filter((q) => q.gt(q.field("expiresAt"), now))
      .collect();

    return await Promise.all(
      orders.map(async (order) => {
        const creator = await ctx.db.get(order.creatorId);
        const participants = await ctx.db
          .query("sharedOrderParticipants")
          .withIndex("by_shared_order", (q) => q.eq("sharedOrderId", order._id))
          .collect();

        // Calculate actual current amount from participants
        const actualCurrentAmount = participants.reduce((sum, p) => sum + p.totalAmount, 0);

        // Calculate time constraints
        const timeUntilDeadline = order.orderDeadline ? order.orderDeadline - now : null;
        const isOrderingClosed = order.orderDeadline ? now > order.orderDeadline : false;

        return {
          ...order,
          currentAmount: actualCurrentAmount, // Use calculated amount
          currentParticipants: participants.length, // Use actual participant count
          creator: creator?.name || creator?.email || "Unknown",
          creatorEmail: creator?.email || null,
          creatorPhone: creator?.phone || null,
          participantCount: participants.length,
          timeUntilDeadline,
          isOrderingClosed,
        };
      })
    );
  },
});

export const createSharedOrder = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    deliveryAddress: v.string(),
    deliveryTime: v.string(),
    maxParticipants: v.number(),
    minOrderAmount: v.number(),
    expiresInHours: v.number(),
    // New time constraint fields
    orderDeadlineInHours: v.optional(v.number()),
    preparationTimeInMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check creator's cart first
    const cartItems = await ctx.db
      .query("carts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    if (cartItems.length === 0) {
      throw new Error("Please add items to your cart before creating a group order");
    }

    // Calculate cart total
    let cartTotal = 0;
    for (const cartItem of cartItems) {
      const product = await ctx.db.get(cartItem.productId);
      if (product) {
        cartTotal += product.price * cartItem.quantity;
      }
    }

    if (cartTotal === 0) {
      throw new Error("Your cart is empty. Please add items before creating a group order");
    }

    const now = Date.now();
    const expiresAt = now + (args.expiresInHours * 60 * 60 * 1000);
    
    // Calculate order deadline (when participants can no longer add items)
    const orderDeadline = args.orderDeadlineInHours 
      ? now + (args.orderDeadlineInHours * 60 * 60 * 1000)
      : expiresAt - (60 * 60 * 1000); // Default: 1 hour before expiry

    const preparationTime = args.preparationTimeInMinutes || 30; // Default 30 minutes

    const sharedOrderId = await ctx.db.insert("sharedOrders", {
      creatorId: userId,
      title: args.title,
      description: args.description,
      deliveryAddress: args.deliveryAddress,
      deliveryTime: args.deliveryTime,
      maxParticipants: args.maxParticipants,
      currentParticipants: 1,
      minOrderAmount: args.minOrderAmount,
      currentAmount: cartTotal, // Include creator's cart total
      status: "open",
      expiresAt,
      orderDeadline,
      preparationTime: preparationTime * 60 * 1000, // Convert to milliseconds
    });

    // Add creator as first participant with their cart total
    await ctx.db.insert("sharedOrderParticipants", {
      sharedOrderId,
      userId,
      totalAmount: cartTotal,
      joinedAt: now,
      deliveryAddress: args.deliveryAddress,
    });

    // Add all creator's cart items to shared order
    for (const cartItem of cartItems) {
      const product = await ctx.db.get(cartItem.productId);
      if (product) {
        await ctx.db.insert("sharedOrderItems", {
          sharedOrderId,
          userId,
          productId: cartItem.productId,
          quantity: cartItem.quantity,
          price: product.price * cartItem.quantity,
        });
      }
    }

    // Clear creator's cart after successfully creating the order
    for (const cartItem of cartItems) {
      await ctx.db.delete(cartItem._id);
    }

    return sharedOrderId;
  },
});

export const joinSharedOrder = mutation({
  args: {
    sharedOrderId: v.id("sharedOrders"),
    deliveryAddress: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check user's cart first
    const cartItems = await ctx.db
      .query("carts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    if (cartItems.length === 0) {
      throw new Error("Please add items to your cart before joining a group order");
    }

    const sharedOrder = await ctx.db.get(args.sharedOrderId);
    if (!sharedOrder) throw new Error("Shared order not found");

    if (sharedOrder.status !== "open") {
      throw new Error("Shared order is no longer open");
    }

    // Check time constraints
    const now = Date.now();
    if (sharedOrder.orderDeadline && now > sharedOrder.orderDeadline) {
      throw new Error("Order deadline has passed. No new participants can join.");
    }

    // Get current participant count
    const currentParticipants = await ctx.db
      .query("sharedOrderParticipants")
      .withIndex("by_shared_order", (q) => q.eq("sharedOrderId", args.sharedOrderId))
      .collect();

    if (currentParticipants.length >= sharedOrder.maxParticipants) {
      throw new Error("Shared order is full");
    }

    // Check if user already joined
    const existingParticipant = currentParticipants.find(p => p.userId === userId);

    if (existingParticipant) {
      throw new Error("You have already joined this order");
    }

    // Calculate cart total
    let cartTotal = 0;
    for (const cartItem of cartItems) {
      const product = await ctx.db.get(cartItem.productId);
      if (product) {
        cartTotal += product.price * cartItem.quantity;
      }
    }

    if (cartTotal === 0) {
      throw new Error("Your cart is empty. Please add items before joining a group order");
    }

    await ctx.db.insert("sharedOrderParticipants", {
      sharedOrderId: args.sharedOrderId,
      userId,
      totalAmount: cartTotal,
      joinedAt: now,
      deliveryAddress: args.deliveryAddress,
    });

    // Add all cart items to shared order
    for (const cartItem of cartItems) {
      const product = await ctx.db.get(cartItem.productId);
      if (product) {
        await ctx.db.insert("sharedOrderItems", {
          sharedOrderId: args.sharedOrderId,
          userId,
          productId: cartItem.productId,
          quantity: cartItem.quantity,
          price: product.price * cartItem.quantity,
        });
      }
    }

    // Update the shared order with correct participant count and amount
    await ctx.db.patch(args.sharedOrderId, {
      currentParticipants: currentParticipants.length + 1,
      currentAmount: sharedOrder.currentAmount + cartTotal,
    });

    // Clear user's cart after successfully joining
    for (const cartItem of cartItems) {
      await ctx.db.delete(cartItem._id);
    }

    return { success: true, addedAmount: cartTotal, itemsAdded: cartItems.length };
  },
});

export const addItemToSharedOrder = mutation({
  args: {
    sharedOrderId: v.id("sharedOrders"),
    productId: v.id("products"),
    quantity: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found");

    const sharedOrder = await ctx.db.get(args.sharedOrderId);
    if (!sharedOrder || sharedOrder.status !== "open") {
      throw new Error("Shared order is not available");
    }

    // Check time constraints
    const now = Date.now();
    if (sharedOrder.orderDeadline && now > sharedOrder.orderDeadline) {
      throw new Error("Order deadline has passed. No more items can be added.");
    }

    // Check if user is participant
    const participant = await ctx.db
      .query("sharedOrderParticipants")
      .withIndex("by_shared_order", (q) => q.eq("sharedOrderId", args.sharedOrderId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .first();

    if (!participant) {
      throw new Error("You must join the shared order first");
    }

    const existingItem = await ctx.db
      .query("sharedOrderItems")
      .withIndex("by_user_and_order", (q) => q.eq("userId", userId).eq("sharedOrderId", args.sharedOrderId))
      .filter((q) => q.eq(q.field("productId"), args.productId))
      .first();

    const itemTotal = product.price * args.quantity;

    if (existingItem) {
      const newQuantity = existingItem.quantity + args.quantity;
      const newTotal = product.price * newQuantity;
      
      await ctx.db.patch(existingItem._id, {
        quantity: newQuantity,
        price: newTotal,
      });

      // Update participant total
      const oldItemTotal = existingItem.price;
      await ctx.db.patch(participant._id, {
        totalAmount: participant.totalAmount - oldItemTotal + newTotal,
      });

      // Calculate new shared order total from all participants
      const allParticipants = await ctx.db
        .query("sharedOrderParticipants")
        .withIndex("by_shared_order", (q) => q.eq("sharedOrderId", args.sharedOrderId))
        .collect();
      
      const newSharedOrderTotal = allParticipants.reduce((sum, p) => {
        if (p._id === participant._id) {
          return sum + participant.totalAmount - oldItemTotal + newTotal;
        }
        return sum + p.totalAmount;
      }, 0);

      await ctx.db.patch(args.sharedOrderId, {
        currentAmount: newSharedOrderTotal,
      });
    } else {
      await ctx.db.insert("sharedOrderItems", {
        sharedOrderId: args.sharedOrderId,
        userId,
        productId: args.productId,
        quantity: args.quantity,
        price: itemTotal,
      });

      // Update participant total
      await ctx.db.patch(participant._id, {
        totalAmount: participant.totalAmount + itemTotal,
      });

      // Update shared order total
      await ctx.db.patch(args.sharedOrderId, {
        currentAmount: sharedOrder.currentAmount + itemTotal,
      });
    }
  },
});

export const getSharedOrderDetails = query({
  args: { sharedOrderId: v.id("sharedOrders") },
  handler: async (ctx, args) => {
    const sharedOrder = await ctx.db.get(args.sharedOrderId);
    if (!sharedOrder) return null;

    const participants = await ctx.db
      .query("sharedOrderParticipants")
      .withIndex("by_shared_order", (q) => q.eq("sharedOrderId", args.sharedOrderId))
      .collect();

    const participantsWithDetails = await Promise.all(
      participants.map(async (participant) => {
        const user = await ctx.db.get(participant.userId);
        const items = await ctx.db
          .query("sharedOrderItems")
          .withIndex("by_user_and_order", (q) => 
            q.eq("userId", participant.userId).eq("sharedOrderId", args.sharedOrderId)
          )
          .collect();

        const itemsWithProducts = await Promise.all(
          items.map(async (item) => {
            const product = await ctx.db.get(item.productId);
            return { ...item, product };
          })
        );

        return {
          ...participant,
          user: user?.name || user?.email || "Unknown",
          userEmail: user?.email || null,
          userPhone: user?.phone || null,
          items: itemsWithProducts,
        };
      })
    );

    const creator = await ctx.db.get(sharedOrder.creatorId);

    // Calculate actual current amount from participants
    const actualCurrentAmount = participants.reduce((sum, p) => sum + p.totalAmount, 0);

    // Calculate time constraints
    const now = Date.now();
    const timeUntilDeadline = sharedOrder.orderDeadline ? sharedOrder.orderDeadline - now : null;
    const isOrderingClosed = sharedOrder.orderDeadline ? now > sharedOrder.orderDeadline : false;

    return {
      ...sharedOrder,
      currentAmount: actualCurrentAmount, // Use calculated amount
      currentParticipants: participants.length, // Use actual participant count
      creator: creator?.name || creator?.email || "Unknown",
      creatorEmail: creator?.email || null,
      creatorPhone: creator?.phone || null,
      participants: participantsWithDetails,
      timeUntilDeadline,
      isOrderingClosed,
    };
  },
});

export const getMySharedOrders = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const participations = await ctx.db
      .query("sharedOrderParticipants")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return await Promise.all(
      participations.map(async (participation) => {
        const sharedOrder = await ctx.db.get(participation.sharedOrderId);
        const creator = sharedOrder ? await ctx.db.get(sharedOrder.creatorId) : null;
        
        return {
          ...participation,
          sharedOrder,
          creator: creator?.name || creator?.email || "Unknown",
        };
      })
    );
  },
});

// Get user's joined shared orders that are still open for adding items
export const getMyOpenSharedOrders = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const participations = await ctx.db
      .query("sharedOrderParticipants")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const openOrders = [];
    const now = Date.now();

    for (const participation of participations) {
      const sharedOrder = await ctx.db.get(participation.sharedOrderId);
      if (sharedOrder && 
          sharedOrder.status === "open" && 
          (!sharedOrder.orderDeadline || now < sharedOrder.orderDeadline)) {
        openOrders.push({
          ...sharedOrder,
          participationId: participation._id,
        });
      }
    }

    return openOrders;
  },
});

export const confirmSharedOrder = mutation({
  args: { sharedOrderId: v.id("sharedOrders") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const sharedOrder = await ctx.db.get(args.sharedOrderId);
    if (!sharedOrder) throw new Error("Shared order not found");

    // Only creator can confirm
    if (sharedOrder.creatorId !== userId) {
      throw new Error("Only the order creator can confirm the order");
    }

    if (sharedOrder.status !== "open") {
      throw new Error("Order cannot be confirmed in current status");
    }

    // Calculate actual current amount from participants
    const orderParticipants = await ctx.db
      .query("sharedOrderParticipants")
      .withIndex("by_shared_order", (q) => q.eq("sharedOrderId", args.sharedOrderId))
      .collect();
    
    const actualCurrentAmount = orderParticipants.reduce((sum, p) => sum + p.totalAmount, 0);

    if (actualCurrentAmount < sharedOrder.minOrderAmount) {
      throw new Error(`Minimum order amount not reached. Current: ₹${actualCurrentAmount}, Required: ₹${sharedOrder.minOrderAmount}`);
    }

    const now = Date.now();
    const estimatedDeliveryTime = now + (sharedOrder.preparationTime || 30 * 60 * 1000);

    await ctx.db.patch(args.sharedOrderId, {
      status: "confirmed",
      estimatedDeliveryTime,
      currentAmount: actualCurrentAmount, // Update with calculated amount
    });

    // Send notifications to all participants
    const participants = await ctx.db
      .query("sharedOrderParticipants")
      .withIndex("by_shared_order", (q) => q.eq("sharedOrderId", args.sharedOrderId))
      .collect();

    for (const participant of participants) {
      await ctx.db.insert("notifications", {
        userId: participant.userId,
        sharedOrderId: args.sharedOrderId,
        type: "order_confirmed",
        title: "✅ Order Confirmed!",
        message: "Your group order has been confirmed and is being prepared. You'll receive updates as it progresses.",
        isRead: false,
        createdAt: now,
      });
    }
  },
});

export const deleteSharedOrder = mutation({
  args: { sharedOrderId: v.id("sharedOrders") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const sharedOrder = await ctx.db.get(args.sharedOrderId);
    if (!sharedOrder) throw new Error("Shared order not found");

    // Only creator can delete
    if (sharedOrder.creatorId !== userId) {
      throw new Error("Only the order creator can delete the order");
    }

    // Can only delete orders that are still "open"
    if (sharedOrder.status !== "open") {
      throw new Error("Cannot delete order that has already been confirmed or is in progress");
    }

    // Get all participants and order items
    const participants = await ctx.db
      .query("sharedOrderParticipants")
      .withIndex("by_shared_order", (q) => q.eq("sharedOrderId", args.sharedOrderId))
      .collect();

    const orderItems = await ctx.db
      .query("sharedOrderItems")
      .withIndex("by_shared_order", (q) => q.eq("sharedOrderId", args.sharedOrderId))
      .collect();

    // Restore items to participants' carts
    for (const item of orderItems) {
      const existingCartItem = await ctx.db
        .query("carts")
        .withIndex("by_user", (q) => q.eq("userId", item.userId))
        .filter((q) => q.eq(q.field("productId"), item.productId))
        .first();

      if (existingCartItem) {
        await ctx.db.patch(existingCartItem._id, {
          quantity: existingCartItem.quantity + item.quantity,
        });
      } else {
        await ctx.db.insert("carts", {
          userId: item.userId,
          productId: item.productId,
          quantity: item.quantity,
        });
      }
      await ctx.db.delete(item._id);
    }

    // Notify participants and clean up
    const now = Date.now();
    for (const participant of participants) {
      await ctx.db.insert("notifications", {
        userId: participant.userId,
        sharedOrderId: args.sharedOrderId,
        type: "order_confirmed",
        title: "❌ Group Order Cancelled",
        message: "The group order has been cancelled by the creator. Your items have been restored to your cart.",
        isRead: false,
        createdAt: now,
      });
      await ctx.db.delete(participant._id);
    }

    // Clean up notifications and tracking
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_shared_order", (q) => q.eq("sharedOrderId", args.sharedOrderId))
      .collect();

    for (const notification of notifications) {
      if (notification.title !== "❌ Group Order Cancelled") {
        await ctx.db.delete(notification._id);
      }
    }

    const tracking = await ctx.db
      .query("deliveryTracking")
      .withIndex("by_shared_order", (q) => q.eq("sharedOrderId", args.sharedOrderId))
      .first();

    if (tracking) {
      await ctx.db.delete(tracking._id);
    }

    // Delete the shared order
    await ctx.db.delete(args.sharedOrderId);

    return { success: true };
  },
});

export const leaveSharedOrder = mutation({
  args: { sharedOrderId: v.id("sharedOrders") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const sharedOrder = await ctx.db.get(args.sharedOrderId);
    if (!sharedOrder) throw new Error("Shared order not found");

    // Can only leave orders that are still "open"
    if (sharedOrder.status !== "open") {
      throw new Error("Cannot leave order that has already been confirmed or is in progress");
    }

    // Find user's participation
    const participation = await ctx.db
      .query("sharedOrderParticipants")
      .withIndex("by_shared_order", (q) => q.eq("sharedOrderId", args.sharedOrderId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .first();

    if (!participation) {
      throw new Error("You are not a participant in this order");
    }

    // Creator cannot leave their own order (they should delete it instead)
    if (sharedOrder.creatorId === userId) {
      throw new Error("Order creators cannot leave their own order. Use delete instead.");
    }

    // Get user's items from the order
    const userItems = await ctx.db
      .query("sharedOrderItems")
      .withIndex("by_user_and_order", (q) => q.eq("userId", userId).eq("sharedOrderId", args.sharedOrderId))
      .collect();

    // Restore items to user's cart
    for (const item of userItems) {
      const existingCartItem = await ctx.db
        .query("carts")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .filter((q) => q.eq(q.field("productId"), item.productId))
        .first();

      if (existingCartItem) {
        await ctx.db.patch(existingCartItem._id, {
          quantity: existingCartItem.quantity + item.quantity,
        });
      } else {
        await ctx.db.insert("carts", {
          userId: userId,
          productId: item.productId,
          quantity: item.quantity,
        });
      }

      // Delete the order item
      await ctx.db.delete(item._id);
    }

    // Update shared order totals
    const newCurrentAmount = sharedOrder.currentAmount - participation.totalAmount;
    const newParticipantCount = sharedOrder.currentParticipants - 1;

    await ctx.db.patch(args.sharedOrderId, {
      currentAmount: newCurrentAmount,
      currentParticipants: newParticipantCount,
    });

    // Delete participation record
    await ctx.db.delete(participation._id);

    // Notify the order creator
    const now = Date.now();
    const user = await ctx.db.get(userId);
    await ctx.db.insert("notifications", {
      userId: sharedOrder.creatorId,
      sharedOrderId: args.sharedOrderId,
      type: "order_confirmed",
      title: "👋 Participant Left Order",
      message: `${user?.name || user?.email || "A participant"} has left your group order. Their items have been removed from the order.`,
      isRead: false,
      createdAt: now,
    });

    return { success: true, restoredAmount: participation.totalAmount, restoredItems: userItems.length };
  },
});
