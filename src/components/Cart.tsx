import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import { useState } from "react";

export function Cart() {
  const cart = useQuery(api.cart.getCart);
  const myOpenSharedOrders = useQuery(api.sharedOrders.getMyOpenSharedOrders);
  const updateQuantity = useMutation(api.cart.updateCartQuantity);
  const clearCart = useMutation(api.cart.clearCart);
  const addToSharedOrder = useMutation(api.sharedOrders.addItemToSharedOrder);
  
  const [selectedSharedOrder, setSelectedSharedOrder] = useState<Id<"sharedOrders"> | null>(null);

  const handleQuantityChange = async (cartId: string, newQuantity: number) => {
    try {
      await updateQuantity({ cartId: cartId as any, quantity: newQuantity });
      if (newQuantity === 0) {
        toast.success("Item removed from cart");
      }
    } catch (error) {
      toast.error("Failed to update quantity");
    }
  };

  const handleAddToSharedOrder = async () => {
    if (!selectedSharedOrder || !cart) return;
    
    try {
      for (const item of cart) {
        if (item.product) {
          await addToSharedOrder({
            sharedOrderId: selectedSharedOrder,
            productId: item.productId,
            quantity: item.quantity,
          });
        }
      }
      
      // Clear cart after adding to shared order
      await clearCart();
      toast.success("Items added to group order successfully!");
      setSelectedSharedOrder(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to add items to group order");
    }
  };

  const handleClearCart = async () => {
    try {
      await clearCart();
      toast.success("Cart cleared");
    } catch (error) {
      toast.error("Failed to clear cart");
    }
  };

  if (!cart || !myOpenSharedOrders) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  const totalAmount = cart.reduce((sum, item) => sum + (item.product?.price || 0) * item.quantity, 0);

  if (cart.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🛒</div>
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">Your cart is empty</h2>
        <p className="text-gray-600">Add some products to get started!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold text-gray-800">Shopping Cart</h2>
        <button
          onClick={handleClearCart}
          className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          Clear Cart
        </button>
      </div>

      <div className="space-y-4">
        {cart.map((item) => (
          <div key={item._id} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-4">
              <div className="text-3xl">{item.product?.image}</div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-800">{item.product?.name}</h3>
                <p className="text-sm text-gray-600">{item.product?.description}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-lg font-bold text-green-600">₹{item.product?.price}</span>
                  <span className="text-sm text-gray-500">/{item.product?.unit}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleQuantityChange(item._id, item.quantity - 1)}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-bold text-gray-600"
                >
                  -
                </button>
                <span className="w-8 text-center font-semibold">{item.quantity}</span>
                <button
                  onClick={() => handleQuantityChange(item._id, item.quantity + 1)}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-bold text-gray-600"
                >
                  +
                </button>
              </div>
              <div className="text-right">
                <div className="font-bold text-gray-800">
                  ₹{((item.product?.price || 0) * item.quantity).toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <span className="text-xl font-semibold text-gray-800">Total Amount:</span>
          <span className="text-2xl font-bold text-green-600">₹{totalAmount.toFixed(2)}</span>
        </div>
        
        {/* Shared Order Selection */}
        {myOpenSharedOrders.length > 0 && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-semibold text-blue-800 mb-2">👥 Add to Group Order</h4>
            <p className="text-sm text-blue-600 mb-3">
              You can add these items to one of your joined group orders:
            </p>
            <select
              value={selectedSharedOrder || ""}
              onChange={(e) => setSelectedSharedOrder(e.target.value as Id<"sharedOrders"> || null)}
              className="w-full p-2 border border-blue-300 rounded-lg mb-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select a group order...</option>
              {myOpenSharedOrders.map((order) => (
                <option key={order._id} value={order._id}>
                  {order.title} - Min: ₹{order.minOrderAmount}
                </option>
              ))}
            </select>
            {selectedSharedOrder && (
              <button
                onClick={handleAddToSharedOrder}
                className="w-full py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Add to Group Order
              </button>
            )}
          </div>
        )}
        <div className="space-y-3">
          <button className="w-full py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors">
            Proceed to Checkout
          </button>
          <p className="text-sm text-gray-500 text-center">
            💡 Tip: Join a group order to share delivery costs!
          </p>
        </div>
      </div>
    </div>
  );
}
