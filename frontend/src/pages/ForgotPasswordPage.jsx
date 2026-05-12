import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { extractApiError } from "../api";
import { PrimaryButton, StatusMessage } from "../components/ui";
import PasswordInput from "../components/PasswordInput";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

const ForgotPasswordPage = () => {
  const [form, setForm] = useState({
    role: "student",
    email: "",
    otp: "",
    newPassword: "",
    confirmNewPassword: "",
  });
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const instituteEmailRegex = /^[a-z]+(?:\.[a-z]+)+@vsit\.edu\.in$/i;

  const requestOtp = async () => {
    if (!instituteEmailRegex.test(form.email.trim())) {
      setError("Email must follow name.surname@vsit.edu.in format.");
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");
    try {
      await api.post("/auth/forgot-password/request-otp", {
        role: form.role,
        email: form.email.trim(),
      });
      setMessage("OTP sent to email.");
      setStep(2);
    } catch (err) {
      setError(extractApiError(err, "Failed to send OTP."));
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    if (form.newPassword !== form.confirmNewPassword) {
      setError("New password and confirm password do not match.");
      return;
    }
    if (!/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(form.newPassword)) {
      setError("Password must be 8+ chars with uppercase, number and special character.");
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");
    try {
      await api.post("/auth/forgot-password/reset", {
        role: form.role,
        email: form.email.trim(),
        otp: form.otp.trim(),
        newPassword: form.newPassword,
        confirmNewPassword: form.confirmNewPassword,
      });
      setMessage("Password reset successful. Redirecting to login...");
      setTimeout(() => navigate("/login"), 1200);
    } catch (err) {
      setError(extractApiError(err, "Failed to reset password."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="flex min-h-screen items-center justify-center px-3 xs:px-4 py-8 xs:py-10">
        <div className="glass-panel w-full max-w-md space-y-3 xs:space-y-4 p-4 xs:p-6">
          <h1 className="text-xl xs:text-2xl font-semibold text-slate-800">Forgot Password</h1>
          <select className="input-modern text-xs xs:text-base" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="student">Student</option>
            <option value="faculty">Faculty</option>
            <option value="admin">Admin</option>
          </select>
          <input
            className="input-modern text-xs xs:text-base"
            placeholder="Registered Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          {step === 2 && (
            <>
              <input className="input-modern text-xs xs:text-base" placeholder="OTP" value={form.otp} onChange={(e) => setForm({ ...form, otp: e.target.value })} />
              <PasswordInput
                placeholder="New Password"
                value={form.newPassword}
                onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
              />
              <PasswordInput
                placeholder="Confirm New Password"
                value={form.confirmNewPassword}
                onChange={(e) => setForm({ ...form, confirmNewPassword: e.target.value })}
            />
          </>
        )}
        <StatusMessage message={message} />
        <StatusMessage type="error" message={error} />
        {step === 1 ? (
          <PrimaryButton onClick={requestOtp} loading={loading} disabled={loading} className="w-full">
            Send OTP
          </PrimaryButton>
        ) : (
          <PrimaryButton onClick={resetPassword} loading={loading} disabled={loading} className="w-full">
            Reset Password
          </PrimaryButton>
        )}
        <Link to="/login" className="text-xs xs:text-sm text-red-600 transition-colors duration-200 ease-in-out hover:text-red-500">
          Back to login
        </Link>
      </div>
      </div>
      <Footer />
    </>
  );
};

export default ForgotPasswordPage;
