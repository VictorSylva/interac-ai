import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, CheckCircle, Shield } from 'lucide-react';
import { API_BASE_URL } from '../config';

export default function AcceptInvitation() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [invitationDetails, setInvitationDetails] = useState(null);
  
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const { acceptInvitation } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      setFetching(false);
      return;
    }
    fetch(`${API_BASE_URL}/api/auth/invitation-details?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || "Invalid invitation token");
        }
        return res.json();
      })
      .then((data) => {
        setInvitationDetails(data);
        setFetching(false);
      })
      .catch((err) => {
        setError(err.message);
        setFetching(false);
      });
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();

    if (password !== confirmPassword) {
      return setError('Passwords do not match');
    }

    if (password.length < 6) {
        return setError('Password must be at least 6 characters');
    }

    try {
      setError('');
      setLoading(true);
      await acceptInvitation(token, password);
      setIsSuccess(true);
      setMessage('Your account has been set up successfully!');
      setTimeout(() => navigate('/dashboard'), 2500);
    } catch (err) {
      setError(err.message);
    }

    setLoading(false);
  }

  if (fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy p-4">
        <div className="text-white text-lg font-bold">Verifying Invitation...</div>
      </div>
    );
  }

  if (!token || error) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-navy p-4">
              <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md text-center">
                  <h2 className="text-2xl font-bold text-red-600 mb-4">Invalid Link</h2>
                  <p className="text-navy/60 mb-6">{error || "This invitation link is invalid or has expired."}</p>
                  <button onClick={() => navigate('/login')} className="bg-navy hover:bg-navy-light text-white w-full py-3 rounded-lg font-bold transition-colors">
                      Back to Login
                  </button>
              </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md border border-white/20">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-blue-50 rounded-full text-indigo-600">
            <Shield size={32} />
          </div>
        </div>
        <h2 className="text-3xl font-bold mb-2 text-center text-navy font-display">
            Join {invitationDetails?.business_name || 'Business'}
        </h2>
        <p className="text-navy/60 text-center mb-6 text-sm">
          You've been invited as a <span className="font-bold text-navy capitalize">{invitationDetails?.role}</span> in the <span className="font-bold text-navy capitalize">{invitationDetails?.department}</span> department.
        </p>
        
        {error && <div className="bg-red-50 text-red-600 border border-red-100 p-3 rounded-lg mb-4 text-sm">{error}</div>}
        
        {isSuccess ? (
            <div className="text-center py-6">
                <div className="flex justify-center mb-4">
                    <CheckCircle size={64} className="text-green-500" />
                </div>
                <h3 className="text-xl font-bold text-navy mb-2">Welcome Aboard!</h3>
                <p className="text-navy/60 mb-4">{message}</p>
                <p className="text-xs text-navy/40 italic">Redirecting to workspace dashboard...</p>
            </div>
        ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-navy/60 uppercase ml-1">Email Address</label>
                    <input
                        type="text"
                        disabled
                        className="p-3 border rounded-lg border-grey-medium w-full bg-grey-50 text-grey-600 font-medium"
                        value={invitationDetails?.email}
                    />
                </div>

                <div className="flex flex-col gap-1 relative">
                    <label className="text-xs font-semibold text-navy/60 uppercase ml-1">Set Password</label>
                    <div className="relative">
                        <input
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            className="p-3 border rounded-lg border-grey-medium w-full focus:ring-2 focus:ring-navy/10 focus:border-navy outline-none transition-all pr-12 text-navy"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                        <button 
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-grey-medium hover:text-navy transition-colors"
                        >
                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                    </div>
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-navy/60 uppercase ml-1">Confirm Password</label>
                    <input
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        className="p-3 border rounded-lg border-grey-medium focus:ring-2 focus:ring-navy/10 focus:border-navy outline-none transition-all text-navy"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                    />
                </div>

                <button disabled={loading} className="bg-navy hover:bg-navy-light text-white w-full py-3 mt-4 rounded-lg font-bold shadow-lg shadow-navy/20 hover:scale-[1.01] active:scale-[0.99] transition-all" type="submit">
                    {loading ? 'Creating Account...' : 'Accept Invitation & Login'}
                </button>
            </form>
        )}
      </div>
    </div>
  );
}
