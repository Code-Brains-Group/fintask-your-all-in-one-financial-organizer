import { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { Wallet } from "lucide-react";

type Mode = "login" | "signup" | "forgot" | "verify" | "newpass";

export default function Auth() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>(
    (params.get("mode") as Mode) || "login"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data: signUpData, error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        // Auto-confirm is enabled — user is signed in immediately
        if (signUpData.session) {
          toast.success("Account created — welcome!");
          navigate("/");
        } else {
          // Either email already in use, or confirmation required
          if (signUpData.user && signUpData.user.identities?.length === 0) {
            throw new Error("An account with this email already exists. Please sign in instead.");
          }
          toast.success("Account created — you can sign in now");
          setMode("login");
        }
      } else if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/");
      } else if (mode === "forgot") {
        // Send a 6-digit OTP code (default email includes {{ .Token }})
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: false },
        });
        if (error) throw error;
        toast.success("We sent a 6-digit code to your email");
        setCode("");
        setMode("verify");
      } else if (mode === "verify") {
        if (code.length !== 6) throw new Error("Enter the 6-digit code");
        const { error } = await supabase.auth.verifyOtp({
          email,
          token: code,
          type: "email",
        });
        if (error) throw error;
        toast.success("Code verified — set your new password");
        setPassword("");
        setMode("newpass");
      } else if (mode === "newpass") {
        if (password.length < 6) throw new Error("Password must be at least 6 characters");
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        toast.success("Password updated");
        navigate("/");
      }
    } catch (e: any) {
      toast.error(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) toast.error("Google sign-in failed");
    else if (!r.redirected) navigate("/");
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-gradient-primary p-12 text-primary-foreground">
        <div className="flex items-center gap-2 text-xl font-semibold">
          <Wallet className="h-6 w-6" /> FinTask
        </div>
        <div>
          <h1 className="text-4xl font-bold leading-tight">Master your money. Conquer your day.</h1>
          <p className="mt-4 text-primary-foreground/80 max-w-md">
            Track every shilling, plan every task, and watch your savings grow — all in one beautifully simple workspace.
          </p>
        </div>
        <div className="text-sm text-primary-foreground/70">© FinTask</div>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6">
          <div className="lg:hidden flex items-center gap-2 text-xl font-semibold text-primary">
            <Wallet className="h-6 w-6" /> FinTask
          </div>
          <div>
            <h2 className="text-2xl font-semibold">
              {mode === "login" && "Welcome back"}
              {mode === "signup" && "Create your account"}
              {mode === "forgot" && "Reset your password"}
              {mode === "verify" && "Enter verification code"}
              {mode === "newpass" && "Set a new password"}
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              {mode === "login" && "Sign in to continue to FinTask"}
              {mode === "signup" && "Start tracking your finances in seconds"}
              {mode === "forgot" && "We'll email you a 6-digit code"}
              {mode === "verify" && `Enter the 6-digit code sent to ${email}`}
              {mode === "newpass" && "Choose a strong password you'll remember"}
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
              </div>
            )}
            {(mode === "login" || mode === "signup" || mode === "forgot") && (
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
            )}
            {(mode === "login" || mode === "signup") && (
              <div>
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            )}
            {mode === "verify" && (
              <div className="flex justify-center py-2">
                <InputOTP maxLength={6} value={code} onChange={setCode} inputMode="numeric" pattern="[0-9]*">
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
            )}
            {mode === "newpass" && (
              <div>
                <Label htmlFor="newpw">New password</Label>
                <Input id="newpw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Please wait…" :
                mode === "login" ? "Sign in" :
                mode === "signup" ? "Create account" :
                mode === "forgot" ? "Send code" :
                mode === "verify" ? "Verify code" :
                "Update password"}
            </Button>
          </form>

          {/* Google OAuth — temporarily disabled */}

          <div className="text-sm text-center text-muted-foreground space-y-1">
            {mode === "login" && (
              <>
                <p><button className="text-primary hover:underline" onClick={() => setMode("forgot")}>Forgot password?</button></p>
                <p>Don't have an account? <button className="text-primary hover:underline" onClick={() => setMode("signup")}>Sign up</button></p>
              </>
            )}
            {mode === "signup" && <p>Already have an account? <button className="text-primary hover:underline" onClick={() => setMode("login")}>Sign in</button></p>}
            {mode === "forgot" && <p><button className="text-primary hover:underline" onClick={() => setMode("login")}>Back to sign in</button></p>}
            {mode === "verify" && (
              <>
                <p><button className="text-primary hover:underline" onClick={() => setMode("forgot")}>Resend code</button></p>
                <p><button className="text-primary hover:underline" onClick={() => setMode("login")}>Back to sign in</button></p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
