import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";

export function SessionShares({ friends, sharedIds, onSave, pending }: {
  friends: { id: number; name: string | null }[];
  sharedIds: number[];
  onSave: (ids: number[]) => void;
  pending: boolean;
}) {
  const [selected, setSelected] = useState<number[] | null>(null);
  const ids = selected ?? sharedIds;
  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <h2 className="text-lg font-semibold">分享給好友</h2>
        <p className="text-sm text-muted-foreground">新紀錄不會自動分享。只有勾選的好友能查看這筆紀錄和影片，取消勾選並儲存後就會停止分享。</p>
        {friends.length === 0 ? <p className="text-muted-foreground">還沒有好友，加入好友後就能分享紀錄。</p> : friends.map(friend => (
          <label key={friend.id} className="flex items-center gap-3">
            <Checkbox checked={ids.includes(friend.id)} disabled={pending} onCheckedChange={checked => {
              setSelected(checked === true ? [...ids, friend.id] : ids.filter(id => id !== friend.id));
            }} />
            {friend.name || "未命名使用者"}
          </label>
        ))}
        <Button disabled={pending} onClick={() => onSave(ids.filter(id => friends.some(friend => friend.id === id)))}>{pending ? "儲存中…" : "儲存分享設定"}</Button>
      </CardContent>
    </Card>
  );
}
