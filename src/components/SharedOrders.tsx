import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useState } from "react";
import { toast } from "sonner";
import { LiveTracking } from "./LiveTracking";

export function SharedOrders() {
  const activeOrders = useQuery(api.sharedOrders.getActiveSharedOrders);
  const myOrders = useQuery(api.sharedOrders.getMySharedOrders);
  const cartSummary = useQuery(api.cart.getCartSummary);
  const createOrder = useMutation(api.sharedOrders.createSharedOrder);
  const joinOrder = useMutation(api.sharedOrders.joinSharedOrder);
  const confirmOrder = useMutation(api.sharedOrders.confirmSharedOrder);
  const deleteOrder = useMutation(api.sharedOrders.deleteSharedOrder);
  const leaveOrder = useMutation(api.sharedOrders.leaveSharedOrder);
  const startTracking = useMutation(api.tracking.startDeliveryTracking);
  
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<Id<"sharedOrders"> | null>(null);
  const [showTracking, setShowTracking] = useState<Id<"sharedOrders"> | null>(null);

  const orderDetails = useQuery(
    api.sharedOrders.getSharedOrderDetails,
    selectedOrderId ? { sharedOrderId: selectedOrderId } : "skip"
  );
  
  const loggedInUser = useQuery(api.auth.loggedInUser);

  // Debug logging
  console.log("Selected Order ID:", selectedOrderId);
  console.log("Order Details:", orderDetails);

  const handleCreateOrder = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Check if cart is empty before creating
    if (!cartSummary || cartSummary.totalItems === 0) {
      toast.error("Please add items to your cart before creating a group order");
      return;
    }
    
    const formData = new FormData(e.currentTarget);
    
    try {
      await createOrder({
        title: formData.get("title") as string,
        description: formData.get("description") as string,
        deliveryAddress: formData.get("deliveryAddress") as string,
        deliveryTime: formData.get("deliveryTime") as string,
        maxParticipants: parseInt(formData.get("maxParticipants") as string),
        minOrderAmount: parseFloat(formData.get("minOrderAmount") as string),
        expiresInHours: parseInt(formData.get("expiresInHours") as string),
        orderDeadlineInHours: parseFloat(formData.get("orderDeadlineInHours") as string) || undefined,
        preparationTimeInMinutes: parseInt(formData.get("preparationTimeInMinutes") as string) || undefined,
      });
      
      toast.success("Group order created successfully!");
      setShowCreateForm(false);
      (e.target as HTMLFormElement).reset();
    } catch (error: any) {
      toast.error(error.message || "Failed to create group order");
    }
  };

  const handleJoinOrder = async (orderId: Id<"sharedOrders">) => {
    const address = prompt("Please enter your delivery address:");
    if (!address) return;

    try {
      const result = await joinOrder({ 
        sharedOrderId: orderId,
        deliveryAddress: address
      });
      
      if (result && result.success) {
        toast.success(`Joined group order successfully! Added ₹${result.addedAmount} from your cart (${result.itemsAdded} items)`);
      } else {
        toast.success("Joined group order successfully!");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to join group order");
    }
  };

  const handleConfirmOrder = async (orderId: Id<"sharedOrders">) => {
    try {
      await confirmOrder({ sharedOrderId: orderId });
      toast.success("Order confirmed! Preparation will begin shortly.");
    } catch (error: any) {
      toast.error(error.message || "Failed to confirm order");
    }
  };

  const handleStartDelivery = async (orderId: Id<"sharedOrders">) => {
    try {
      // Mock rider assignment
      await startTracking({
        sharedOrderId: orderId,
        riderId: "rider_" + Math.random().toString(36).substr(2, 9),
        riderName: "Raj Kumar",
        riderPhone: "+91 98765 43210"
      });
      toast.success("Delivery started! Live tracking is now available.");
    } catch (error: any) {
      toast.error(error.message || "Failed to start delivery");
    }
  };

  const handleDeleteOrder = async (orderId: Id<"sharedOrders">) => {
    if (!confirm("Are you sure you want to delete this group order? All participants will be notified and their items will be restored to their carts.")) {
      return;
    }

    try {
      await deleteOrder({ sharedOrderId: orderId });
      toast.success("Group order deleted successfully! All participants have been notified.");
      setSelectedOrderId(null); // Go back to main view if we were viewing this order
    } catch (error: any) {
      toast.error(error.message || "Failed to delete group order");
    }
  };

  const handleLeaveOrder = async (orderId: Id<"sharedOrders">) => {
    if (!confirm("Are you sure you want to leave this group order? Your items will be restored to your cart.")) {
      return;
    }

    try {
      const result = await leaveOrder({ sharedOrderId: orderId });
      if (result && result.success) {
        toast.success(`Left group order successfully! ₹${result.restoredAmount} worth of items (${result.restoredItems} items) restored to your cart.`);
      } else {
        toast.success("Left group order successfully!");
      }
      setSelectedOrderId(null); // Go back to main view
    } catch (error: any) {
      toast.error(error.message || "Failed to leave group order");
    }
  };

  const formatTimeRemaining = (expiresAt: number) => {
    const now = Date.now();
    const remaining = expiresAt - now;
    
    if (remaining <= 0) return "Expired";
    
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m left`;
    }
    return `${minutes}m left`;
  };

  const formatDeadlineTime = (deadline: number | null | undefined) => {
    if (!deadline) return null;
    const now = Date.now();
    const remaining = deadline - now;
    
    if (remaining <= 0) return "Deadline passed";
    
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m to add items`;
    }
    return `${minutes}m to add items`;
  };

  if (!activeOrders || !myOrders) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (showTracking) {
    return (
      <LiveTracking 
        sharedOrderId={showTracking} 
        onBack={() => setShowTracking(null)} 
      />
    );
  }

  if (selectedOrderId) {
    if (orderDetails === undefined) {
      return (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSelectedOrderId(null)}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              ← Back
            </button>
            <h2 className="text-2xl font-semibold text-gray-800">Loading Order Details...</h2>
          </div>
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
          </div>
        </div>
      );
    }

    if (orderDetails === null) {
      return (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSelectedOrderId(null)}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              ← Back
            </button>
            <h2 className="text-2xl font-semibold text-gray-800">Order Not Found</h2>
          </div>
          <div className="text-center py-12">
            <div className="text-4xl mb-4">❌</div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Order not found</h3>
            <p className="text-gray-600">This order may have been deleted or you don't have access to it.</p>
          </div>
        </div>
      );
    }

    const isCreator = loggedInUser?._id === orderDetails.creatorId;
    const canConfirm = isCreator && orderDetails.status === "open" && 
                      orderDetails.currentAmount >= orderDetails.minOrderAmount;
    const canStartDelivery = isCreator && orderDetails.status === "confirmed";
    const canTrack = ["out_for_delivery", "delivered"].includes(orderDetails.status);
    const canDelete = isCreator && orderDetails.status === "open";
    const canLeave = !isCreator && orderDetails.status === "open";

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSelectedOrderId(null)}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            ← Back
          </button>
          <h2 className="text-2xl font-semibold text-gray-800">Group Order Details</h2>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="mb-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">{orderDetails.title}</h3>
                <p className="text-gray-600 mb-4">{orderDetails.description}</p>
                
                {/* Creator Contact Information */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <h4 className="font-medium text-blue-800 mb-2">👤 Order Creator</h4>
                  <div className="text-sm text-blue-700 space-y-1">
                    <p><span className="font-medium">Name:</span> {orderDetails.creator}</p>
                    {orderDetails.creatorEmail && (
                      <p><span className="font-medium">📧 Email:</span> {orderDetails.creatorEmail}</p>
                    )}
                    {orderDetails.creatorPhone && (
                      <p><span className="font-medium">📱 Phone:</span> {orderDetails.creatorPhone}</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  orderDetails.status === "open" ? "bg-green-100 text-green-800" :
                  orderDetails.status === "confirmed" ? "bg-blue-100 text-blue-800" :
                  orderDetails.status === "out_for_delivery" ? "bg-yellow-100 text-yellow-800" :
                  "bg-gray-100 text-gray-800"
                }`}>
                  {orderDetails.status.replace('_', ' ').toUpperCase()}
                </span>
              </div>
            </div>
            
            {/* Time Constraints Display */}
            {orderDetails.timeUntilDeadline !== null && (
              <div className={`p-3 rounded-lg mb-4 ${
                orderDetails.isOrderingClosed 
                  ? 'bg-red-50 border border-red-200' 
                  : orderDetails.timeUntilDeadline < 60 * 60 * 1000 
                  ? 'bg-yellow-50 border border-yellow-200'
                  : 'bg-blue-50 border border-blue-200'
              }`}>
                <p className={`text-sm font-medium ${
                  orderDetails.isOrderingClosed ? 'text-red-800' :
                  orderDetails.timeUntilDeadline < 60 * 60 * 1000 ? 'text-yellow-800' :
                  'text-blue-800'
                }`}>
                  ⏰ {orderDetails.isOrderingClosed 
                    ? 'Order deadline has passed - no more items can be added' 
                    : formatDeadlineTime(orderDetails.orderDeadline)}
                </p>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">📍 Delivery Address:</span>
                <p className="text-gray-600">{orderDetails.deliveryAddress}</p>
              </div>
              <div>
                <span className="font-medium text-gray-700">⏰ Delivery Time:</span>
                <p className="text-gray-600">{orderDetails.deliveryTime}</p>
              </div>
              <div>
                <span className="font-medium text-gray-700">👥 Participants:</span>
                <p className="text-gray-600">{orderDetails.currentParticipants}/{orderDetails.maxParticipants}</p>
              </div>
              <div>
                <span className="font-medium text-gray-700">💰 Current Total:</span>
                <p className="text-gray-600">₹{orderDetails.currentAmount} (Min: ₹{orderDetails.minOrderAmount})</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              {canConfirm && (
                <button
                  onClick={() => handleConfirmOrder(orderDetails._id)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  ✅ Confirm Order
                </button>
              )}
              {canStartDelivery && (
                <button
                  onClick={() => handleStartDelivery(orderDetails._id)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  🚚 Start Delivery
                </button>
              )}
              {canTrack && (
                <button
                  onClick={() => setShowTracking(orderDetails._id)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  📍 Live Tracking
                </button>
              )}
              {canDelete && (
                <button
                  onClick={() => handleDeleteOrder(orderDetails._id)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  🗑️ Delete Order
                </button>
              )}
              {canLeave && (
                <button
                  onClick={() => handleLeaveOrder(orderDetails._id)}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                >
                  🚪 Leave Order
                </button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold text-gray-800">Participants & Orders:</h4>
            {orderDetails.participants.map((participant) => (
              <div key={participant._id} className="border border-gray-100 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h5 className="font-medium text-gray-800">{participant.user}</h5>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>Joined {new Date(participant.joinedAt).toLocaleDateString()}</p>
                      {participant.userEmail && (
                        <p>📧 {participant.userEmail}</p>
                      )}
                      {participant.userPhone && (
                        <p>📱 {participant.userPhone}</p>
                      )}
                      <p className="text-gray-500">📍 {participant.deliveryAddress}</p>
                      {participant.deliveryOrder && (
                        <p className="text-blue-600">🚚 Delivery #{participant.deliveryOrder}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-green-600">₹{participant.totalAmount}</span>
                    {participant.isDelivered && (
                      <p className="text-sm text-green-600 mt-1">✅ Delivered</p>
                    )}
                  </div>
                </div>
                
                {participant.items.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">Items:</p>
                    {participant.items.map((item) => (
                      <div key={item._id} className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">
                          {item.product?.image} {item.product?.name} x{item.quantity}
                        </span>
                        <span className="text-gray-800">₹{item.price}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold text-gray-800">Group Orders 👥</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          {showCreateForm ? "Cancel" : "Create Group Order"}
        </button>
      </div>

      {showCreateForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Create New Group Order</h3>
          <form onSubmit={handleCreateOrder} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Order Title
                </label>
                <input
                  name="title"
                  type="text"
                  required
                  placeholder="e.g., Hostel Block A Grocery Run"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Participants
                </label>
                <input
                  name="maxParticipants"
                  type="number"
                  required
                  min="2"
                  max="10"
                  defaultValue="5"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                name="description"
                required
                placeholder="Brief description of the group order..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Delivery Address
                </label>
                <input
                  name="deliveryAddress"
                  type="text"
                  required
                  placeholder="e.g., Hostel Block A, Room 101"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Preferred Delivery Time
                </label>
                <input
                  name="deliveryTime"
                  type="text"
                  required
                  placeholder="e.g., Today 6:00 PM"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Minimum Order Amount (₹)
                </label>
                <input
                  name="minOrderAmount"
                  type="number"
                  required
                  min="100"
                  defaultValue="500"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expires In (hours)
                </label>
                <input
                  name="expiresInHours"
                  type="number"
                  required
                  min="1"
                  max="24"
                  defaultValue="4"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* New Time Constraint Fields */}
            <div className="border-t pt-4">
              <h4 className="font-medium text-gray-800 mb-3">⏰ Time Constraints (Optional)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Order Deadline (hours from now)
                  </label>
                  <input
                    name="orderDeadlineInHours"
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="23"
                    placeholder="e.g., 2.5"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">When participants can no longer add items</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Preparation Time (minutes)
                  </label>
                  <input
                    name="preparationTimeInMinutes"
                    type="number"
                    min="15"
                    max="120"
                    defaultValue="30"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">Time needed to prepare the order</p>
                </div>
              </div>
            </div>

            {/* Cart requirement notice */}
            {(!cartSummary || cartSummary.totalItems === 0) && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start">
                  <div className="text-yellow-400 mr-3">⚠️</div>
                  <div>
                    <h4 className="font-medium text-yellow-800">Cart Required</h4>
                    <p className="text-yellow-700 text-sm mt-1">
                      You need to add items to your cart before creating a group order. Your cart items will be included in the group order.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={!cartSummary || cartSummary.totalItems === 0}
              className="w-full py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {!cartSummary || cartSummary.totalItems === 0 
                ? "Add items to cart first" 
                : `Create Group Order (₹${cartSummary.totalAmount})`}
            </button>
          </form>
        </div>
      )}

      {/* My Group Orders */}
      {myOrders.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800">My Group Orders</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myOrders.map((order) => (
              <div key={order._id} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-gray-800">{order.sharedOrder?.title}</h4>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    order.sharedOrder?.status === "open" ? "bg-green-100 text-green-800" :
                    order.sharedOrder?.status === "confirmed" ? "bg-blue-100 text-blue-800" :
                    order.sharedOrder?.status === "out_for_delivery" ? "bg-yellow-100 text-yellow-800" :
                    "bg-gray-100 text-gray-800"
                  }`}>
                    {order.sharedOrder?.status?.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-2">{order.sharedOrder?.description}</p>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Your contribution: ₹{order.totalAmount}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedOrderId(order.sharedOrderId)}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Details →
                    </button>
                    {["out_for_delivery", "delivered"].includes(order.sharedOrder?.status || "") && (
                      <button
                        onClick={() => setShowTracking(order.sharedOrderId)}
                        className="text-purple-600 hover:text-purple-800 font-medium"
                      >
                        📍 Track
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cart Status Info */}
      {cartSummary && cartSummary.totalItems === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800 font-medium">⚠️ Your cart is empty</p>
          <p className="text-yellow-700 text-sm mt-1">
            Add items to your cart before joining a group order.
          </p>
        </div>
      )}

      {cartSummary && cartSummary.totalItems > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-800 font-medium">
            🛒 Cart Ready: {cartSummary.totalItems} items (₹{cartSummary.totalAmount})
          </p>
        </div>
      )}

      {/* Active Group Orders */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-800">Available Group Orders</h3>
        
        {activeOrders.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <div className="text-4xl mb-4">👥</div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">No active group orders</h3>
            <p className="text-gray-600">Be the first to create a group order and save on delivery!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeOrders.map((order) => (
              <div key={order._id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-semibold text-gray-800">{order.title}</h4>
                    <p className="text-sm text-gray-600">by {order.creator}</p>
                    {order.creatorPhone && (
                      <p className="text-xs text-gray-500">📱 {order.creatorPhone}</p>
                    )}
                  </div>
                  <span className="text-xs text-orange-600 font-medium">
                    {formatTimeRemaining(order.expiresAt)}
                  </span>
                </div>
                
                <p className="text-sm text-gray-600 mb-3">{order.description}</p>
                
                {/* Time Constraints Display */}
                {order.timeUntilDeadline !== null && (
                  <div className={`p-2 rounded text-xs mb-3 ${
                    order.isOrderingClosed 
                      ? 'bg-red-100 text-red-800' 
                      : order.timeUntilDeadline < 60 * 60 * 1000 
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    ⏰ {order.isOrderingClosed 
                      ? 'Ordering closed' 
                      : formatDeadlineTime(order.orderDeadline)}
                  </div>
                )}
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">📍 {order.deliveryAddress}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">⏰ {order.deliveryTime}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">👥 Participants:</span>
                    <span className="font-medium">{order.currentParticipants}/{order.maxParticipants}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">💰 Current Total:</span>
                    <span className="font-medium text-green-600">₹{order.currentAmount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Minimum:</span>
                    <span className="text-gray-800">₹{order.minOrderAmount}</span>
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => handleJoinOrder(order._id)}
                    disabled={order.currentParticipants >= order.maxParticipants || order.isOrderingClosed || !cartSummary || cartSummary.totalItems === 0}
                    className="flex-1 py-2 px-4 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    {order.currentParticipants >= order.maxParticipants ? "Full" : 
                     order.isOrderingClosed ? "Closed" : 
                     !cartSummary || cartSummary.totalItems === 0 ? "Add items to cart first" :
                     `Join Order (₹${cartSummary.totalAmount})`}
                  </button>
                  <button
                    onClick={() => setSelectedOrderId(order._id)}
                    className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
