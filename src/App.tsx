import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Toaster } from "sonner";
import { useState, useEffect } from "react";
import { ProductCatalog } from "./components/ProductCatalog";
import { Cart } from "./components/Cart";
import { SharedOrders } from "./components/SharedOrders";
import { MyOrders } from "./components/MyOrders";
import { Profile } from "./components/Profile";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm h-16 flex justify-between items-center border-b shadow-sm px-4">
        <h2 className="text-xl font-semibold text-green-600">QuickMart</h2>
        <div className="flex items-center gap-4">
          <NotificationBell />
          <SignOutButton />
        </div>
      </header>
      <main className="flex-1">
        <Content />
      </main>
      <Toaster position="top-right" />
    </div>
  );
}

function NotificationBell() {
  const notifications = useQuery(api.tracking.getUserNotifications);
  const unreadCount = notifications?.filter(n => !n.isRead).length || 0;

  return (
    <Authenticated>
      <div className="relative">
        <div className="p-2 text-gray-600 hover:text-gray-800 cursor-pointer">
          🔔
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
      </div>
    </Authenticated>
  );
}

function Content() {
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const [activeTab, setActiveTab] = useState("products");

  if (loggedInUser === undefined) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <Unauthenticated>
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-green-600 mb-4">🛒 QuickMart</h1>
            <p className="text-xl text-gray-600 mb-2">Quick Grocery Delivery</p>
            <p className="text-lg text-gray-500">Join group orders and save on delivery!</p>
          </div>
          <SignInForm />
        </div>
      </Unauthenticated>

      <Authenticated>
        <div className="p-4">
          <div className="max-w-6xl mx-auto">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                Welcome back, {loggedInUser?.name || loggedInUser?.email?.split('@')[0]}! 🛒
              </h1>
              <p className="text-gray-600">Fresh groceries delivered in minutes with live tracking</p>
            </div>

            {/* Navigation Tabs */}
            <div className="flex space-x-1 mb-6 bg-gray-100 p-1 rounded-lg">
              {[
                { id: "products", label: "Products", icon: "🛍️" },
                { id: "shared", label: "Group Orders", icon: "👥" },
                { id: "cart", label: "Cart", icon: "🛒" },
                { id: "orders", label: "My Orders", icon: "📦" },
                { id: "profile", label: "Profile", icon: "👤" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md font-medium transition-colors ${
                    activeTab === tab.id
                      ? "bg-white text-green-600 shadow-sm"
                      : "text-gray-600 hover:text-gray-800"
                  }`}
                >
                  <span>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="min-h-[400px]">
              {activeTab === "products" && <ProductCatalog />}
              {activeTab === "shared" && <SharedOrders />}
              {activeTab === "cart" && <Cart />}
              {activeTab === "orders" && <MyOrders />}
              {activeTab === "profile" && <Profile />}
            </div>
          </div>
        </div>
      </Authenticated>
    </div>
  );
}
