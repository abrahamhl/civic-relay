import React, { useState, useEffect } from 'react';
import { api, subscribeRealtime } from './api/client';
import { Navigation, NavTab } from './components/Navigation';
import { RightSidebar } from './components/RightSidebar';
import { FeedView } from './components/FeedView';
import { MapView } from './components/MapView';
import { MessagesView } from './components/MessagesView';
import { AlertsView } from './components/AlertsView';
import { AdminPanel } from './components/AdminPanel';
import { CommandView } from './components/CommandView';
import { LabView } from './components/LabView';
import { PublishModal } from './components/PublishModal';
import { AuthModal } from './components/AuthModal';
import { ReportModal } from './components/ReportModal';
import { EventHubModal } from './components/EventHubModal';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('feed');
  const [feedTab, setFeedTab] = useState<string>('for_you');
  const [user, setUser] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [stories, setStories] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [dtnStats, setDtnStats] = useState<any>(null);
  const [online, setOnline] = useState<boolean>(navigator.onLine);

  // Modals state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<any>(null);

  useEffect(() => {
    // Monitor online/offline events
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial load
    initApp();

    // Check Web Share Target query params
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'share' || params.get('url')) {
      setShowPublishModal(true);
    }

    // Subscribe to SSE realtime events
    const unsubscribe = subscribeRealtime((event) => {
      if (event.type === 'POST_CREATED') {
        loadFeed(feedTab);
      } else if (event.type === 'ALERT_PUBLISHED' || event.type === 'ALERT_RETRACTED') {
        loadAlerts();
      } else if (event.type === 'EVENT_CREATED' || event.type === 'EVENT_CORROBORATED' || event.type === 'EVENT_RETRACTED') {
        loadEvents();
      }
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    loadFeed(feedTab);
  }, [feedTab]);

  const initApp = async () => {
    try {
      const meRes = await api.me();
      if (meRes.user) setUser(meRes.user);
    } catch {}

    loadFeed(feedTab);
    loadStories();
    loadEvents();
    loadAlerts();
    loadDtnStats();
  };

  const loadFeed = async (tab: string) => {
    try {
      const res = await api.getFeed({ tab });
      setPosts(res.items || []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadStories = async () => {
    try {
      const res = await api.getStories();
      setStories(res.stories || []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadEvents = async () => {
    try {
      const res = await api.getEvents();
      setEvents(res.events || []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadAlerts = async () => {
    try {
      const res = await api.getAlerts({ includeExpired: 'false' });
      setAlerts(res.alerts || []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadDtnStats = async () => {
    try {
      const stats = await api.getDtnStats();
      setDtnStats(stats);
    } catch {}
  };

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    loadFeed(feedTab);
  };

  const handlePostCreated = (post: any) => {
    setPosts((prev) => [post, ...prev]);
    loadEvents();
  };

  return (
    <div className="app-container">
      {/* Navigation (Sidebar Desktop + Bottom Bar Mobile) */}
      <Navigation
        activeTab={activeTab}
        onSelectTab={(t) => {
          if (t === 'publish') setShowPublishModal(true);
          else setActiveTab(t);
        }}
        unreadAlerts={alerts.filter((a) => a.status === 'ACTIVE').length}
        unreadMessages={0}
        user={user}
        onOpenAuth={() => setShowAuthModal(true)}
        onLogout={handleLogout}
      />

      {/* Main Content Pane */}
      <main className="main-content">
        {activeTab === 'feed' && (
          <FeedView
            posts={posts}
            stories={stories}
            activeTab={feedTab}
            onTabChange={setFeedTab}
            onSelectEvent={(id) => setSelectedEventId(id)}
            onOpenReport={(post) => setReportTarget(post)}
            user={user}
          />
        )}

        {activeTab === 'map' && (
          <MapView
            events={events}
            onSelectEvent={(id) => setSelectedEventId(id)}
          />
        )}

        {activeTab === 'messages' && (
          <MessagesView user={user} />
        )}

        {activeTab === 'alerts' && (
          <AlertsView
            user={user}
            onSelectEvent={(id) => setSelectedEventId(id)}
          />
        )}

        {activeTab === 'command' && (
          <CommandView
            user={user}
            events={events}
            onSelectEvent={(id) => setSelectedEventId(id)}
          />
        )}

        {activeTab === 'lab' && (
          <LabView user={user} />
        )}

        {activeTab === 'admin' && (
          <AdminPanel user={user} />
        )}
      </main>

      {/* Right Sidebar (Desktop) */}
      <RightSidebar
        events={events}
        onSelectEvent={(ev) => setSelectedEventId(ev.id)}
        online={online}
        dtnStats={dtnStats}
      />

      {/* Modals */}
      <PublishModal
        isOpen={showPublishModal}
        onClose={() => setShowPublishModal(false)}
        onPostCreated={handlePostCreated}
        events={events}
      />

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthSuccess={(u) => {
          setUser(u);
          loadFeed(feedTab);
        }}
      />

      <ReportModal
        target={reportTarget}
        isOpen={Boolean(reportTarget)}
        onClose={() => setReportTarget(null)}
      />

      <EventHubModal
        eventId={selectedEventId}
        isOpen={Boolean(selectedEventId)}
        onClose={() => setSelectedEventId(null)}
        user={user}
      />
    </div>
  );
};
