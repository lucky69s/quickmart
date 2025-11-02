import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function MyOrders() {
  const mySharedOrders = useQuery(api.sharedOrders.getMySharedOrders);

  if (!mySharedOrders) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (mySharedOrders.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📦</div>
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">No orders yet</h2>
        <p className="text-gray-600">Join a group order or create your own to get started!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-gray-800">My Orders</h2>
      
      <div className="space-y-4">
        {mySharedOrders.map((order) => (
          <div key={order._id} className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">{order.sharedOrder?.title}</h3>
                <p className="text-sm text-gray-600">Created by {order.creator}</p>
                <p className="text-sm text-gray-500">
                  Joined on {new Date(order.joinedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="text-right">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  order.sharedOrder?.status === "open" 
                    ? "bg-green-100 text-green-800"
                    : order.sharedOrder?.status === "delivered"
                    ? "bg-blue-100 text-blue-800"
                    : "bg-gray-100 text-gray-800"
                }`}>
                  {order.sharedOrder?.status}
                </span>
                <div className="mt-2">
                  <span className="text-lg font-bold text-green-600">₹{order.totalAmount}</span>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">📍 Delivery Address:</span>
                <p className="text-gray-600">{order.sharedOrder?.deliveryAddress}</p>
              </div>
              <div>
                <span className="font-medium text-gray-700">⏰ Delivery Time:</span>
                <p className="text-gray-600">{order.sharedOrder?.deliveryTime}</p>
              </div>
              <div>
                <span className="font-medium text-gray-700">👥 Total Participants:</span>
                <p className="text-gray-600">{order.sharedOrder?.currentParticipants}/{order.sharedOrder?.maxParticipants}</p>
              </div>
            </div>

            {order.sharedOrder?.status === "open" && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  💡 This order is still open for more participants. 
                  Current total: ₹{order.sharedOrder.currentAmount} 
                  (Minimum: ₹{order.sharedOrder.minOrderAmount})
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
