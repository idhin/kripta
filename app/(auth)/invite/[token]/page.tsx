import { InviteAccept } from "@/components/auth/InviteAccept";

export const dynamic = "force-dynamic";

export default function InvitePage({ params }: { params: { token: string } }) {
  return <InviteAccept token={params.token} />;
}
