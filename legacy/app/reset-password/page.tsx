import ResetPasswordView from "@/components/auth/reset-password-view";

// Rendered on demand so the branded theme injected by the root layout reflects
// runtime BRAND_* overrides, like every other user-facing page. Route segment
// config is ignored inside "use client" files, hence the server wrapper.
export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  return <ResetPasswordView />;
}
