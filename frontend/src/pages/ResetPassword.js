import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, CheckCircle } from 'lucide-react';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const { resetPassword } = useAuth();
  const navigate = useNavigate();

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
      await resetPassword(token, password);
      setIsSuccess(true);
      setMessage('Password updated successfully!');
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.message);
    }

    setLoading(false);
  }

  if (!token) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-navy p-4">
              <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md text-center">
                  <h2 className="text-2xl font-bold text-red-600 mb-4">Invalid Link</h2>
                  <p className="text-navy/60 mb-6">This password reset link is invalid or has expired.</p>
                  <button onClick={() => navigate('/login')} className="btn-primary w-full py-3 rounded-lg font-bold">
                      Back to Login
                  </button>
              </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md border border-white/20">
        <h2 className="text-3xl font-bold mb-2 text-center text-navy font-display">
            New Password
        </h2>
        <p className="text-navy/60 text-center mb-8 text-sm">Please enter your new password below.</p>
        
        {error && <div className="bg-red-50 text-red-600 border border-red-100 p-3 rounded-lg mb-4 text-sm">{error}</div>}
        
        {isSuccess ? (
            <div className="text-center py-8">
                <div className="flex justify-center mb-4">
                    <CheckCircle size={64} className="text-green-500" />
                </div>
                <h3 className="text-xl font-bold text-navy mb-2">Success!</h3>
                <p className="text-navy/60 mb-6">{message}</p>
                <p className="text-xs text-navy/40 italic">Redirecting to login...</p>
            </div>
        ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1 relative">
                    <label className="text-xs font-semibold text-navy/60 uppercase ml-1">New Password</label>
                    <div className="relative">
                        <input
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            className="p-3 border rounded-lg border-grey-medium w-full focus:ring-2 focus:ring-navy/10 focus:border-navy outline-none transition-all pr-12"
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
                    <label className="text-xs font-semibold text-navy/60 uppercase ml-1">Confirm New Password</label>
                    <input
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        className="p-3 border rounded-lg border-grey-medium focus:ring-2 focus:ring-navy/10 focus:border-navy outline-none transition-all"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                    />
                </div>

                <button disabled={loading} className="btn-primary w-full py-3 mt-4 rounded-lg font-bold shadow-lg shadow-navy/20 hover:scale-[1.01] active:scale-[0.99] transition-all" type="submit">
                    {loading ? 'Updating...' : 'Reset Password'}
                </button>
            </form>
        )}
      </div>
    </div>
  );
}
