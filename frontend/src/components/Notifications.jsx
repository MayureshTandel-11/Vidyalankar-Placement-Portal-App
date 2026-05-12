import { useState, useEffect } from "react";
import api from "../api";
import { Bell, CheckCircle, AlertCircle, Trash2, Mail } from "lucide-react";
import { Spinner } from "./ui";

/**
 * Notifications Component
 * Displays student notifications for next round selections
 */
const Notifications = ({ onUnreadCountChange }) => {
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all"); // all, unread, read
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [unreadCount, setUnreadCount] = useState(0);

  const ITEMS_PER_PAGE = 10;

  // Fetch notifications
  useEffect(() => {
    fetchNotifications();
  }, [page, filter]);

  const fetchNotifications = async () => {
    setIsLoading(true);
    setError("");

    try {
      const params = {
        page,
        limit: ITEMS_PER_PAGE,
      };

      if (filter === "unread") {
        params.isRead = false;
      } else if (filter === "read") {
        params.isRead = true;
      }

      const response = await api.get("/notifications", { params });
      setNotifications(response.data?.data || []);
      setTotalPages(response.data?.pagination?.totalPages || 1);
      const newUnreadCount = response.data?.unreadCount || 0;
      setUnreadCount(newUnreadCount);
      if (onUnreadCountChange) {
        onUnreadCountChange(newUnreadCount);
      }
    } catch (err) {
      const message = err.response?.data?.message || "Failed to fetch notifications";
      setError(message);
      console.error("[FETCH NOTIFICATIONS ERROR]", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Mark as read
  const handleMarkAsRead = async (notificationId) => {
    try {
      await api.patch(`/notifications/${notificationId}/read`);
      fetchNotifications();
    } catch (err) {
      setError("Failed to mark notification as read");
    }
  };

  // Mark all as read
  const handleMarkAllAsRead = async () => {
    try {
      await api.patch("/notifications/read-all");
      fetchNotifications();
    } catch (err) {
      setError("Failed to mark all notifications as read");
    }
  };

  // Delete notification
  const handleDeleteNotification = async (notificationId) => {
    try {
      await api.delete(`/notifications/${notificationId}`);
      fetchNotifications();
    } catch (err) {
      setError("Failed to delete notification");
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case "selection":
        return <CheckCircle size={18} className="text-green-600" />;
      case "rejection":
        return <AlertCircle size={18} className="text-red-600" />;
      default:
        return <Mail size={18} className="text-blue-600" />;
    }
  };

  const getNotificationColor = (type, isRead) => {
    if (isRead) {
      return "bg-slate-50 border-slate-200";
    }
    switch (type) {
      case "selection":
        return "bg-green-50 border-green-200";
      case "rejection":
        return "bg-red-50 border-red-200";
      default:
        return "bg-blue-50 border-blue-200";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
            <Bell size={32} />
            Notifications
          </h1>
          {unreadCount > 0 && (
            <p className="text-sm text-red-600 mt-1">
              You have <strong>{unreadCount}</strong> unread notification{unreadCount !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition"
          >
            Mark All as Read
          </button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => {
            setFilter("all");
            setPage(1);
          }}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
            filter === "all"
              ? "bg-red-600 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          All
        </button>
        <button
          onClick={() => {
            setFilter("unread");
            setPage(1);
          }}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition relative ${
            filter === "unread"
              ? "bg-red-600 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          Unread
          {unreadCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </button>
        <button
          onClick={() => {
            setFilter("read");
            setPage(1);
          }}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
            filter === "read"
              ? "bg-red-600 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          Read
        </button>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner /> <span className="ml-2 text-slate-600">Loading notifications...</span>
          </div>
        ) : notifications.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
            <Bell size={32} className="mx-auto text-slate-400 mb-2" />
            <p className="text-slate-600">
              {filter === "unread" ? "No unread notifications" : "No notifications yet"}
            </p>
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification._id}
              className={`rounded-lg border p-4 transition ${getNotificationColor(
                notification.notificationType,
                notification.isRead
              )}`}
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-0.5">
                  {getNotificationIcon(notification.notificationType)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-medium text-slate-900 flex-1">
                      {notification.opportunityId?.announcementHeading || "Opportunity Update"}
                    </h3>
                    {!notification.isRead && (
                      <span className="inline-block w-2 h-2 bg-red-600 rounded-full flex-shrink-0 mt-1.5" />
                    )}
                  </div>

                  <p className="text-sm text-slate-700 mb-2">{notification.message}</p>

                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>
                      <strong>Stage:</strong> {notification.stage}
                    </span>
                    <span>
                      {new Date(notification.createdAt).toLocaleDateString("en-IN", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 flex-shrink-0">
                  {!notification.isRead && (
                    <button
                      onClick={() => handleMarkAsRead(notification._id)}
                      className="p-1.5 hover:bg-white hover:bg-opacity-50 rounded transition text-slate-600"
                      title="Mark as read"
                    >
                      <CheckCircle size={16} />
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteNotification(notification._id)}
                    className="p-1.5 hover:bg-white hover:bg-opacity-50 rounded transition text-red-600"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm text-slate-600">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-sm border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default Notifications;
