import React, { useState, useEffect } from 'react';
import { 
  Building, 
  Users, 
  MessageSquare, 
  DollarSign, 
  TrendingUp, 
  Activity,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { API_BASE_URL } from '../../../config';

export default function DashboardModule() {
  const { currentUser } = useAuth();
  const [stats, setStats] = useState({
    total_businesses: 0,
    total_users: 0,
    total_messages_processed: 0,
    total_revenue: 0,
    active_subscriptions: 0
  });
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const uid = currentUser?.id || currentUser?.uid || '';
      const [statsRes, logsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/super-admin/stats?user_id=${uid}`),
        fetch(`${API_BASE_URL}/api/super-admin/logs/system?limit=4&user_id=${uid}`)
      ]);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData || {});
      }
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setActivities(Array.isArray(logsData) ? logsData : []);
      }
    } catch (err) {
      console.error("Failed to fetch dashboard data", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-navy">Platform Overview</h2>
        <p className="text-grey-600 text-sm">Key performance indicators and system growth metrics.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <StatCard 
          icon={<Building size={20} />} 
          color="bg-blue-600"
          title="Total Businesses" 
          value={stats.total_businesses} 
          trend="+12%" 
          trendUp={true}
        />
        <StatCard 
          icon={<DollarSign size={20} />} 
          color="bg-green-600"
          title="Total Revenue" 
          value={`₦${(stats.total_revenue || 0).toLocaleString()}`} 
          trend="+5%" 
          trendUp={true}
        />
        <StatCard 
          icon={<MessageSquare size={20} />} 
          color="bg-purple-600"
          title="Messages" 
          value={(stats.total_messages_processed || 0).toLocaleString()} 
          trend="+28%" 
          trendUp={true}
        />
        <StatCard 
          icon={<Activity size={20} />} 
          color="bg-orange-600"
          title="Avg. Health" 
          value="99.8%" 
          trend="-0.2%" 
          trendUp={false}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart Placeholder */}
        <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-grey-medium p-8">
            <div className="flex items-center justify-between mb-8">
                <h3 className="font-bold text-navy text-lg">Business Growth</h3>
                <div className="flex bg-grey-100 p-1 rounded-lg">
                    <button className="px-3 py-1 text-[10px] font-bold text-navy bg-white rounded-md shadow-sm">30 Days</button>
                    <button className="px-3 py-1 text-[10px] font-bold text-grey-500 hover:text-navy transition-colors">90 Days</button>
                </div>
            </div>
            <div className="h-64 bg-grey-50 rounded-2xl border border-dashed border-grey-300 flex items-center justify-center text-grey-400 font-medium">
               Chart showing business registration & activity timeline
            </div>
        </div>

        {/* Recent Activity Mini-Feed */}
        <div className="bg-white rounded-3xl shadow-sm border border-grey-medium p-8">
            <h3 className="font-bold text-navy text-lg mb-6">Recent Activity</h3>
            <div className="space-y-6">
                {activities.length === 0 ? (
                    <div className="py-12 text-center text-grey-400 text-xs italic">No recent activity recorded.</div>
                ) : (
                    activities.map((act) => (
                        <ActivityItem 
                            key={act.id}
                            icon={<ShieldCheck size={14} className="text-blue-600" />}
                            text={`${act.action.replace(/_/g, ' ')} by ${act.admin_email.split('@')[0]}`}
                            time={new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        />
                    ))
                )}
            </div>
            <button className="w-full mt-8 py-3 text-blue-600 font-bold text-xs hover:bg-blue-50 rounded-xl transition-all border border-transparent hover:border-blue-100">
                View Full System Audit
            </button>
        </div>
      </div>
    </div>
  );
}

function ShieldCheck({ size, className }) {
    return (
        <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width={size} 
            height={size} 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className={className}
        >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            <path d="m9 12 2 2 4-4"/>
        </svg>
    );
}

function StatCard({ icon, title, value, trend, trendUp, color }) {
  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-grey-medium transform hover:scale-[1.02] transition-all duration-300">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 ${color} text-white rounded-2xl shadow-lg`}>
          {icon}
        </div>
        <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold ${trendUp ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {trendUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {trend}
        </div>
      </div>
      <h3 className="text-grey-500 text-xs font-bold uppercase tracking-wider mb-1">{title}</h3>
      <div className="text-2xl font-black text-navy">{value}</div>
    </div>
  );
}

function ActivityItem({ icon, text, time }) {
    return (
        <div className="flex gap-4">
            <div className="shrink-0 mt-0.5">{icon}</div>
            <div>
                <p className="text-xs font-bold text-navy leading-tight mb-1">{text}</p>
                <span className="text-[10px] text-grey-400 font-medium uppercase tracking-wider">{time}</span>
            </div>
        </div>
    );
}

function CheckCircle2({ size, className }) {
    return (
        <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width={size} 
            height={size} 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className={className}
        >
            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
            <path d="m9 12 2 2 4-4"/>
        </svg>
    );
}

function AlertTriangle({ size, className }) {
    return (
        <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width={size} 
            height={size} 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className={className}
        >
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
            <path d="M12 9v4"/>
            <path d="M12 17h.01"/>
        </svg>
    );
}
