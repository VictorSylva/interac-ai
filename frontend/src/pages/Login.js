import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isColdStart, setIsColdStart] = useState(false);

  const { login, signup, forgotPassword, logout } = useAuth();
  const navigate = useNavigate();

  // Clear any stale session once when landing on the login/signup page
  useEffect(() => {
    logout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle Render cold starts by showing a warning if request takes >5s
  useEffect(() => {
    let timeoutId;
    if (loading) {
      timeoutId = setTimeout(() => {
        setIsColdStart(true);
      }, 5000);
    } else {
      setIsColdStart(false);
    }
    return () => clearTimeout(timeoutId);
  }, [loading]);

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      setError("");
      setMessage("");
      setLoading(true);

      if (isForgotPassword) {
        await forgotPassword(email);
        setMessage("Check your email (or console) for the reset link!");
      } else if (isLogin) {
        const user = await login(email, password);
        if (user.role === 'super_admin' || user.email === 'mbasitisylva@gmail.com') {
          navigate("/super-admin");
        } else {
          navigate("/dashboard");
        }
      } else {
        await signup(email, password, businessName);
        navigate("/dashboard");
      }
    } catch (err) {
      setError(err.message);
    }

    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md border border-white/20">
        <div className="flex justify-center mb-6">
          <img src="/interacAi-logo.png" alt="InteracAI Logo" className="h-20 w-auto" />
        </div>
        <h2 className="text-3xl font-bold mb-6 text-center text-navy">
          {isForgotPassword ? "Reset Password" : isLogin ? "Login" : "Sign Up"}
        </h2>

        {error && (
          <div className="bg-red-50 text-red-600 border border-red-100 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}
        {message && (
          <div className="bg-green-50 text-green-600 border border-green-100 p-3 rounded-lg mb-4 text-sm">
            {message}
          </div>
        )}
        {isColdStart && loading && (
          <div className="bg-amber-50 text-amber-700 border border-amber-200 p-3 rounded-lg mb-4 text-sm animate-pulse">
            Waking up server... This might take up to 60 seconds. Please wait.
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {!isLogin && !isForgotPassword && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-navy/60 uppercase ml-1">
                Business Name
              </label>
              <input
                type="text"
                placeholder="Acme Corp"
                className="p-3 border rounded-lg border-grey-medium focus:ring-2 focus:ring-navy/10 focus:border-navy outline-none transition-all"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                required
              />
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-navy/60 uppercase ml-1">
              Email Address
            </label>
            <input
              type="email"
              placeholder="name@example.com"
              className="p-3 border rounded-lg border-grey-medium focus:ring-2 focus:ring-navy/10 focus:border-navy outline-none transition-all"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {!isForgotPassword && (
            <div className="flex flex-col gap-1 relative">
              <label className="text-xs font-semibold text-navy/60 uppercase ml-1">
                Password
              </label>
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-navy/50 hover:text-navy transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {isLogin && (
                <button
                  type="button"
                  onClick={() => setIsForgotPassword(true)}
                  className="text-right text-xs text-navy/70 hover:text-navy mt-1 transition-colors font-medium"
                >
                  Forgot password?
                </button>
              )}
            </div>
          )}

          <button
            disabled={loading}
            className="btn-primary w-full py-3 mt-2 rounded-lg font-bold shadow-lg shadow-navy/20 hover:scale-[1.01] active:scale-[0.99] transition-all"
            type="submit"
          >
            {loading
              ? "Processing..."
              : isForgotPassword
              ? "Send Reset Link"
              : isLogin
              ? "Log In"
              : "Sign Up"}
          </button>
        </form>

        <div className="mt-8 text-center pt-6 border-t border-grey-light">
          {isForgotPassword ? (
            <button
              onClick={() => setIsForgotPassword(false)}
              className="text-navy font-bold text-sm hover:underline"
            >
              Back to Login
            </button>
          ) : (
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-navy font-bold text-sm"
            >
              {isLogin ? (
                <span className="text-navy/60 font-normal">
                  Need an account?{" "}
                  <span className="text-navy font-bold hover:underline">
                    Sign Up
                  </span>
                </span>
              ) : (
                <span className="text-navy/60 font-normal">
                  Already have an account?{" "}
                  <span className="text-navy font-bold hover:underline">
                    Log In
                  </span>
                </span>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
