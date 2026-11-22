import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Search, UserPlus, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

export default function Friends() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("friends");

  const { data: friends = [], refetch: refetchFriends } = trpc.friends.getFriends.useQuery();
  const { data: pendingRequests = [], refetch: refetchPending } = trpc.friends.getPendingRequests.useQuery();
  const { data: searchResults = [], refetch: refetchSearch } = trpc.friends.search.useQuery(
    { query: searchQuery },
    { enabled: searchQuery.length > 0 }
  );

  const sendRequest = trpc.friends.sendRequest.useMutation({
    onSuccess: () => {
      toast.success("好友邀請已發送!");
      setSearchQuery("");
    },
    onError: (error) => {
      toast.error(error.message || "發送邀請失敗");
    },
  });

  const acceptRequest = trpc.friends.acceptRequest.useMutation({
    onSuccess: () => {
      toast.success("已接受好友邀請!");
      refetchFriends();
      refetchPending();
    },
    onError: () => {
      toast.error("接受邀請失敗");
    },
  });

  const rejectRequest = trpc.friends.rejectRequest.useMutation({
    onSuccess: () => {
      toast.success("已拒絕好友邀請");
      refetchPending();
    },
    onError: () => {
      toast.error("拒絕邀請失敗");
    },
  });

  const handleSearch = () => {
    if (searchQuery.trim()) {
      refetchSearch();
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-primary text-primary-foreground py-6 px-4">
        <div className="container max-w-2xl">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6" />
            浪友
          </h1>
        </div>
      </div>

      <div className="container max-w-2xl py-6 px-4 space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="friends">
              好友 ({friends.length})
            </TabsTrigger>
            <TabsTrigger value="requests">
              邀請 ({pendingRequests.length})
            </TabsTrigger>
            <TabsTrigger value="search">搜尋</TabsTrigger>
          </TabsList>

          {/* Friends List */}
          <TabsContent value="friends" className="space-y-4">
            {friends.length === 0 ? (
              <Card className="bg-card">
                <CardContent className="pt-6 text-center text-muted-foreground">
                  <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>還沒有好友</p>
                  <p className="text-sm mt-2">去搜尋頁面尋找浪友吧!</p>
                </CardContent>
              </Card>
            ) : (
              friends.map((friend) => (
                <Card key={friend.id} className="bg-card">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-foreground">
                          {friend.friendName || "未命名使用者"}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {friend.friendEmail}
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        查看紀錄
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Pending Requests */}
          <TabsContent value="requests" className="space-y-4">
            {pendingRequests.length === 0 ? (
              <Card className="bg-card">
                <CardContent className="pt-6 text-center text-muted-foreground">
                  <UserPlus className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>沒有待處理的好友邀請</p>
                </CardContent>
              </Card>
            ) : (
              pendingRequests.map((request) => (
                <Card key={request.id} className="bg-card">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-foreground">
                          {request.userName || "未命名使用者"}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {request.userEmail}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => acceptRequest.mutate({ requestId: request.id })}
                          disabled={acceptRequest.isPending}
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => rejectRequest.mutate({ requestId: request.id })}
                          disabled={rejectRequest.isPending}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Search */}
          <TabsContent value="search" className="space-y-4">
            <Card className="bg-card">
              <CardHeader>
                <CardTitle className="text-card-foreground">搜尋浪友</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    placeholder="輸入姓名"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSearch();
                    }}
                  />
                  <Button onClick={handleSearch} disabled={!searchQuery.trim()}>
                    <Search className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {searchResults.length > 0 && (
              <div className="space-y-4">
                {searchResults.map((user) => (
                  <Card key={user.id} className="bg-card">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-foreground">
                            {user.name || "未命名使用者"}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => sendRequest.mutate({ friendId: user.id })}
                          disabled={sendRequest.isPending}
                        >
                          {sendRequest.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <UserPlus className="w-4 h-4 mr-2" />
                              加好友
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
