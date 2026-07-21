import { AuthGuard } from "@/features/auth/components/AuthGuard";
import { ChangePasswordView } from "@/features/auth/components/ChangePasswordView";

export default function ChangePasswordPage() {
  return (
    <AuthGuard>
      <ChangePasswordView />
    </AuthGuard>
  );
}
