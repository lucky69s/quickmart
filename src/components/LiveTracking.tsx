import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useState, useEffect } from "react";
import { toast } from "sonner";

interface LiveTrackingProps {
  sharedOrderId: Id<"sharedOrders">;
  onBack: () => void;
}

export function LiveTracking({ sharedOrderId, onBack }: LiveTrackingProps) {
  const tracking = useQuery(api.tracking.getDeliveryTracking, { 
    sharedOrderId: sharedOrderId 
  });
  const notifications = useQuery(api.tracking.getUserNotifications);
  const markAsRead = useMutation(api.tracking.markNotificationRead);

  const [lastNotificationCount, setLastNotificationCount] = useState(0);

  // Show toast for new notifications
  useEffect(() => {
    if (notifications && notifications.length > lastNotificationCount) {
      const newNotifications = notifications.slice(0, notifications.length - lastNotificationCount);
      newNotifications.forEach(notification => {
        if (!notification.isRead) {
          toast.info(notification.title, {
            description: notification.message,
            duration: 5000,
          });
        }
      });
      setLastNotificationCount(notifications.length);
    }
  }, [notifications, lastNotificationCount]);

  const handleMarkAsRead = async (notificationId: Id<"notifications">) => {
    try {
      await markAsRead({ notificationId: notificationId });
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  if (!tracking) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            ← Back
          </button>
          <h2 className="text-2xl font-semibold text-gray-800">Live Tracking</h2>
        </div>
        
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <div className="text-4xl mb-4">📦</div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Tracking Not Available</h3>
          <p className="text-gray-600">Live tracking will be available once your order is out for delivery.</p>
        </div>
      </div>
    );
  }

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "out_for_delivery": return "bg-blue-100 text-blue-800";
      case "delivered": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const userStop = tracking.route.find((stop, index) => 
    index + 1 === tracking.userDeliveryOrder
  );

  const currentStopIndex = tracking.route.findIndex(stop => !stop.isCompleted);
  const currentStop = tracking.route[currentStopIndex];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          ← Back
        </button>
        <h2 className="text-2xl font-semibold text-gray-800">Live Tracking</h2>
      </div>

      {/* Order Status */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-800">{tracking.sharedOrder?.title}</h3>
            <p className="text-gray-600">Rider: {tracking.sharedOrder?.riderName}</p>
            <p className="text-sm text-gray-500">📞 {tracking.sharedOrder?.riderPhone}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(tracking.sharedOrder?.status || '')}`}>
            {tracking.sharedOrder?.status?.replace('_', ' ').toUpperCase()}
          </span>
        </div>

        {/* Mock Map */}
        <div className="bg-gray-100 rounded-lg h-64 mb-4 relative overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-2">🗺️</div>
              <p className="text-gray-600 font-medium">Live Map View</p>
              <p className="text-sm text-gray-500">Rider Location Updated: {formatTime(tracking.currentLocation.timestamp)}</p>
            </div>
          </div>
          
          {/* Mock rider location indicator */}
          <div className="absolute top-4 left-4 bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium">
            🚚 Rider Location
          </div>
          
          {/* Mock route indicators */}
          <div className="absolute bottom-4 right-4 space-y-1">
            {tracking.route.slice(0, 3).map((stop, index) => (
              <div 
                key={index}
                className={`px-2 py-1 rounded text-xs font-medium ${
                  stop.isCompleted 
                    ? 'bg-green-500 text-white' 
                    : index === currentStopIndex
                    ? 'bg-yellow-500 text-white'
                    : 'bg-gray-300 text-gray-700'
                }`}
              >
                Stop {index + 1} {stop.isCompleted ? '✓' : index === currentStopIndex ? '🚚' : '⏳'}
              </div>
            ))}
          </div>
        </div>

        {/* Your Delivery Info */}
        {tracking.userDeliveryOrder && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <h4 className="font-semibold text-blue-800 mb-2">📍 Your Delivery</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-medium text-blue-700">Delivery Order:</span>
                <p className="text-blue-600">#{tracking.userDeliveryOrder} of {tracking.route.length}</p>
              </div>
              <div>
                <span className="font-medium text-blue-700">Estimated Arrival:</span>
                <p className="text-blue-600">
                  {tracking.userEstimatedArrival ? formatTime(tracking.userEstimatedArrival) : 'Calculating...'}
                </p>
              </div>
              <div>
                <span className="font-medium text-blue-700">Status:</span>
                <p className="text-blue-600">
                  {tracking.isUserDelivered ? '✅ Delivered' : 
                   tracking.userDeliveryOrder === currentStopIndex + 1 ? '🚚 Next Stop' : '⏳ In Queue'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delivery Route */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h4 className="font-semibold text-gray-800 mb-4">🛣️ Delivery Route</h4>
        <div className="space-y-3">
          {tracking.route.map((stop, index) => (
            <div 
              key={stop.participantId}
              className={`flex items-center gap-4 p-3 rounded-lg border ${
                stop.isCompleted 
                  ? 'bg-green-50 border-green-200' 
                  : index === currentStopIndex
                  ? 'bg-yellow-50 border-yellow-200'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                stop.isCompleted 
                  ? 'bg-green-500 text-white' 
                  : index === currentStopIndex
                  ? 'bg-yellow-500 text-white'
                  : 'bg-gray-300 text-gray-700'
              }`}>
                {index + 1}
              </div>
              
              <div className="flex-1">
                <p className="font-medium text-gray-800">{stop.address}</p>
                <p className="text-sm text-gray-600">
                  ETA: {formatTime(stop.estimatedArrival)}
                  {stop.isCompleted && stop.completedAt && (
                    <span className="ml-2 text-green-600">
                      ✓ Delivered at {formatTime(stop.completedAt)}
                    </span>
                  )}
                </p>
              </div>
              
              <div className="text-right">
                {stop.isCompleted ? (
                  <span className="text-green-600 font-medium">✅ Complete</span>
                ) : index === currentStopIndex ? (
                  <span className="text-yellow-600 font-medium">🚚 Current</span>
                ) : (
                  <span className="text-gray-500">⏳ Pending</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Notifications */}
      {notifications && notifications.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="font-semibold text-gray-800 mb-4">🔔 Recent Updates</h4>
          <div className="space-y-3">
            {notifications.slice(0, 5).map((notification) => (
              <div 
                key={notification._id}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  notification.isRead 
                    ? 'bg-gray-50 border-gray-200' 
                    : 'bg-blue-50 border-blue-200'
                }`}
                onClick={() => handleMarkAsRead(notification._id)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h5 className="font-medium text-gray-800">{notification.title}</h5>
                    <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">
                      {formatTime(notification.createdAt)}
                    </p>
                    {!notification.isRead && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-1 ml-auto"></div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
