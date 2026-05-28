import { avatarColor, initials } from "@/lib/ui";

export function Avatar({
  name,
  email,
  size = 32,
}: {
  name: string;
  email: string;
  size?: number;
}) {
  const cls = avatarColor(email || name);
  return (
    <div
      className={`inline-flex items-center justify-center rounded-full font-medium ${cls}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      title={name || email}
    >
      {initials(name, email)}
    </div>
  );
}
