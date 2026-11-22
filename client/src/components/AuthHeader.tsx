import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { APP_TITLE } from "@/const";

export function AuthHeader() {
  const { isAuthenticated, loading, logout } = useAuth();

  if (!isAuthenticated) return null;

  return (
    <header className="border-b border-border bg-card px-4 py-2">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
        <a href="/" className="font-semibold text-primary">{APP_TITLE}</a>
        <Button
          variant="ghost"
          size="sm"
          disabled={loading}
          onClick={async () => {
            try {
              await logout();
            } catch {
              toast.error("登出失敗，請稍後再試。");
            }
          }}
        >
          <LogOut className="h-4 w-4" />
          登出
        </Button>
      </div>
    </header>
  );
}
