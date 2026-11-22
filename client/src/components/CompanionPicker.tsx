import { trpc } from "@/lib/trpc";

type CompanionPickerProps = {
  value: number[];
  onChange: (ids: number[]) => void;
  disabled?: boolean;
};

export function CompanionPicker({ value, onChange, disabled }: CompanionPickerProps) {
  const { data: friends, isPending, isError } = trpc.friends.getFriends.useQuery();
  const { data: user } = trpc.auth.me.useQuery();
  const options = new Map(
    friends?.flatMap(friend => {
      const id = friend.userId === user?.id ? friend.friendId : friend.userId;
      return id !== user?.id
        ? [[id, friend.friendName || friend.friendEmail || "未命名好友"] as const]
        : [];
    })
  );

  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="text-sm font-medium text-card-foreground">衝浪夥伴（選填）</legend>
      <p className="text-sm text-muted-foreground">標記一起衝浪的好友，不會分享這筆紀錄。</p>
      {isPending || !user ? (
        <p className="text-sm text-muted-foreground">正在載入好友…</p>
      ) : isError ? (
        <p className="text-sm text-muted-foreground">無法載入好友，請稍後再試。</p>
      ) : options.size === 0 ? (
        <p className="text-sm text-muted-foreground">目前沒有可標記的好友。</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {Array.from(options, ([id, name]) => (
            <label key={id} className="flex max-w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm has-checked:border-primary has-checked:bg-accent has-disabled:opacity-50">
              <input
                type="checkbox"
                className="size-4 shrink-0 accent-primary"
                checked={value.includes(id)}
                onChange={event => onChange(event.currentTarget.checked
                  ? [...value, id]
                  : value.filter(selectedId => selectedId !== id))}
              />
              <span className="break-all">{name}</span>
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}
