import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { signInWithPassword, signUpWithPassword, useAuth } from "@/lib/salesup/auth";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "登录 · Sales Up" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/" });
  }, [loading, session, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const fn = mode === "signin" ? signInWithPassword : signUpWithPassword;
      const { error } = await fn(email.trim(), pwd);
      if (error) {
        setMsg({ type: "err", text: error.message });
      } else if (mode === "signup") {
        setMsg({ type: "ok", text: "已发送验证邮件，请查收后登录（或在 Supabase 控制台关闭邮箱验证）。" });
      } else {
        navigate({ to: "/" });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground grid place-items-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-sm p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground grid place-items-center font-bold">S</div>
          <div>
            <div className="text-base font-semibold">Sales Up</div>
            <div className="text-xs text-muted-foreground">销售个人工作台</div>
          </div>
        </div>

        <div className="inline-flex rounded-lg border border-border overflow-hidden mb-4 text-xs">
          <button
            type="button"
            onClick={() => setMode("signin")}
            className={`px-3 py-1.5 ${mode === "signin" ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
          >
            登录
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`px-3 py-1.5 border-l border-border ${mode === "signup" ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
          >
            注册
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-foreground/80 mb-1 block">邮箱</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:border-ring"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground/80 mb-1 block">密码</label>
            <input
              type="password"
              required
              minLength={6}
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:border-ring"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
          </div>

          {msg && (
            <div
              className={`text-xs px-3 py-2 rounded-md ${
                msg.type === "ok"
                  ? "bg-primary/10 text-primary"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {msg.text}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "请稍候…" : mode === "signin" ? "登录" : "注册"}
          </button>
        </form>

        <p className="text-[11px] text-muted-foreground mt-4 leading-relaxed">
          首次登录后可在右下角「导入本地数据」一键迁移本机已有时间块和提醒。
        </p>
      </div>
    </div>
  );
}
